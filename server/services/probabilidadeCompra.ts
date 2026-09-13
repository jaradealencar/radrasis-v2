/**
 * Score de Probabilidade de Compra — Fase 1.
 *
 * Usado por server/routers/crm.ts (cada proposta) e por
 * server/routers/performanceComercial.ts (listarClientesInteligencia, cada
 * cliente) para que os dois módulos mostrem o mesmo número para o mesmo
 * cliente — ver plano de "Score de Probabilidade de Compra no CRM (Fase 1)".
 *
 * Fórmula:
 *   - Cliente novo: base = taxa de conversão dos clientes novos do mês corrente.
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

import { and, eq } from "drizzle-orm";
import { historicoOrcamentos } from "../../drizzle/schema";
import { STATUS_GANHO } from "./inteligenciaClientes";

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

  const resultado = new Map<string, ConversaoCliente>();
  for (const [empresaKey, acc] of porCliente.entries()) {
    resultado.set(empresaKey, {
      totalOrcamentos: acc.total,
      orcamentosFechados: acc.fechados,
      taxaIndividual: acc.total >= MIN_AMOSTRA_TAXA_INDIVIDUAL ? (acc.fechados / acc.total) * 100 : null,
      ticketMedio: acc.qtdComValor > 0 ? acc.somaValor / acc.qtdComValor : null,
    });
  }

  const taxaGeral = totalGeral > 0 ? (fechadosGeral / totalGeral) * 100 : 0;
  return { porCliente: resultado, taxaGeral };
}

/**
 * Taxa de conversão dos orçamentos do mês corrente cujo cliente NÃO está em
 * `clientesComCompra` — mesmo Set que server/routers/crm.ts já constrói a
 * partir de historico_os para decidir o flag `clienteNovo` de cada proposta.
 * Reaproveitar esse Set (em vez de recalcular "cliente novo" com outra
 * regra) mantém a mesma definição de "novo" usada no resto do CRM.
 *
 * Devolve `null` (não `0`) quando ainda não há NENHUM orçamento de cliente
 * novo neste mês (comum no início do mês) — distinção importante: "sem dado
 * ainda" não é o mesmo que "converteu 0%". O chamador cai para a taxa geral
 * da carteira nesse caso (ver calcularProbabilidade).
 */
export async function calcularTaxaConversaoNovosDoMes(db: any, clientesComCompra: Set<string>): Promise<number | null> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const linhas = await db.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
  }).from(historicoOrcamentos).where(
    and(eq(historicoOrcamentos.mes, mes), eq(historicoOrcamentos.ano, ano)),
  );

  let total = 0;
  let fechados = 0;
  for (const r of linhas as Array<{ empresa: string | null; status: string | null }>) {
    const nomeKey = (r.empresa ?? "").toLowerCase().trim();
    if (!nomeKey || clientesComCompra.has(nomeKey)) continue; // já comprou antes = não é "novo"
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
 * construirMapaConversaoClientes/calcularTaxaConversaoNovosDoMes.
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
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão média de clientes novos este mês)`);
  } else if (opts.clienteNovo) {
    base = opts.mapa.taxaGeral;
    explicacao.push(`Base: ${base.toFixed(0)}% (conversão geral da carteira — ainda não há orçamentos de clientes novos este mês)`);
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
