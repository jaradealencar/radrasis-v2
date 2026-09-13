/**
 * Score de Probabilidade de Compra — Fase 1.
 *
 * Usado por server/routers/crm.ts (cada proposta) e por
 * server/routers/performanceComercial.ts (listarClientesInteligencia, cada
 * cliente) para que os dois módulos mostrem o mesmo número para o mesmo
 * cliente — ver plano de "Score de Probabilidade de Compra no CRM (Fase 1)".
 *
 * Fórmula:
 *   - Cliente novo: base = taxa de conversão dos clientes novos, em média
 *     móvel de uma janela "madura" (meses 2 a 12 atrás — exclui orçamentos
 *     recentes demais para já terem sido decididos, ver nota em
 *     calcularTaxaConversaoNovosRecente).
 *   - Cliente recorrente: base = taxa de conversão INDIVIDUAL dele
 *     (orçamentos que fez vs. que fecharam, historicoOrcamentos) — com
 *     amostra mínima de MIN_AMOSTRA_TAXA_INDIVIDUAL; abaixo disso, usa a
 *     taxa geral da carteira (instável demais com 1-2 orçamentos).
 *   - Ajuste: proposta muito acima do ticket médio histórico do cliente
 *     reduz a probabilidade (mais dinheiro em jogo, mais difícil fechar).
 *
 * Fora de escopo desta fase (ver plano): cruzamento com CNPJ e com Análise
 * Geográfica. A chave de agrupamento é sempre normalizeEmpresaKey — mesma
 * chave usada em performanceComercial.ts/inteligenciaClientes.ts, para que
 * o CRM e a Inteligência de Clientes concordem sobre o mesmo cliente.
 */

import { historicoOrcamentos, historicoOs } from "../../drizzle/schema";
import { STATUS_GANHO, parseDataFlexivel } from "./inteligenciaClientes";

export const MIN_AMOSTRA_TAXA_INDIVIDUAL = 3;

/**
 * Cópia intencional de normalizeEmpresaKey (server/routers/performanceComercial.ts) —
 * não importada de lá para evitar dependência circular (performanceComercial.ts
 * importa este arquivo para listarClientesInteligencia). Precisa ficar idêntica
 * à de lá para as duas telas concordarem sobre a mesma chave de cliente.
 */
export function normalizeEmpresaKey(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export interface ConversaoCliente {
  totalOrcamentos: number;
  orcamentosFechados: number;
  /** null quando a amostra é pequena demais para confiar (ver MIN_AMOSTRA_TAXA_INDIVIDUAL). */
  taxaIndividual: number | null;
  /** null quando não há nenhum orçamento com valor registrado. */
  ticketMedio: number | null;
  /** Número de OS (ordens de serviço) já realizadas por esse cliente, via
   * historico_os — usado por ex. para elegibilidade de parcelamento
   * (clientes com mais de N compras). */
  qtdCompras: number;
}

export interface MapaConversaoClientes {
  porCliente: Map<string, ConversaoCliente>;
  /** Taxa de conversão agregada de toda a carteira (fallback para amostra pequena). */
  taxaGeral: number;
}

type DbClient = { select: Function };

/**
 * Lê todo o histórico de orçamentos (historico_orcamentos) e agrupa por
 * cliente. Consulta local ao Postgres — não depende do MubiSys, então é
 * rápida (nenhum risco de timeout como o já visto nas buscas ao vivo do CRM).
 */
export async function construirMapaConversaoClientes(db: any): Promise<MapaConversaoClientes> {
  const linhas = await db.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
    total: historicoOrcamentos.total,
  }).from(historicoOrcamentos);

  const porCliente = new Map<string, { total: number; fechados: number; somaValor: number; qtdComValor: number }>();
  let totalGeral = 0;
  let fechadosGeral = 0;

  for (const r of linhas as Array<{ empresa: string | null; status: string | null; total: string | null }>) {
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    const fechou = STATUS_GANHO.has((r.status ?? "").trim().toLowerCase());
    const valor = r.total != null ? parseFloat(r.total) : NaN;

    let acc = porCliente.get(empresaKey);
    if (!acc) {
      acc = { total: 0, fechados: 0, somaValor: 0, qtdComValor: 0 };
      porCliente.set(empresaKey, acc);
    }
    acc.total++;
    if (fechou) acc.fechados++;
    if (!isNaN(valor)) { acc.somaValor += valor; acc.qtdComValor++; }

    totalGeral++;
    if (fechou) fechadosGeral++;
  }

  // Número de compras reais (OS já realizadas) por cliente — usado, por exemplo,
  // para elegibilidade de parcelamento (clientes com mais de N compras).
  const osRows = await db.select({ empresa: historicoOs.empresa }).from(historicoOs);
  const qtdComprasPorCliente = new Map<string, number>();
  for (const r of osRows as Array<{ empresa: string | null }>) {
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    qtdComprasPorCliente.set(empresaKey, (qtdComprasPorCliente.get(empresaKey) ?? 0) + 1);
  }

  const resultado = new Map<string, ConversaoCliente>();
  for (const [empresaKey, acc] of porCliente.entries()) {
    resultado.set(empresaKey, {
      totalOrcamentos: acc.total,
      orcamentosFechados: acc.fechados,
      taxaIndividual: acc.total >= MIN_AMOSTRA_TAXA_INDIVIDUAL ? (acc.fechados / acc.total) * 100 : null,
      ticketMedio: acc.qtdComValor > 0 ? acc.somaValor / acc.qtdComValor : null,
      qtdCompras: qtdComprasPorCliente.get(empresaKey) ?? 0,
    });
  }
  // Clientes com OS mas sem nenhum orçamento correspondente em historico_orcamentos
  // (bases diferentes, cobertura não é 100% igual) — ainda entram no mapa só com qtdCompras.
  for (const [empresaKey, qtd] of qtdComprasPorCliente.entries()) {
    if (!resultado.has(empresaKey)) {
      resultado.set(empresaKey, { totalOrcamentos: 0, orcamentosFechados: 0, taxaIndividual: null, ticketMedio: null, qtdCompras: qtd });
    }
  }

  const taxaGeral = totalGeral > 0 ? (fechadosGeral / totalGeral) * 100 : 0;
  return { porCliente: resultado, taxaGeral };
}

/**
 * Janela "madura" para conversão de clientes novos: meses MES_FIM_JANELA_NOVOS
 * a MES_INICIO_JANELA_NOVOS atrás (não os últimos meses corridos).
 *
 * Descoberto na prática (12/09/2026): orçamentos dos últimos ~2 meses vêm
 * quase 100% com status "Em aberto" — o cliente ainda não decidiu, o ciclo de
 * fechamento leva mais tempo que isso. Uma janela móvel simples (ex.: "últimos
 * 3 meses") mede sobretudo pedidos ainda em aberto e artificialmente encolhe
 * a taxa para perto de 0% — foi o que causou o "5% em quase toda proposta de
 * cliente novo" percebido pelo usuário (taxa real conhecida: 3-15%). Pular os
 * 2 meses mais recentes dá tempo de a maioria dos pedidos já ter sido
 * decidida, sem cair no outro extremo de misturar anos de histórico.
 */
const MES_FIM_JANELA_NOVOS = 2;   // exclui os 2 meses mais recentes (ainda "imaturos")
const MES_INICIO_JANELA_NOVOS = 12; // olha até 12 meses atrás

/**
 * Taxa de conversão dos orçamentos de clientes novos na janela madura (ver
 * MES_FIM_JANELA_NOVOS/MES_INICIO_JANELA_NOVOS acima).
 *
 * "Novo" aqui é decidido POR ORÇAMENTO, comparando a data do orçamento com a
 * PRIMEIRA compra já registrada daquele cliente em historico_os — não um
 * `Set` estático de "já comprou alguma vez". Isso corrige um bug real
 * encontrado em 12/09/2026: um `Set` global de "clientes que já compraram"
 * exclui justamente os clientes novos que ACABARAM de converter (assim que
 * fecham, passam a existir em historico_os e somem do grupo "novo" — inclusive
 * retroativamente, no próprio orçamento que os converteu). Isso travava a taxa
 * de conversão de novos artificialmente perto de 0%, não importa a janela de
 * tempo escolhida. Com a comparação por data, um orçamento conta como "de
 * cliente novo" se, NA DATA daquele orçamento, o cliente ainda não tinha
 * nenhuma compra anterior — mesmo que ele tenha convertido depois.
 *
 * Devolve `null` (não `0`) quando não há NENHUM orçamento de cliente novo
 * nessa janela — distinção importante: "sem dado ainda" não é o mesmo que
 * "converteu 0%". O chamador cai para a taxa geral da carteira nesse caso
 * (ver calcularProbabilidade).
 */
export async function calcularTaxaConversaoNovosRecente(db: any): Promise<number | null> {
  const now = new Date();
  const janelas: Array<{ mes: number; ano: number }> = [];
  for (let i = MES_FIM_JANELA_NOVOS; i < MES_INICIO_JANELA_NOVOS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    janelas.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
  }
  const janelasSet = new Set(janelas.map(j => `${j.ano}-${j.mes}`));

  // Primeira compra registrada de cada cliente (historico_os) — usada para
  // saber se, NA DATA de um orçamento específico, o cliente já tinha comprado
  // antes ou não.
  const osRows = await db.select({
    empresa: historicoOs.empresa,
    dataAprovacao: historicoOs.dataAprovacao,
  }).from(historicoOs);
  const primeiraCompraPorCliente = new Map<string, Date>();
  for (const r of osRows as Array<{ empresa: string | null; dataAprovacao: string | null }>) {
    const key = normalizeEmpresaKey(r.empresa ?? "");
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!key || !data) continue;
    const atual = primeiraCompraPorCliente.get(key);
    if (!atual || data < atual) primeiraCompraPorCliente.set(key, data);
  }

  const linhas = await db.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
    dataCadastro: historicoOrcamentos.dataCadastro,
    mes: historicoOrcamentos.mes,
    ano: historicoOrcamentos.ano,
  }).from(historicoOrcamentos);

  let total = 0;
  let fechados = 0;
  for (const r of linhas as Array<{ empresa: string | null; status: string | null; dataCadastro: string | null; mes: number; ano: number }>) {
    if (!janelasSet.has(`${r.ano}-${r.mes}`)) continue;
    const empresaKey = normalizeEmpresaKey(r.empresa ?? "");
    if (!empresaKey) continue;
    const dataOrcamento = parseDataFlexivel(r.dataCadastro);
    const primeiraCompra = primeiraCompraPorCliente.get(empresaKey);
    const eraNovoNaData = !primeiraCompra || !dataOrcamento || primeiraCompra >= dataOrcamento;
    if (!eraNovoNaData) continue; // já tinha comprado antes desse orçamento = não era "novo"
    total++;
    if (STATUS_GANHO.has((r.status ?? "").trim().toLowerCase())) fechados++;
  }
  if (total === 0) return null;
  return (fechados / total) * 100;
}

export interface ResultadoProbabilidade {
  probabilidade: number;
  explicacao: string[];
}

const PROB_MIN = 5;
const PROB_MAX = 95;

/**
 * Calcula a probabilidade de fechamento de UMA proposta. Função pura e
 * síncrona — toda a leitura de dados já aconteceu em
 * construirMapaConversaoClientes/calcularTaxaConversaoNovosRecente.
 */
export function calcularProbabilidade(opts: {
  clienteNovo: boolean;
  nomeCliente: string;
  valorProposta: number;
  mapa: MapaConversaoClientes;
  taxaNovosDoMes: number | null;
}): ResultadoProbabilidade {
  const empresaKey = normalizeEmpresaKey(opts.nomeCliente);
  const conversao = empresaKey ? opts.mapa.porCliente.get(empresaKey) : undefined;
  const explicacao: string[] = [];
  let base: number;

  if (opts.clienteNovo && opts.taxaNovosDoMes != null) {
    base = opts.taxaNovosDoMes;
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão média de clientes novos, últimos ${MES_INICIO_JANELA_NOVOS} meses)`);
  } else if (opts.clienteNovo) {
    base = opts.mapa.taxaGeral;
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão geral da carteira — sem orçamentos de clientes novos recentes)`);
  } else if (conversao?.taxaIndividual != null) {
    base = conversao.taxaIndividual;
    explicacao.push(`Base: ${base.toFixed(0)}% (${conversao.orcamentosFechados} de ${conversao.totalOrcamentos} orçamentos fechados deste cliente)`);
  } else {
    base = opts.mapa.taxaGeral;
    const amostra = conversao ? `${conversao.totalOrcamentos} orçamento${conversao.totalOrcamentos === 1 ? "" : "s"}` : "sem histórico suficiente";
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão geral da carteira — ${amostra} deste cliente, amostra pequena demais para taxa individual)`);
  }

  let probabilidade = base;
  const ticketMedio = conversao?.ticketMedio;
  if (!opts.clienteNovo && ticketMedio && ticketMedio > 0 && opts.valorProposta > 0) {
    const ratio = opts.valorProposta / ticketMedio;
    if (ratio > 2) {
      probabilidade -= 20;
      explicacao.push(`Ajuste: -20pp (proposta ${ratio.toFixed(1)}x acima do ticket médio deste cliente)`);
    } else if (ratio > 1) {
      probabilidade -= 10;
      explicacao.push(`Ajuste: -10pp (proposta ${ratio.toFixed(1)}x acima do ticket médio deste cliente)`);
    }
  }

  probabilidade = Math.min(PROB_MAX, Math.max(PROB_MIN, Math.round(probabilidade)));
  return { probabilidade, explicacao };
}
