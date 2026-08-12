/**
 * Paleta única de gráficos. Antes desta sprint cada página tinha o seu
 * próprio array COLORS/CORES com hex quase iguais.
 */

/** Série categórica — use com índice: CHART_COLORS[i % CHART_COLORS.length] */
export const CHART_COLORS = [
  "#3b82f6", // azul
  "#8b5cf6", // roxo
  "#22c55e", // verde
  "#f59e0b", // âmbar
  "#ef4444", // vermelho
  "#0ea5e9", // ciano
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#f97316", // laranja
  "#84cc16", // lima
] as const;

/** Cores semânticas — status, KPIs, badges */
export const STATUS_COLORS = {
  positivo: "#22c55e",
  negativo: "#ef4444",
  atencao: "#f59e0b",
  neutro: "#64748b",
  info: "#3b82f6",
  destaque: "#8b5cf6",
} as const;

export type StatusColor = keyof typeof STATUS_COLORS;

/** Pega a cor da série pelo índice, com wrap-around. */
export function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}
