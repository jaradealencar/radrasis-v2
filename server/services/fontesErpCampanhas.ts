/**
 * Fontes de Dados automáticas do ERP para Campanhas WhatsApp: 9 públicos calculados a partir do histórico
 * local (historico_os / historico_orcamentos), sem chamada à API MubiSys — mesmo espírito de
 * server/services/inteligenciaClientes.ts (cálculo local) e do pós-venda em campanhasWhatsapp.ts.
 *
 * Reaproveita as peças já existentes (isOsNormalDb, parseDataFlexivel, normalizeEmpresaKey, STATUS_GANHO) em
 * vez de reescrever a classificação de cliente novo/inativo — só a agregação com TELEFONE é nova, porque
 * `ClienteBase`/`construirBaseClientes` (inteligenciaClientes.ts) não carrega telefone (não precisava até
 * agora). Ver docs/campanhas-whatsapp.md, seção "Fontes de Dados".
 */

import * as XLSX from "xlsx";
import { getDb } from "../db/db";
import { historicoOs, historicoOrcamentos, type HistoricoOs, type HistoricoOrcamento } from "../../drizzle/schema";
import { isClienteNovoPorRecencia, isOsNormalDb, normalizeEmpresaKey } from "../routers/performanceComercial";
import { parseDataFlexivel, STATUS_GANHO } from "./inteligenciaClientes";
import { dataLocalParaIso } from "./campanhasWhatsapp";
import { diasEntre, hojeCampoGrande, somarDias } from "../../shared/campanhas-whatsapp";
import { extrairContatos, detectarSeparadorCsv, type LeituraLista } from "../../shared/lista-contatos";

export interface ContatoFonte {
  /** `null` quando a empresa nunca teve telefone gravado localmente (mesma limitação já documentada no
   * pós-venda: historico_os.telefone só existe a partir de 21/09/2026, backfill em completarTelefones). */
  telefone: string | null;
  nome: string;
}

// ─── Agregação local com telefone (não é ClienteBase — aquele não carrega telefone) ────────────────────

export interface ClienteComTelefone {
  empresaKey: string;
  empresa: string;
  telefone: string | null;
  primeiraCompra: string; // ISO
  ultimaCompra: string; // ISO
  totalCompras: number;
}

export function construirBaseComTelefone(rows: HistoricoOs[]): Map<string, ClienteComTelefone> {
  const base = new Map<string, ClienteComTelefone>();
  for (const r of rows) {
    if (!isOsNormalDb(r)) continue;
    const empresaBruta = (r.empresa ?? "").trim();
    if (!empresaBruta) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!data) continue;
    const dataIso = dataLocalParaIso(data);
    const key = normalizeEmpresaKey(empresaBruta);

    let cliente = base.get(key);
    if (!cliente) {
      cliente = { empresaKey: key, empresa: empresaBruta, telefone: null, primeiraCompra: dataIso, ultimaCompra: dataIso, totalCompras: 0 };
      base.set(key, cliente);
    }
    cliente.totalCompras++;
    if (dataIso < cliente.primeiraCompra) cliente.primeiraCompra = dataIso;
    if (dataIso >= cliente.ultimaCompra) {
      cliente.ultimaCompra = dataIso;
      cliente.empresa = empresaBruta; // grafia mais recente, mesmo critério de construirBaseClientes
      if (r.telefone) cliente.telefone = r.telefone;
    } else if (!cliente.telefone && r.telefone) {
      cliente.telefone = r.telefone; // fallback: qualquer telefone conhecido da empresa, mesmo de compra antiga
    }
  }
  return base;
}

// ─── Fontes automáticas (funções puras — recebem a base já carregada) ───────────────────────────────────

/** Clientes ativos: última compra dentro da janela (padrão 180 dias / ~6 meses). */
export function resolverClientesAtivos(base: Map<string, ClienteComTelefone>, hoje: string, janelaDias = 180): ContatoFonte[] {
  const resultado: ContatoFonte[] = [];
  for (const c of base.values()) {
    if (diasEntre(c.ultimaCompra, hoje) <= janelaDias) resultado.push({ telefone: c.telefone, nome: c.empresa });
  }
  return resultado;
}

/** Primeira compra (onboarding): só tem 1 compra até agora, e ela foi recente (padrão 60 dias). */
export function resolverPrimeiraCompra(base: Map<string, ClienteComTelefone>, hoje: string, janelaDias = 60): ContatoFonte[] {
  const resultado: ContatoFonte[] = [];
  for (const c of base.values()) {
    if (c.totalCompras === 1 && diasEntre(c.primeiraCompra, hoje) <= janelaDias) resultado.push({ telefone: c.telefone, nome: c.empresa });
  }
  return resultado;
}

/**
 * Inativos: já compraram alguma vez, mas a última compra foi há `minDias` (padrão 180) ou mais.
 * `maxDias` é opcional (padrão: sem teto, todo o histórico) — usado pela fonte seedada com um teto de 24
 * meses (ver `MESES_TETO_INATIVOS_SEED` abaixo): pedido do usuário 28/09/2026 para alinhar com o alcance do
 * backfill de telefone (`MESES_BACKFILL_PADRAO` em telefone-historico.ts) — sem o teto, a fonte trazia
 * clientes tão antigos que nunca teriam telefone preenchido mesmo depois do backfill rodar.
 */
export function resolverInativos(base: Map<string, ClienteComTelefone>, hoje: string, minDias = 180, maxDias?: number): ContatoFonte[] {
  const resultado: ContatoFonte[] = [];
  for (const c of base.values()) {
    const dias = diasEntre(c.ultimaCompra, hoje);
    if (dias < minDias) continue;
    if (maxDias !== undefined && dias > maxDias) continue;
    resultado.push({ telefone: c.telefone, nome: c.empresa });
  }
  return resultado;
}

/**
 * Orçaram e não compraram: orçamento com status que não é venda ganha (aberto ou perdido — ambos candidatos
 * a follow-up, mesmo vocabulário de STATUS_GANHO já usado no funil de orçamentos). Telefone vem de
 * historico_os da mesma empresa quando ela já foi cliente alguma vez; senão fica `null` (historico_orcamentos
 * não guarda telefone — só nome da empresa). 1 contato por empresa mesmo com vários orçamentos.
 *
 * `janelaDias` é opcional (padrão: sem limite, todo o histórico) — decisão do usuário 27/09/2026: cogitou
 * separar por ano do orçamento e descartou ("puxa de todo o histórico que é melhor"). Existe só para quem
 * quiser restringir a um recorte mais recente num uso futuro; a fonte ERP seedada não passa esse parâmetro.
 */
export function resolverOrcaramNaoCompraram(
  orcamentos: HistoricoOrcamento[], base: Map<string, ClienteComTelefone>, hoje: string, janelaDias?: number,
): ContatoFonte[] {
  const vistos = new Set<string>();
  const resultado: ContatoFonte[] = [];
  for (const o of orcamentos) {
    const status = (o.status ?? "").trim().toLowerCase();
    if (STATUS_GANHO.has(status)) continue;
    const data = parseDataFlexivel(o.dataCadastro);
    if (!data) continue;
    const dataIso = dataLocalParaIso(data);
    if (janelaDias !== undefined && diasEntre(dataIso, hoje) > janelaDias) continue;
    const empresaBruta = (o.empresa ?? "").trim();
    if (!empresaBruta) continue;
    const key = normalizeEmpresaKey(empresaBruta);
    if (vistos.has(key)) continue;
    vistos.add(key);
    const cliente = base.get(key);
    resultado.push({ telefone: cliente?.telefone ?? null, nome: cliente?.empresa ?? empresaBruta });
  }
  return resultado;
}

/**
 * Compraram uma única vez e sumiram: diferente de "Primeira compra" (que pega quem comprou 1x HÁ POUCO
 * TEMPO, para onboarding), esta pega quem comprou 1x e essa única compra já esfriou (padrão 180 dias / ~6
 * meses) — nunca recomprou depois. Pedido do usuário 27/09/2026 ("compraram uma só vez e não compraram mais
 * há uns seis meses"), não coberto pelas 4 fontes anteriores: "Inativos" pega qualquer última compra velha
 * (mesmo quem já comprou várias vezes antes de parar); esta é o subconjunto mais estrito (só 1 compra na vida).
 */
export function resolverCompraramUmaVezESumiram(base: Map<string, ClienteComTelefone>, hoje: string, minDias = 180): ContatoFonte[] {
  const resultado: ContatoFonte[] = [];
  for (const c of base.values()) {
    if (c.totalCompras === 1 && diasEntre(c.primeiraCompra, hoje) >= minDias) resultado.push({ telefone: c.telefone, nome: c.empresa });
  }
  return resultado;
}

/**
 * Compraram apenas 1 vez, em todo o histórico — sem filtro de tempo (pedido do usuário 28/09/2026,
 * diferente de "Compraram 1 vez e sumiram", que só pega quem já esfriou há 6+ meses). Útil como base geral
 * de "clientes que nunca recompraram", independente de quando foi a única compra.
 */
export function resolverCompraramUmaVez(base: Map<string, ClienteComTelefone>): ContatoFonte[] {
  const resultado: ContatoFonte[] = [];
  for (const c of base.values()) {
    if (c.totalCompras === 1) resultado.push({ telefone: c.telefone, nome: c.empresa });
  }
  return resultado;
}

// ─── Novos/Reativados do mês: reaproveita a mesma regra de negócio do Performance Comercial ──────────────
// (isClienteNovoPorRecencia) em vez de reimplementar o cálculo de "gap de meses" — só a agregação com
// TELEFONE é nova aqui (a versão de performanceComercial.ts não carrega telefone).

export interface HistoricoComprasCliente {
  empresaKey: string;
  empresa: string;
  telefone: string | null;
  /** Todas as compras válidas do cliente, não só primeira/última — precisa para achar a última compra
   * ANTES de um mês de referência específico (mês corrente), que pode não ser a "última compra" global
   * se o cliente já comprou de novo depois. */
  compras: Array<{ mes: number; ano: number }>;
}

export function construirHistoricoComprasPorCliente(rows: HistoricoOs[]): Map<string, HistoricoComprasCliente> {
  const mapa = new Map<string, HistoricoComprasCliente>();
  for (const r of rows) {
    if (!isOsNormalDb(r)) continue;
    const empresaBruta = (r.empresa ?? "").trim();
    if (!empresaBruta) continue;
    const key = normalizeEmpresaKey(empresaBruta);
    let c = mapa.get(key);
    if (!c) { c = { empresaKey: key, empresa: empresaBruta, telefone: null, compras: [] }; mapa.set(key, c); }
    c.compras.push({ mes: r.mes, ano: r.ano });
    if (r.telefone) c.telefone = r.telefone;
  }
  return mapa;
}

function ultimaCompraAntesDoMes(compras: Array<{ mes: number; ano: number }>, mes: number, ano: number): { mes: number; ano: number } | undefined {
  let melhor: { mes: number; ano: number } | undefined;
  for (const c of compras) {
    if (c.ano > ano || (c.ano === ano && c.mes >= mes)) continue;
    if (!melhor || c.ano > melhor.ano || (c.ano === melhor.ano && c.mes > melhor.mes)) melhor = c;
  }
  return melhor;
}

const comprouNoMes = (compras: Array<{ mes: number; ano: number }>, mes: number, ano: number) =>
  compras.some(c => c.mes === mes && c.ano === ano);

/**
 * Novos clientes do mês: primeira compra da vida caiu dentro do mês corrente (diferente de "Primeira
 * compra/onboarding", que usa uma janela corrida de 60 dias e pode cruzar 2 meses-calendário). Pedido do
 * usuário 28/09/2026: campanha mensal de agradecimento, disponível no último dia de cada mês.
 */
export function resolverNovosDoMes(comprasPorCliente: Map<string, HistoricoComprasCliente>, hoje: string): ContatoFonte[] {
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7));
  const resultado: ContatoFonte[] = [];
  for (const c of comprasPorCliente.values()) {
    if (!comprouNoMes(c.compras, mes, ano)) continue;
    const ultimaAntes = ultimaCompraAntesDoMes(c.compras, mes, ano);
    if (isClienteNovoPorRecencia(ultimaAntes, mes, ano) && !ultimaAntes) {
      resultado.push({ telefone: c.telefone, nome: c.empresa });
    }
  }
  return resultado;
}

/**
 * Reativados do mês: já tinham comprado antes, mas a compra deste mês veio depois de 6+ meses parados —
 * mesma regra de "novo/reativado" do Performance Comercial (isClienteNovoPorRecencia), aqui filtrando só o
 * subconjunto "reativado" (tinha compra anterior, ao contrário de "novo puro"). Pedido do usuário 28/09/2026.
 */
export function resolverReativadosDoMes(comprasPorCliente: Map<string, HistoricoComprasCliente>, hoje: string): ContatoFonte[] {
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7));
  const resultado: ContatoFonte[] = [];
  for (const c of comprasPorCliente.values()) {
    if (!comprouNoMes(c.compras, mes, ano)) continue;
    const ultimaAntes = ultimaCompraAntesDoMes(c.compras, mes, ano);
    if (ultimaAntes && isClienteNovoPorRecencia(ultimaAntes, mes, ano)) {
      resultado.push({ telefone: c.telefone, nome: c.empresa });
    }
  }
  return resultado;
}

// ─── Redução de volume: últimos 90 dias vs. 90 dias anteriores ──────────────────────────────────────────
// Decisão do usuário 28/09/2026 (pergunta direta): comparar os últimos 3 meses com os 3 meses anteriores a
// esses — aqui em dias corridos (90/90) para reaproveitar diasEntre/somarDias já existentes, em vez de
// meses-calendário. Não é "inativo": o cliente ainda comprou nos últimos 90 dias, só que menos que antes.

export interface VolumePorJanela {
  empresaKey: string;
  empresa: string;
  telefone: string | null;
  valorRecente: number;
  valorAnterior: number;
}

export function construirVolumePorJanela(rows: HistoricoOs[], hoje: string, diasPorJanela = 90): Map<string, VolumePorJanela> {
  const fimRecente = hoje;
  const inicioRecente = somarDias(hoje, -(diasPorJanela - 1));
  const fimAnterior = somarDias(inicioRecente, -1);
  const inicioAnterior = somarDias(fimAnterior, -(diasPorJanela - 1));

  const mapa = new Map<string, VolumePorJanela>();
  for (const r of rows) {
    if (!isOsNormalDb(r)) continue;
    const empresaBruta = (r.empresa ?? "").trim();
    if (!empresaBruta) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!data) continue;
    const dataIso = dataLocalParaIso(data);
    const key = normalizeEmpresaKey(empresaBruta);
    let c = mapa.get(key);
    if (!c) { c = { empresaKey: key, empresa: empresaBruta, telefone: null, valorRecente: 0, valorAnterior: 0 }; mapa.set(key, c); }
    if (r.telefone) c.telefone = r.telefone;
    const valor = Number(r.valorOs) || 0;
    if (dataIso >= inicioRecente && dataIso <= fimRecente) c.valorRecente += valor;
    else if (dataIso >= inicioAnterior && dataIso <= fimAnterior) c.valorAnterior += valor;
  }
  return mapa;
}

/** Queda mínima padrão: 30% — sugestão razoável na ausência de um número definido pelo usuário; ajustável
 * por parâmetro se um dia precisar ficar mais/menos sensível. */
export function resolverReducaoDeVolume(mapa: Map<string, VolumePorJanela>, quedaMinimaPct = 30): ContatoFonte[] {
  const resultado: ContatoFonte[] = [];
  for (const c of mapa.values()) {
    if (c.valorAnterior <= 0) continue; // sem base de comparação — não é "queda", pode até ser cliente novo
    const quedaPct = ((c.valorAnterior - c.valorRecente) / c.valorAnterior) * 100;
    if (quedaPct >= quedaMinimaPct) resultado.push({ telefone: c.telefone, nome: c.empresa });
  }
  return resultado;
}

// ─── Orquestração (I/O) ─────────────────────────────────────────────────────────────────────────────────

/** "N meses atrás" em calendário real (não N*30 dias) — usado pelo teto de 24 meses de "Inativos" (ver
 * abaixo). Dia do mês é preservado quando existe no mês de destino, senão cai no último dia dele
 * (ex.: 31/03 menos 1 mês = 28 ou 29/02). */
function subtrairMesesIso(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const totalMeses = ano * 12 + (mes - 1) - meses;
  const novoAno = Math.floor(totalMeses / 12);
  const novoMes = (totalMeses % 12 + 12) % 12; // 0-indexado
  const ultimoDiaDoNovoMes = new Date(Date.UTC(novoAno, novoMes + 1, 0)).getUTCDate();
  const novoDia = Math.min(dia, ultimoDiaDoNovoMes);
  return `${novoAno}-${String(novoMes + 1).padStart(2, "0")}-${String(novoDia).padStart(2, "0")}`;
}

/** Teto da fonte "Inativos 6+ meses" seedada — alinhado ao alcance do backfill de telefone
 * (MESES_BACKFILL_PADRAO em telefone-historico.ts). Duplicado aqui (não importado) de propósito: este
 * módulo de fontes ERP não deve depender do módulo de sync de telefone; se um dia divergirem, é bug —
 * mantenha os dois em sincronia. */
const MESES_TETO_INATIVOS_SEED = 24;

/** Chave usada em campanhas_whatsapp_fontes.consulta_erp → função de resolução (recebe o contexto já
 * carregado por carregarContextoErp). `comprasPorCliente`/volume por janela são computados sob demanda
 * (lazy, com cache no próprio ctx) — a maioria das fontes não precisa deles, e recalcular sempre em
 * carregarContextoErp deixava TODA fonte mais lenta à toa (regressão medida 28/09/2026: timeout de teste). */
export const RESOLVEDORES_ERP: Record<string, (ctx: ContextoErp, hoje: string) => ContatoFonte[]> = {
  clientes_ativos: ctx => resolverClientesAtivos(ctx.base, hojeCampoGrande()),
  primeira_compra: ctx => resolverPrimeiraCompra(ctx.base, hojeCampoGrande()),
  inativos_6m: ctx => resolverInativos(ctx.base, hojeCampoGrande(), 180, diasEntre(subtrairMesesIso(hojeCampoGrande(), MESES_TETO_INATIVOS_SEED), hojeCampoGrande())),
  orcaram_nao_compraram: ctx => resolverOrcaramNaoCompraram(ctx.orcamentos, ctx.base, hojeCampoGrande()),
  compraram_uma_vez_sumiram: ctx => resolverCompraramUmaVezESumiram(ctx.base, hojeCampoGrande()),
  compraram_uma_vez: ctx => resolverCompraramUmaVez(ctx.base),
  novos_do_mes: ctx => resolverNovosDoMes(obterComprasPorCliente(ctx), hojeCampoGrande()),
  reativados_do_mes: ctx => resolverReativadosDoMes(obterComprasPorCliente(ctx), hojeCampoGrande()),
  reducao_volume: ctx => resolverReducaoDeVolume(obterVolumePorJanela(ctx, hojeCampoGrande())),
};

export interface ContextoErp {
  base: Map<string, ClienteComTelefone>;
  orcamentos: HistoricoOrcamento[];
  osRows: HistoricoOs[];
  /** Cache lazy — preenchido por obterComprasPorCliente/obterVolumePorJanela na primeira fonte que precisar. */
  _comprasPorClienteCache?: Map<string, HistoricoComprasCliente>;
  _volumePorJanelaCache?: Map<string, VolumePorJanela>;
}

function obterComprasPorCliente(ctx: ContextoErp): Map<string, HistoricoComprasCliente> {
  if (!ctx._comprasPorClienteCache) ctx._comprasPorClienteCache = construirHistoricoComprasPorCliente(ctx.osRows);
  return ctx._comprasPorClienteCache;
}

function obterVolumePorJanela(ctx: ContextoErp, hoje: string): Map<string, VolumePorJanela> {
  if (!ctx._volumePorJanelaCache) ctx._volumePorJanelaCache = construirVolumePorJanela(ctx.osRows, hoje);
  return ctx._volumePorJanelaCache;
}

/** Carrega historico_os + historico_orcamentos uma única vez para resolver quantas fontes ERP forem pedidas
 * (evita 1 SELECT por fonte quando uma campanha combina várias). */
export async function carregarContextoErp(): Promise<ContextoErp> {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const [osRows, orcamentos] = await Promise.all([
    db.select().from(historicoOs),
    db.select().from(historicoOrcamentos),
  ]);
  return { base: construirBaseComTelefone(osRows), orcamentos, osRows };
}

export async function resolverFonteErp(consultaErp: string): Promise<ContatoFonte[]> {
  const resolvedor = RESOLVEDORES_ERP[consultaErp];
  if (!resolvedor) throw new Error(`Consulta ERP desconhecida: "${consultaErp}"`);
  const ctx = await carregarContextoErp();
  return resolvedor(ctx, hojeCampoGrande());
}

// ─── Fonte tipo "arquivo": lê o arquivo salvo (campanhas_whatsapp_arquivos) sob demanda ──────────────────
// Mesma extração pura de client/src/lib/listaContatos.ts (shared/lista-contatos.ts) — não duplica dado: o
// arquivo pode ter sido enviado solto ou dentro de qualquer campanha, a fonte só referencia a URL.

export async function lerArquivoDeUrl(url: string, nomeArquivo: string): Promise<LeituraLista> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return { ok: false, erro: `Não consegui baixar o arquivo (HTTP ${resp.status}).` };
    const buffer = Buffer.from(await resp.arrayBuffer());
    const ehCsv = /\.(csv|txt)$/i.test(nomeArquivo);
    const wb = ehCsv
      ? XLSX.read(buffer.toString("utf-8"), { type: "string", raw: true, FS: detectarSeparadorCsv(buffer.toString("utf-8").split(/\r?\n/, 1)[0] ?? "") })
      : XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { ok: false, erro: "Não encontrei nenhuma aba na planilha." };
    return extrairContatos(XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true }));
  } catch {
    return { ok: false, erro: "Não consegui ler esse arquivo. Confira se é um .csv ou .xlsx válido." };
  }
}
