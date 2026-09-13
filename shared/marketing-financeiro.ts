/**
 * Fórmulas do relatório de Marketing/Clientes ("Crescimento e Resultado").
 * Isomórfico (client + server): funções puras, sem I/O — a mesma fonte de
 * verdade usada pelo backend (payload "ano inteiro") e pelo client (recálculo
 * local ao trocar filtro de mês/vendedor/cidade), para nunca divergir.
 *
 * Regra central: CAC/custo de reativação/ROI são sempre PONDERADOS (soma dos
 * totais do período, dividida no fim) — nunca a média simples das razões
 * mensais, que distorce o resultado a favor/contra meses com pouco volume.
 * Ver client/src/pages/financeiro/MarketingFinanceiro.tsx (versão anterior)
 * para o problema que isso corrige: ali o CAC do card "CAC de Aquisição" era
 * a média dos CAC mensais, não investimentoTotal/clientesTotal.
 */

// ─── Guards numéricos ────────────────────────────────────────────────────────

/** Arredondamento monetário padrão (2 casas), evitando erro de ponto flutuante
 * do tipo 0.1 + 0.2 !== 0.3. */
export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Divisão segura: retorna null (nunca NaN/Infinity) quando o divisor é nulo,
 * indefinido, zero ou o dividendo é nulo/indefinido. */
export function safeDiv(dividendo: number | null | undefined, divisor: number | null | undefined): number | null {
  if (dividendo == null || divisor == null || divisor === 0 || !isFinite(dividendo) || !isFinite(divisor)) return null;
  const r = dividendo / divisor;
  return isFinite(r) ? r : null;
}

/** Soma uma lista de valores nullable: null se TODOS forem null (nada
 * preenchido no período), senão soma tratando null individual como 0 (mês sem
 * preenchimento não deve "sumir" um total que outros meses já preencheram). */
export function somarOuNull(valores: Array<number | null | undefined>): number | null {
  if (valores.every(v => v == null)) return null;
  return round2(valores.reduce((s: number, v) => s + (v ?? 0), 0));
}

/** Percentual de `parte` sobre `base`, em pontos percentuais (0-100), com o
 * mesmo guard de `safeDiv`. */
export function pctSobre(parte: number | null | undefined, base: number | null | undefined): number | null {
  const r = safeDiv(parte ?? null, base ?? null);
  return r == null ? null : round2(r * 100);
}

// ─── CAC / Custo de Reativação ponderados ────────────────────────────────────

/** CAC ponderado = investimento total em aquisição ÷ total de clientes novos
 * do mesmo período. Nunca a média dos CACs mensais. */
export function cacPonderado(investimentoTotalAquisicao: number | null, clientesNovosTotal: number): number | null {
  const r = safeDiv(investimentoTotalAquisicao, clientesNovosTotal);
  return r == null ? null : round2(r);
}

/** Custo de reativação ponderado = investimento total em reativação ÷ total
 * de EVENTOS de reativação do período (não clientes únicos) — o investimento
 * se destina a tentativas de reativar, que podem reativar o mesmo cliente
 * mais de uma vez no período. "Clientes únicos reativados" é exposto à parte,
 * só como contexto informativo, nunca como denominador deste cálculo. */
export function custoReativacaoPonderado(investimentoTotalReativacao: number | null, eventosReativacaoTotal: number): number | null {
  const r = safeDiv(investimentoTotalReativacao, eventosReativacaoTotal);
  return r == null ? null : round2(r);
}

// ─── Margem de contribuição: real por pedido vs. estimada (fallback) ────────

export type OrigemMargem = "real" | "estimada" | "mista" | "sem-dado";

export interface PedidoParaMargem {
  valorOs: number;
  /** historico_os.contribuicaoReais — null/undefined quando o pedido não tem
   * custo detalhado (raro: ~0,03% da base em 2023-2026). */
  contribuicaoReais: number | null | undefined;
}

/** Margem de um pedido: usa contribuicaoReais quando disponível (método
 * primário); cai para `valorOs * percentualMargemFallback/100` só quando
 * ausente. Retorna também a origem, para poder exibir o selo "Real"/"Estimado"
 * por pedido e agregado. */
export function margemDoPedido(pedido: PedidoParaMargem, percentualMargemFallback: number): { valor: number; origem: "real" | "estimada" } {
  if (pedido.contribuicaoReais != null) {
    return { valor: pedido.contribuicaoReais, origem: "real" };
  }
  return { valor: round2(pedido.valorOs * (percentualMargemFallback / 100)), origem: "estimada" };
}

export interface MargemAgregada {
  margemTotal: number;
  origem: OrigemMargem;
  /** % dos pedidos (por quantidade) cuja margem veio do dado real do ERP,
   * não do fallback percentual. */
  pctPedidosComMargemReal: number | null;
  qtdPedidos: number;
}

/** Agrega a margem de um grupo de pedidos (ex.: todos os pedidos de clientes
 * novos no mês), já classificando a origem do agregado: "real" só se TODOS os
 * pedidos tiverem margem real, "estimada" só se NENHUM tiver, "mista" caso
 * contrário, "sem-dado" se a lista estiver vazia. */
export function agregarMargem(pedidos: PedidoParaMargem[], percentualMargemFallback: number): MargemAgregada {
  if (pedidos.length === 0) {
    return { margemTotal: 0, origem: "sem-dado", pctPedidosComMargemReal: null, qtdPedidos: 0 };
  }
  let margemTotal = 0;
  let qtdReal = 0;
  for (const p of pedidos) {
    const m = margemDoPedido(p, percentualMargemFallback);
    margemTotal += m.valor;
    if (m.origem === "real") qtdReal++;
  }
  const origem: OrigemMargem = qtdReal === pedidos.length ? "real" : qtdReal === 0 ? "estimada" : "mista";
  return {
    margemTotal: round2(margemTotal),
    origem,
    pctPedidosComMargemReal: round2((qtdReal / pedidos.length) * 100),
    qtdPedidos: pedidos.length,
  };
}

// ─── Agregação de linhas classificadas (novo/recorrente/reativado/etc.) ─────
// Usada tanto pelo backend (server/services/marketingFinanceiroClientes.ts,
// agregarMes) quanto pelo client (ao aplicar filtros de vendedor/cidade sobre
// as linhas já buscadas via getDetalhamentoPedidos) — única implementação,
// para nunca haver duas fórmulas de agregação divergentes.

export interface LinhaClassificavel {
  clienteKey: string;
  valorOs: number;
  contribuicaoReais: number | null;
}

export interface AgregadoCategoria {
  qtdOs: number;
  qtdClientesUnicos: number;
  faturamento: number;
  margem: MargemAgregada;
}

export function agregarLinhas(linhas: LinhaClassificavel[], percentualMargemFallback: number): AgregadoCategoria {
  const clientesUnicos = new Set(linhas.map(l => l.clienteKey).filter(k => k));
  return {
    qtdOs: linhas.length,
    qtdClientesUnicos: clientesUnicos.size,
    faturamento: round2(linhas.reduce((s, l) => s + l.valorOs, 0)),
    margem: agregarMargem(linhas.map(l => ({ valorOs: l.valorOs, contribuicaoReais: l.contribuicaoReais })), percentualMargemFallback),
  };
}

// ─── Resultado / ROI / ROAS por grupo e consolidado ──────────────────────────

export interface ResultadoGrupo {
  investimento: number | null;
  margemContribuicao: number;
  faturamento: number;
  /** margemContribuicao - investimento. null quando investimento não foi
   * preenchido (nunca confundir "não preenchido" com 0). */
  resultado: number | null;
  /** (resultado / investimento) × 100. */
  roiPct: number | null;
  /** faturamento / investimento — expresso como razão (2.5 = "2,5x" ou 250%),
   * não confundir com ROI: ROAS ignora custo, é bruto sobre investimento. */
  roas: number | null;
}

export function calcularResultadoGrupo(investimento: number | null, margemContribuicao: number, faturamento: number): ResultadoGrupo {
  const resultado = investimento == null ? null : round2(margemContribuicao - investimento);
  const roiPct = investimento == null ? null : pctSobre(resultado, investimento);
  const roas = investimento == null ? null : (() => {
    const r = safeDiv(faturamento, investimento);
    return r == null ? null : round2(r * 100) / 100; // mantém como razão (ex.: 2.5), 2 casas
  })();
  return { investimento, margemContribuicao, faturamento, resultado, roiPct, roas };
}

/** Resultado consolidado = margem de todos os grupos somada, menos o
 * investimento total. ROI consolidado = resultado consolidado ÷ investimento
 * total × 100. Aceita quantos grupos forem passados (ex.: novos + reativados,
 * ou novos + recorrentes ativos + reativados). */
export function calcularResultadoConsolidado(grupos: Array<{ investimento: number | null; margemContribuicao: number }>): ResultadoGrupo {
  const investimentoTotal = grupos.every(g => g.investimento == null) ? null : grupos.reduce((s, g) => s + (g.investimento ?? 0), 0);
  const margemTotal = round2(grupos.reduce((s, g) => s + g.margemContribuicao, 0));
  const resultado = investimentoTotal == null ? null : round2(margemTotal - investimentoTotal);
  const roiPct = investimentoTotal == null ? null : pctSobre(resultado, investimentoTotal);
  return { investimento: investimentoTotal, margemContribuicao: margemTotal, faturamento: margemTotal, resultado, roiPct, roas: null };
}

// ─── Mediana / outliers / concentração ───────────────────────────────────────

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 !== 0 ? ord[meio] : round2((ord[meio - 1] + ord[meio]) / 2);
}

/** Participação dos `n` maiores valores na soma total (0-100). Não exclui
 * outliers automaticamente — só sinaliza a influência deles, por pedido do
 * usuário ("não excluir outliers automaticamente, apenas sinalizar"). */
export function participacaoTopN(valores: number[], n: number): number | null {
  if (valores.length === 0) return null;
  const total = valores.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const topN = [...valores].sort((a, b) => b - a).slice(0, n).reduce((s, v) => s + v, 0);
  return round2((topN / total) * 100);
}

// ─── Semáforo (metas configuráveis) ──────────────────────────────────────────

export type NivelSemaforo = "verde" | "amarelo" | "vermelho" | "sem-meta";

/** Semáforo para métricas "quanto menor melhor" com um teto configurado (ex.:
 * CAC máximo, custo de reativação máximo). `margemAmarelaPct` é a folga acima
 * do teto que ainda conta como alerta (amarelo) antes de virar vermelho. */
export function avaliarSemaforoTeto(valor: number | null, metaMax: number | null | undefined, margemAmarelaPct = 15): NivelSemaforo {
  if (metaMax == null) return "sem-meta";
  if (valor == null) return "sem-meta";
  if (valor <= metaMax) return "verde";
  if (valor <= metaMax * (1 + margemAmarelaPct / 100)) return "amarelo";
  return "vermelho";
}

/** Semáforo para métricas "quanto maior melhor" com um piso configurado (ex.:
 * ROI mínimo, ticket médio mínimo). */
export function avaliarSemaforoPiso(valor: number | null, metaMin: number | null | undefined, margemAmarelaPct = 15): NivelSemaforo {
  if (metaMin == null) return "sem-meta";
  if (valor == null) return "sem-meta";
  if (valor >= metaMin) return "verde";
  if (valor >= metaMin * (1 - margemAmarelaPct / 100)) return "amarelo";
  return "vermelho";
}

// ─── Conciliação (novo + recorrente ativo + reativado + não-classificado) ───

export interface ConciliacaoResultado {
  totalReferencia: number;
  somaCategorias: number;
  divergencia: number;
  divergenciaPct: number | null;
  /** true quando a divergência é só arredondamento (≤ R$ 0,05). */
  conciliado: boolean;
}

/** Confere que a soma das categorias (ex.: faturamento novo + recorrente
 * ativo + reativado + não-classificado) bate com um total de referência
 * independente (ex.: soma de todas as O.S. válidas do mês). Tolerância de
 * R$ 0,05 para absorver arredondamento monetário acumulado — acima disso é
 * reportado como divergência real, nunca escondido. */
export function conciliar(totalReferencia: number, valoresPorCategoria: number[]): ConciliacaoResultado {
  const somaCategorias = round2(valoresPorCategoria.reduce((s, v) => s + v, 0));
  const divergencia = round2(totalReferencia - somaCategorias);
  return {
    totalReferencia: round2(totalReferencia),
    somaCategorias,
    divergencia,
    divergenciaPct: pctSobre(divergencia, totalReferencia),
    conciliado: Math.abs(divergencia) <= 0.05,
  };
}
