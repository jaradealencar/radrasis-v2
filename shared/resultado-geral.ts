/**
 * Fórmulas da aba "Resultado Geral e Ponto de Equilíbrio" (painel "Crescimento
 * e Resultado"). Isomórfico (client + server), mesmo padrão de
 * shared/marketing-financeiro.ts — funções puras, sem I/O.
 *
 * Regra central: a ponte de resultado consolidada usa sempre os valores REAIS
 * de financeiro_mensal (faturamentoOficial, despesasFixas, despesasVariaveis
 * etc.) — nunca os totais de dre_mensal, que são SOMAS/RATEIOS por pedido
 * (historico_os.custoFixo já rateado pelo ERP) e servem só para análises
 * gerenciais por pedido/vendedor. Ver server/scripts/backfill-dre-mensal.ts e
 * a nota "Parte 2 — Contexto adicional" do plano de implementação.
 */

import { round2, safeDiv, pctSobre } from "./marketing-financeiro";

// ─── Ponto de equilíbrio ──────────────────────────────────────────────────

export interface PontoEquilibrio {
  /** (custosFixos + investimentoMarketing) / margemContribuicaoPct. null se
   * margemContribuicaoPct for nula, zero ou negativa (guard — nesse caso não
   * existe ponto de equilíbrio finito: cada real vendido não cobre nem seu
   * próprio custo variável). */
  pontoEquilibrio: number | null;
  /** (faturamentoLiquido - pontoEquilibrio) / faturamentoLiquido × 100. */
  margemSegurancaPct: number | null;
  /** faturamentoLiquido - pontoEquilibrio (positivo = acima do equilíbrio). */
  distanciaAoEquilibrio: number | null;
  /** pontoEquilibrio / ticketMedio — nº de pedidos estimados para o equilíbrio. */
  pedidosParaEquilibrio: number | null;
}

/** `margemContribuicaoPct` deve estar em fração (0.30 = 30%), não em pontos
 * percentuais — evita confusão de escala com custosFixos/investimentoMarketing
 * (que estão em R$). */
export function calcularPontoEquilibrio(
  custosFixos: number | null,
  investimentoMarketing: number | null,
  margemContribuicaoPct: number | null,
  faturamentoLiquido: number | null,
  ticketMedio: number | null,
): PontoEquilibrio {
  if (custosFixos == null || margemContribuicaoPct == null || margemContribuicaoPct <= 0) {
    return { pontoEquilibrio: null, margemSegurancaPct: null, distanciaAoEquilibrio: null, pedidosParaEquilibrio: null };
  }
  const custoTotal = custosFixos + (investimentoMarketing ?? 0);
  const pontoEquilibrio = round2(custoTotal / margemContribuicaoPct);

  const distanciaAoEquilibrio = faturamentoLiquido == null ? null : round2(faturamentoLiquido - pontoEquilibrio);
  const margemSegurancaPct = faturamentoLiquido == null || faturamentoLiquido === 0
    ? null
    : pctSobre(distanciaAoEquilibrio, faturamentoLiquido);
  const pedidosParaEquilibrio = ticketMedio == null || ticketMedio <= 0 ? null : Math.ceil(pontoEquilibrio / ticketMedio);

  return { pontoEquilibrio, margemSegurancaPct, distanciaAoEquilibrio, pedidosParaEquilibrio };
}

// ─── Margem-meta (administrativa) vs. margem real ────────────────────────────

export interface DesvioMargem {
  margemMetaPct: number;
  margemRealPct: number | null;
  /** margemRealPct - margemMetaPct, em pontos percentuais. */
  desvioPontosPct: number | null;
  /** faturamentoLiquido × (margemReal - margemMeta), em R$. Positivo = a
   * margem real superou a meta; negativo = ficou abaixo. */
  impactoFinanceiro: number | null;
}

/** `margemMetaPct`/`margemRealPct` em fração (0.51 = 51%). */
export function calcularDesvioMargem(margemMetaPct: number, margemRealPct: number | null, faturamentoLiquido: number | null): DesvioMargem {
  if (margemRealPct == null) {
    return { margemMetaPct, margemRealPct: null, desvioPontosPct: null, impactoFinanceiro: null };
  }
  const desvioPontosPct = round2((margemRealPct - margemMetaPct) * 100);
  const impactoFinanceiro = faturamentoLiquido == null ? null : round2(faturamentoLiquido * (margemRealPct - margemMetaPct));
  return { margemMetaPct, margemRealPct, desvioPontosPct, impactoFinanceiro };
}

// ─── Ponte de resultado gerencial (bridge) ───────────────────────────────────

export type SeloValor = "real" | "rateado" | "estimado";

export interface LinhaPonte {
  label: string;
  valor: number | null;
  selo: SeloValor;
}

export interface PonteResultado {
  faturamentoBruto: number | null;
  /** Linha informativa — soma de valorOs de O.S. com status "Cancelada" no
   * período. NÃO é subtraída de faturamentoLiquido (que já vem líquido de
   * cancelamentos em financeiro_mensal.faturamentoOficial) — mostrada só para
   * visibilidade, rotulada como informativa. */
  cancelamentosInformativo: number | null;
  faturamentoLiquido: number | null;
  custosVariaveis: number | null;
  margemContribuicao: number | null;
  margemContribuicaoPct: number | null;
  investimentoMarketing: number | null;
  contribuicaoAposMarketing: number | null;
  custosFixos: number | null;
  resultadoOperacional: number | null;
  despesasFinanceiras: number | null;
  resultadoNaoOperacional: number | null;
  resultadoFinal: number | null;
}

export interface InsumoPonte {
  faturamentoBruto: number | null;
  cancelamentosInformativo: number | null;
  faturamentoLiquido: number | null;
  custosVariaveis: number | null;
  investimentoMarketing: number | null;
  custosFixos: number | null;
  despesasFinanceiras: number | null;
  despesasNaoOperacionais: number | null;
  receitasNaoOperacionais: number | null;
}

/** Monta a ponte completa: bruto → cancelamentos (informativo) → líquido →
 * custos variáveis → margem de contribuição → marketing → contribuição após
 * marketing → custos fixos → resultado operacional → financeiras/não-
 * operacionais → resultado final. Nenhuma etapa conta a mesma despesa 2x —
 * ver `custosFinanceirosIncluemMarketing` no chamador (server/routers) para a
 * decisão de subtrair ou não o marketing separado dos custos fixos. */
export function montarPonteResultado(insumo: InsumoPonte): PonteResultado {
  const custosVariaveis = insumo.custosVariaveis;
  const margemContribuicao = insumo.faturamentoLiquido != null && custosVariaveis != null
    ? round2(insumo.faturamentoLiquido - custosVariaveis) : null;
  const margemContribuicaoPct = margemContribuicao == null ? null
    : safeDiv(margemContribuicao, insumo.faturamentoLiquido);

  const contribuicaoAposMarketing = margemContribuicao == null ? null
    : round2(margemContribuicao - (insumo.investimentoMarketing ?? 0));

  const resultadoOperacional = contribuicaoAposMarketing == null || insumo.custosFixos == null ? null
    : round2(contribuicaoAposMarketing - insumo.custosFixos);

  const resultadoNaoOperacional = (insumo.receitasNaoOperacionais ?? insumo.despesasNaoOperacionais) == null ? null
    : round2((insumo.receitasNaoOperacionais ?? 0) - (insumo.despesasNaoOperacionais ?? 0));

  const resultadoFinal = resultadoOperacional == null ? null
    : round2(resultadoOperacional - (insumo.despesasFinanceiras ?? 0) + (resultadoNaoOperacional ?? 0));

  return {
    faturamentoBruto: insumo.faturamentoBruto,
    cancelamentosInformativo: insumo.cancelamentosInformativo,
    faturamentoLiquido: insumo.faturamentoLiquido,
    custosVariaveis,
    margemContribuicao,
    margemContribuicaoPct,
    investimentoMarketing: insumo.investimentoMarketing,
    contribuicaoAposMarketing,
    custosFixos: insumo.custosFixos,
    resultadoOperacional,
    despesasFinanceiras: insumo.despesasFinanceiras,
    resultadoNaoOperacional,
    resultadoFinal,
  };
}

// ─── Indicadores por pedido / por funcionário ────────────────────────────────

/** custosFixos / qtdPedidos — nulo se não houver pedidos (evita divisão por zero). */
export function custoFixoMedioPorPedido(custosFixos: number | null, qtdPedidos: number): number | null {
  const r = safeDiv(custosFixos, qtdPedidos);
  return r == null ? null : round2(r);
}

export function resultadoMedioPorPedido(resultado: number | null, qtdPedidos: number): number | null {
  const r = safeDiv(resultado, qtdPedidos);
  return r == null ? null : round2(r);
}

/** Indicadores "por funcionário" — condicionados a `numColaboradores` estar
 * preenchido (financeiro_mensal.numColaboradores). Nunca hardcodar uma
 * contagem de funcionários no código — se o campo estiver vazio, todos os
 * indicadores desta função retornam null (UI deve mostrar "Dados não
 * disponíveis — preencha o número de colaboradores em Dados Mensais"). */
export interface IndicadoresPorFuncionario {
  faturamentoPorFuncionario: number | null;
  margemPorFuncionario: number | null;
  resultadoPorFuncionario: number | null;
}
export function calcularIndicadoresPorFuncionario(
  faturamentoLiquido: number | null,
  margemContribuicao: number | null,
  resultado: number | null,
  numColaboradores: number | null | undefined,
): IndicadoresPorFuncionario {
  if (!numColaboradores || numColaboradores <= 0) {
    return { faturamentoPorFuncionario: null, margemPorFuncionario: null, resultadoPorFuncionario: null };
  }
  return {
    faturamentoPorFuncionario: faturamentoLiquido == null ? null : round2(faturamentoLiquido / numColaboradores),
    margemPorFuncionario: margemContribuicao == null ? null : round2(margemContribuicao / numColaboradores),
    resultadoPorFuncionario: resultado == null ? null : round2(resultado / numColaboradores),
  };
}

// ─── Rateio de custo fixo (gerencial, nunca substitui o total real) ────────

export type DirecionadorRateio = "pedidos" | "faturamento" | "custo_direto" | "rateio_erp" | "personalizado";

export interface DimensaoRateio {
  chave: string;
  /** Valor do direcionador para esta dimensão (ex.: nº de pedidos do
   * vendedor, ou faturamento do vendedor) — usado para ratear
   * proporcionalmente. Para "rateio_erp", ignorar este campo e usar
   * `valorJaRateado` diretamente (o ERP já calculou por pedido). */
  valorDirecionador: number;
  /** Só usado quando direcionador === "rateio_erp": soma de
   * historico_os.custoFixo já rateado pelo ERP para esta dimensão. */
  valorJaRateado?: number;
}

/** Rateia `custosFixosTotais` entre dimensões (ex.: vendedores) proporcional
 * ao direcionador escolhido. Sempre rotulado "Rateado" no chamador — nunca
 * deve substituir o custo fixo real total da empresa em nenhum lugar da
 * ponte consolidada, só em análises gerenciais por dimensão. Quando não há
 * direcionador confiável (soma zero), retorna null para todas as dimensões
 * em vez de dividir por zero ou ratear igualmente sem aviso. */
export function ratearCustoFixo(
  custosFixosTotais: number,
  direcionador: DirecionadorRateio,
  dimensoes: DimensaoRateio[],
): Record<string, number | null> {
  const resultado: Record<string, number | null> = {};

  if (direcionador === "rateio_erp") {
    for (const d of dimensoes) resultado[d.chave] = d.valorJaRateado != null ? round2(d.valorJaRateado) : null;
    return resultado;
  }

  const somaDirecionador = dimensoes.reduce((s, d) => s + d.valorDirecionador, 0);
  if (somaDirecionador <= 0) {
    for (const d of dimensoes) resultado[d.chave] = null;
    return resultado;
  }
  for (const d of dimensoes) {
    resultado[d.chave] = round2(custosFixosTotais * (d.valorDirecionador / somaDirecionador));
  }
  return resultado;
}
