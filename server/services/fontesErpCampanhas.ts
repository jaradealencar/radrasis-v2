/**
 * Fontes de Dados automáticas do ERP para Campanhas WhatsApp: 4 públicos calculados a partir do histórico
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
import { isOsNormalDb, normalizeEmpresaKey } from "../routers/performanceComercial";
import { parseDataFlexivel, STATUS_GANHO } from "./inteligenciaClientes";
import { dataLocalParaIso } from "./campanhasWhatsapp";
import { diasEntre, hojeCampoGrande } from "../../shared/campanhas-whatsapp";
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

// ─── As 4 fontes automáticas (funções puras — recebem a base já carregada) ──────────────────────────────

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

/** Inativos: já compraram alguma vez, mas a última compra foi há `minDias` (padrão 180) ou mais. */
export function resolverInativos(base: Map<string, ClienteComTelefone>, hoje: string, minDias = 180): ContatoFonte[] {
  const resultado: ContatoFonte[] = [];
  for (const c of base.values()) {
    if (diasEntre(c.ultimaCompra, hoje) >= minDias) resultado.push({ telefone: c.telefone, nome: c.empresa });
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

// ─── Orquestração (I/O) ─────────────────────────────────────────────────────────────────────────────────

/** Chave usada em campanhas_whatsapp_fontes.consulta_erp → função de resolução (recebe a base já carregada). */
export const RESOLVEDORES_ERP: Record<string, (base: Map<string, ClienteComTelefone>, orcamentos: HistoricoOrcamento[], hoje: string) => ContatoFonte[]> = {
  clientes_ativos: base => resolverClientesAtivos(base, hojeCampoGrande()),
  primeira_compra: base => resolverPrimeiraCompra(base, hojeCampoGrande()),
  inativos_6m: base => resolverInativos(base, hojeCampoGrande()),
  orcaram_nao_compraram: (base, orcamentos) => resolverOrcaramNaoCompraram(orcamentos, base, hojeCampoGrande()),
  compraram_uma_vez_sumiram: base => resolverCompraramUmaVezESumiram(base, hojeCampoGrande()),
};

/** Carrega historico_os + historico_orcamentos uma única vez para resolver quantas fontes ERP forem pedidas
 * (evita 1 SELECT por fonte quando uma campanha combina várias). */
export async function carregarContextoErp(): Promise<{ base: Map<string, ClienteComTelefone>; orcamentos: HistoricoOrcamento[] }> {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const [osRows, orcamentos] = await Promise.all([
    db.select().from(historicoOs),
    db.select().from(historicoOrcamentos),
  ]);
  return { base: construirBaseComTelefone(osRows), orcamentos };
}

export async function resolverFonteErp(consultaErp: string): Promise<ContatoFonte[]> {
  const resolvedor = RESOLVEDORES_ERP[consultaErp];
  if (!resolvedor) throw new Error(`Consulta ERP desconhecida: "${consultaErp}"`);
  const { base, orcamentos } = await carregarContextoErp();
  return resolvedor(base, orcamentos, hojeCampoGrande());
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
