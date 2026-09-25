/**
 * Classificação de clientes/pedidos para o relatório de Marketing/Crescimento
 * e Resultado (client/src/pages/financeiro/MarketingFinanceiro.tsx).
 *
 * É um CLONE PARAMETRIZADO de `calcularNovosDoMesLocal`
 * (server/routers/performanceComercial.ts) — mesma regra de negócio, mesma
 * fonte (historico_os), mesmos helpers (isOsNormalDb, normalizeEmpresaKey,
 * buscarTodasComprasValidas, ultimaCompraAntesDe, reindexarPorChaveNormalizada,
 * isClienteNovoPorRecencia) — mas com duas diferenças propositais:
 *
 * 1. O período de inatividade (`mesesInatividade`) é parametrizável, vindo de
 *    `marketing_config`, em vez do MESES_INATIVIDADE_PARA_NOVO hardcoded.
 *    Isso NÃO pode mexer em Performance Comercial/Inteligência de
 *    Clientes/snapshots de performance_auditada — por isso vive aqui, num
 *    arquivo separado, em vez de parametrizar a função original in-place.
 * 2. Classifica em 3 categorias mutuamente exclusivas (não 2): "novo"
 *    (nunca comprou antes), "recorrenteAtivo" (comprou antes, mas dentro da
 *    janela de inatividade — categoria nova, que antes não tinha nome/contagem
 *    própria) e "reativado" (comprou antes, gap >= mesesInatividade). Também
 *    processa TODAS as O.S. válidas do período (não só as de clientes
 *    novo/reativado), para permitir reconciliar o faturamento total.
 *
 * A duplicação é intencional e documentada (não um refactor compartilhado
 * agressivo) — ver Parte 1 "Riscos e cuidados" do plano de implementação.
 * Um teste de paridade (marketing-financeiro-clientes.test.ts) garante que,
 * com mesesInatividade=6, a soma de "novo"+"reativado" desta função bate
 * exatamente com a saída de calcularNovosDoMesLocal.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/db";
import { historicoOs, clienteOverrides } from "../../drizzle/schema";
import {
  isOsNormalDb, isOsNormalApi, normalizeEmpresaKey, nomeClienteDaOsApi, valorLiquidoOs,
  buscarTodasComprasValidas, ultimaCompraAntesDe, reindexarPorChaveNormalizada,
  isClienteNovoPorRecencia, buscarOsEOrcamentosAoVivoDoMes, type CompraMinima,
} from "../routers/performanceComercial";
import { agregarLinhas, type MargemAgregada } from "../../shared/marketing-financeiro";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type CategoriaCliente = "novo" | "recorrenteAtivo" | "reativado" | "naoClassificado";

export interface OsBrutaMarketing {
  osNumero: string | null;
  empresa: string | null;
  tipoOs: string | null;
  status: string | null;
  mes: number;
  ano: number;
  valorOs: string | null;
  valorTotal: string | null;
  contribuicaoReais: string | null;
  vendedor: string | null;
  cidade: string | null;
  estado: string | null;
  dataAprovacao: string | null;
}

export interface OsClassificadaMarketing {
  osNumero: string | null;
  empresaOriginal: string;
  /** "" quando a O.S. caiu em "naoClassificado" por falta de nome de empresa utilizável. */
  clienteKey: string;
  mes: number;
  ano: number;
  valorOs: number;
  contribuicaoReais: number | null;
  vendedor: string | null;
  cidade: string | null;
  estado: string | null;
  /** varchar em formato misto dd/mm/aaaa (~97%) / ISO (~3%) — usar
   * server/services/inteligenciaClientes.ts:parseDataFlexivel para interpretar. */
  dataAprovacao: string | null;
  categoria: CategoriaCliente;
  jaComprouAntes: boolean;
  /** Meses de calendário desde a última compra válida — null se nunca comprou antes. */
  gapMesesUltimaCompra: number | null;
}

const num = (v: string | null | undefined) => parseFloat(String(v ?? "0")) || 0;
const numOuNull = (v: string | null | undefined): number | null => v == null ? null : (parseFloat(v) || 0);

/** Busca as colunas de historico_os necessárias para classificar + fazer
 * drill-down/coortes/mediana — superset da query de calcularNovosDoMesLocal
 * (que só busca o mínimo para contar novos/reativados). */
export async function buscarOsDoAno(db: Db, ano: number): Promise<OsBrutaMarketing[]> {
  return db.select({
    osNumero: historicoOs.osNumero,
    empresa: historicoOs.empresa,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status,
    mes: historicoOs.mes,
    ano: historicoOs.ano,
    valorOs: historicoOs.valorOs,
    valorTotal: historicoOs.valorTotal,
    contribuicaoReais: historicoOs.contribuicaoReais,
    vendedor: historicoOs.vendedor,
    cidade: historicoOs.cidade,
    estado: historicoOs.estado,
    dataAprovacao: historicoOs.dataAprovacao,
  }).from(historicoOs).where(eq(historicoOs.ano, ano));
}

export async function buscarOverrideMap(db: Db): Promise<Map<string, "recorrente" | "novo">> {
  const overrides = await db.select().from(clienteOverrides);
  const map = new Map<string, "recorrente" | "novo">();
  for (const ov of overrides) map.set(ov.empresa, ov.status);
  return map;
}

/** Classifica cada O.S. válida de um mês em novo/recorrenteAtivo/reativado/
 * naoClassificado. Estruturalmente idêntica ao laço de calcularNovosDoMesLocal
 * (mesmo filtro isOsNormalDb, mesma chave normalizeEmpresaKey, mesmo booleano
 * isNovoOuReativado) — só adiciona a categoria "recorrenteAtivo" para quem
 * hoje cai no "else" silencioso (comprou antes, mas ainda dentro da janela de
 * inatividade), e retorna uma linha por O.S. em vez de só agregados. */
export function classificarMes(
  mes: number,
  ano: number,
  osDoAno: OsBrutaMarketing[],
  todasComprasValidas: CompraMinima[],
  overrideMap: Map<string, "recorrente" | "novo">,
  mesesInatividade: number,
): OsClassificadaMarketing[] {
  const ultimaCompraPorCliente = reindexarPorChaveNormalizada(ultimaCompraAntesDe(todasComprasValidas, mes, ano));
  const osMes = osDoAno.filter(os => os.mes === mes);
  const resultado: OsClassificadaMarketing[] = [];

  for (const os of osMes) {
    if (!isOsNormalDb(os)) continue;
    const valorOs = num(os.valorOs ?? os.valorTotal);
    const contribuicaoReais = numOuNull(os.contribuicaoReais);
    const clienteKey = normalizeEmpresaKey(os.empresa ?? "");

    if (!clienteKey) {
      resultado.push({
        osNumero: os.osNumero, empresaOriginal: os.empresa ?? "", clienteKey: "", mes, ano, valorOs,
        contribuicaoReais, vendedor: os.vendedor, cidade: os.cidade, estado: os.estado, dataAprovacao: os.dataAprovacao,
        categoria: "naoClassificado", jaComprouAntes: false, gapMesesUltimaCompra: null,
      });
      continue;
    }

    const ultima = ultimaCompraPorCliente.get(clienteKey);
    const jaComprouAntes = Boolean(ultima);
    const gapMesesUltimaCompra = ultima ? (ano - ultima.ano) * 12 + (mes - ultima.mes) : null;
    const overrideStatus = overrideMap.get(clienteKey);
    const isNovoOuReativado = overrideStatus === "recorrente" ? false
      : overrideStatus === "novo" ? true
      : isClienteNovoPorRecencia(ultima, mes, ano, mesesInatividade);

    const categoria: CategoriaCliente = isNovoOuReativado
      ? (jaComprouAntes ? "reativado" : "novo")
      : "recorrenteAtivo";

    resultado.push({
      osNumero: os.osNumero, empresaOriginal: os.empresa ?? "", clienteKey, mes, ano, valorOs,
      contribuicaoReais, vendedor: os.vendedor, cidade: os.cidade, estado: os.estado, dataAprovacao: os.dataAprovacao,
      categoria, jaComprouAntes, gapMesesUltimaCompra,
    });
  }
  return resultado;
}

/** Classifica O.S. do mês vigente usando dados AO VIVO da API MubiSys (mesmo cache
 * compartilhado e mesma cadeia de fallback do Performance Comercial — ver
 * buscarOsEOrcamentosAoVivoDoMes), em vez de historico_os. `historico_os` só é
 * atualizado pelo import mensal combinado com o usuário (ver
 * [[performance-comercial-historico-vazio]]), então o mês em andamento sempre ficava
 * "atrasado" nesta tela em relação ao Performance Comercial (que já calcula o mês
 * corrente ao vivo) — os dois mostravam contagens de "clientes novos" e
 * "faturamento novos" diferentes para o mesmo mês (ver conversa 2026-09-25).
 * Estruturalmente idêntica a classificarMes, só trocando a fonte de O.S. brutas e os
 * nomes/formato de campo (API usa `cliente`/`sequencial_ordem`/`tipo`, não
 * `empresa`/`osNumero`/`tipoOs`). `contribuicaoReais` sempre null aqui — a API pública
 * não expõe custo/margem, então cai no fallback percentual de agregarMargem, igual a
 * qualquer O.S. sem contribuicaoReais no banco local. */
export async function classificarMesAoVivo(
  mes: number,
  ano: number,
  todasComprasValidas: CompraMinima[],
  overrideMap: Map<string, "recorrente" | "novo">,
  mesesInatividade: number,
): Promise<OsClassificadaMarketing[]> {
  const ultimaCompraPorCliente = reindexarPorChaveNormalizada(ultimaCompraAntesDe(todasComprasValidas, mes, ano));
  const { allOs } = await buscarOsEOrcamentosAoVivoDoMes(mes, ano, false);
  const osNormais = allOs.filter(isOsNormalApi);
  const resultado: OsClassificadaMarketing[] = [];

  for (const os of osNormais) {
    const nomeCliente = nomeClienteDaOsApi(os);
    const clienteKey = normalizeEmpresaKey(nomeCliente);
    const valorOs = valorLiquidoOs(os);
    const osNumero = String(os.sequencial_ordem ?? os.numero ?? "") || null;
    const dataAprovacao = (os.data_aprovacao || os.data_cadastro || null) as string | null;
    const endereco = Array.isArray(os.cliente_endereco) ? os.cliente_endereco[0] : null;
    const vendedor = os.vendedor != null ? String(os.vendedor) : null;

    if (!clienteKey) {
      resultado.push({
        osNumero, empresaOriginal: nomeCliente, clienteKey: "", mes, ano, valorOs,
        contribuicaoReais: null, vendedor, cidade: endereco?.cidade ?? null, estado: endereco?.estado ?? null,
        dataAprovacao, categoria: "naoClassificado", jaComprouAntes: false, gapMesesUltimaCompra: null,
      });
      continue;
    }

    const ultima = ultimaCompraPorCliente.get(clienteKey);
    const jaComprouAntes = Boolean(ultima);
    const gapMesesUltimaCompra = ultima ? (ano - ultima.ano) * 12 + (mes - ultima.mes) : null;
    const overrideStatus = overrideMap.get(clienteKey);
    const isNovoOuReativado = overrideStatus === "recorrente" ? false
      : overrideStatus === "novo" ? true
      : isClienteNovoPorRecencia(ultima, mes, ano, mesesInatividade);

    const categoria: CategoriaCliente = isNovoOuReativado
      ? (jaComprouAntes ? "reativado" : "novo")
      : "recorrenteAtivo";

    resultado.push({
      osNumero, empresaOriginal: nomeCliente, clienteKey, mes, ano, valorOs,
      contribuicaoReais: null, vendedor, cidade: endereco?.cidade ?? null, estado: endereco?.estado ?? null,
      dataAprovacao, categoria, jaComprouAntes, gapMesesUltimaCompra,
    });
  }
  return resultado;
}

/** Classifica o ano inteiro (meses 1..mesAtual se ano corrente, senão 1..12). O mês
 * vigente do ano corrente usa dados ao vivo (classificarMesAoVivo); os demais vêm de
 * historico_os (classificarMes) — fonte oficial após import/auditoria de fechamento. */
export async function classificarAno(db: Db, ano: number, mesesInatividade: number): Promise<OsClassificadaMarketing[]> {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtualNum = now.getMonth() + 1;
  const mesLimite = ano === anoAtual ? mesAtualNum : 12;
  const meses = Array.from({ length: mesLimite }, (_, i) => i + 1);

  const [todasComprasValidas, osDoAno, overrideMap] = await Promise.all([
    buscarTodasComprasValidas(db),
    buscarOsDoAno(db, ano),
    buscarOverrideMap(db),
  ]);

  const resultado: OsClassificadaMarketing[] = [];
  for (const mes of meses) {
    const ehMesVigente = ano === anoAtual && mes === mesAtualNum;
    if (ehMesVigente) {
      try {
        resultado.push(...await classificarMesAoVivo(mes, ano, todasComprasValidas, overrideMap, mesesInatividade));
        continue;
      } catch {
        // API MubiSys indisponível — cai para historico_os abaixo (mesmo
        // comportamento de antes desta mudança, melhor que travar a tela toda).
      }
    }
    resultado.push(...classificarMes(mes, ano, osDoAno, todasComprasValidas, overrideMap, mesesInatividade));
  }
  return resultado;
}

// ─── Agregação ────────────────────────────────────────────────────────────

export interface ResumoCategoria {
  qtdOs: number;
  qtdClientesUnicos: number;
  faturamento: number;
  margem: MargemAgregada;
}

export interface ResumoMesMarketing {
  mes: number;
  ano: number;
  porCategoria: Record<CategoriaCliente, ResumoCategoria>;
  /** Soma de valorOs de todas as O.S. válidas do mês (todas as categorias) —
   * é o "total de referência interno" para conciliação: por construção, sempre
   * igual à soma das 4 categorias (é o mesmo dado reparticionado). A
   * conciliação que pode divergir de verdade é contra financeiro_mensal.faturamentoOficial,
   * feita no router (fonte independente), não aqui. */
  faturamentoTotalValido: number;
}

/** Agrega uma lista de O.S. classificadas (de um único mês) em totais por
 * categoria — pedidos, clientes únicos, faturamento e margem (real/estimada/
 * mista, via shared/marketing-financeiro.ts:agregarMargem). */
export function agregarMes(mes: number, ano: number, classificadas: OsClassificadaMarketing[], percentualMargemFallback: number): ResumoMesMarketing {
  const doMes = classificadas.filter(c => c.mes === mes && c.ano === ano);
  const categorias: CategoriaCliente[] = ["novo", "recorrenteAtivo", "reativado", "naoClassificado"];
  const porCategoria = {} as Record<CategoriaCliente, ResumoCategoria>;

  for (const cat of categorias) {
    const doGrupo = doMes.filter(c => c.categoria === cat);
    const agregado = agregarLinhas(doGrupo, percentualMargemFallback);
    porCategoria[cat] = cat === "naoClassificado"
      ? { ...agregado, qtdClientesUnicos: doGrupo.length } // sem clienteKey utilizável, cada O.S. conta como 1
      : agregado;
  }

  return {
    mes, ano, porCategoria,
    faturamentoTotalValido: Math.round(doMes.reduce((s, c) => s + c.valorOs, 0) * 100) / 100,
  };
}

/** Clientes únicos reativados no ano (dedup entre meses — reativar em março E
 * setembro conta 1x aqui) vs. eventos de reativação (soma dos meses em que o
 * cliente foi classificado "reativado" — o mesmo exemplo conta 2x aqui). O
 * custo de reativação ponderado usa EVENTOS como denominador (ver
 * shared/marketing-financeiro.ts:custoReativacaoPonderado). */
export function calcularReativacaoAnual(classificadas: OsClassificadaMarketing[]): { clientesReativadosUnicosAno: number; eventosReativacaoAno: number } {
  const porClienteMes = new Set<string>(); // "clienteKey|mes" — 1 evento por cliente por mês
  const clientesUnicos = new Set<string>();
  for (const c of classificadas) {
    if (c.categoria !== "reativado" || !c.clienteKey) continue;
    porClienteMes.add(`${c.clienteKey}|${c.mes}`);
    clientesUnicos.add(c.clienteKey);
  }
  return { clientesReativadosUnicosAno: clientesUnicos.size, eventosReativacaoAno: porClienteMes.size };
}
