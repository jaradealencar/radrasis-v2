/**
 * Ritmo diário da meta comercial: quanto da meta mensal "deveria" já ter sido
 * atingido até hoje, para comparar com o realizado acumulado e acompanhar o
 * prognóstico do mês dia a dia (não só no fechamento). Isomórfico
 * (client+server), sem I/O.
 *
 * O rateio é por DIA ÚTIL (com feriados nacionais, via
 * shared/feriados-nacionais.ts), não por dia corrido — pedidos concentram em
 * dia útil neste negócio.
 */

import { ehDiaUtilComFeriados } from "./feriados-nacionais";

export interface DiasUteisDoMes {
  totalDiasUteis: number;
  diasUteisDecorridos: number;
}

/** Dias úteis (com feriados nacionais) do mês inteiro e quantos já se passaram até `hoje`
 * (hoje incluso, se hoje for dia útil). Mês inteiramente no passado conta como decorrido por
 * completo; mês no futuro conta como não decorrido. */
export function diasUteisDoMes(ano: number, mes: number, hoje: Date = new Date()): DiasUteisDoMes {
  const lastDay = new Date(ano, mes, 0).getDate();
  const mesEhPassado = hoje.getFullYear() > ano || (hoje.getFullYear() === ano && hoje.getMonth() + 1 > mes);
  const mesEhFuturo = hoje.getFullYear() < ano || (hoje.getFullYear() === ano && hoje.getMonth() + 1 < mes);
  const hojeDia = hoje.getDate();

  let totalDiasUteis = 0;
  let diasUteisDecorridos = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (!ehDiaUtilComFeriados(new Date(ano, mes - 1, d))) continue;
    totalDiasUteis++;
    if (mesEhPassado || (!mesEhFuturo && d <= hojeDia)) diasUteisDecorridos++;
  }
  return { totalDiasUteis, diasUteisDecorridos };
}

export type TipoIndicadorRitmo = "acumulativo" | "taxa";

/** Meta esperada até hoje. "acumulativo" (contagens/valores que somam ao longo do mês —
 * Cotações, Vendas, Faturamento, Clientes Novos) rateia linearmente a meta mensal pelos dias
 * úteis já decorridos. "taxa" (razões/médias — Taxa de Conversão, Taxa de Faturamento, Ticket
 * Médio) NÃO rateia: o esperado é sempre a meta mensal cheia, porque uma média/razão não
 * "acumula" progressivamente ao longo do mês (não faz sentido esperar 1/3 do ticket médio no
 * primeiro terço do mês). Retorna null se `metaMensal` for null/undefined ou o mês não tiver
 * nenhum dia útil (defensivo — não deveria ocorrer num mês real). */
export function metaEsperadaAteHoje(
  metaMensal: number | null | undefined,
  tipo: TipoIndicadorRitmo,
  ano: number,
  mes: number,
  hoje: Date = new Date(),
): number | null {
  if (metaMensal == null || !Number.isFinite(metaMensal)) return null;
  if (tipo === "taxa") return metaMensal;
  const { totalDiasUteis, diasUteisDecorridos } = diasUteisDoMes(ano, mes, hoje);
  if (totalDiasUteis === 0) return null;
  return metaMensal * (diasUteisDecorridos / totalDiasUteis);
}

/** true só quando mes/ano é o mês corrente relativo a `hoje` — a curva de ritmo diário só faz
 * sentido para o mês em andamento (mês fechado não tem "prognóstico" a acompanhar; mês futuro
 * ainda não tem realizado). */
export function ehMesCorrente(mes: number, ano: number, hoje: Date = new Date()): boolean {
  return hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;
}

/** Itens com `data` (formato "YYYY-MM-DD") até `dataCorteISO` inclusive — comparação
 * lexicográfica, que funciona corretamente nesse formato. Usado para acumular indicadores de
 * "Clientes Novos" até hoje a partir de uma lista já carregada, sem precisar de nova busca. */
export function filtrarAteData<T extends { data?: string | null }>(itens: T[], dataCorteISO: string): T[] {
  return itens.filter(item => typeof item.data === "string" && item.data.length > 0 && item.data <= dataCorteISO);
}
