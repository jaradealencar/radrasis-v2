import { format as formatDateFns, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formatadores compartilhados (pt-BR).
 * Antes desta sprint cada página tinha sua própria versão destas funções.
 */

/** R$ 1.234,56 */
export function fmtBrl(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** R$ 1,2 mi / R$ 34,5 mil / R$ 123 — para eixos de gráfico e KPIs apertados */
export function fmtBrlCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${v.toFixed(0)}`;
}

/** 1.234 (inteiro) ou 1.234,5 com casas */
export function fmtNum(v: number | null | undefined, casas = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** 12,3% — recebe o número já em escala de percentual (12.3, não 0.123) */
export function fmtPct(v: number | null | undefined, casas = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** parte / total em percentual, protegido contra divisão por zero */
export function pct(parte: number | null | undefined, total: number | null | undefined): number {
  if (!total || !parte) return 0;
  return (parte / total) * 100;
}

/** 31/12/2025 */
export function fmtDate(d: Date | string | number | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (!isValid(date)) return "—";
  return formatDateFns(date, "dd/MM/yyyy", { locale: ptBR });
}

/** 31/12/2025 14:30 */
export function fmtDateTime(d: Date | string | number | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (!isValid(date)) return "—";
  return formatDateFns(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** 31/12 — para eixo de gráfico */
export function fmtDateShort(d: Date | string | number | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (!isValid(date)) return "—";
  return formatDateFns(date, "dd/MM", { locale: ptBR });
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;
