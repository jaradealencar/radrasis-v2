/**
 * Planejador de meta: transforma o cenário do simulador (os números que precisam valer) numa linha
 * do tempo — "em que mês o faturamento chega na meta?" — e nos marcos mês a mês do plano.
 *
 * Método (simples de propósito, para o dono conseguir conferir a conta):
 *  - "Hoje" é a média dos 12 meses fechados (a mesma referência do painel) e vale para o mês corrente.
 *  - O cenário do simulador é o ponto de chegada. Cada um dos 12 indicadores sobe (ou desce) em
 *    linha reta, do valor de hoje até o valor do cenário, ao longo do PRAZO que o usuário escolhe;
 *    depois do prazo fica estável. O faturamento de cada mês é a mesma fórmula do simulador
 *    (gráficas × pedidos × ticket, somando os 4 grupos) aplicada aos indicadores daquele mês.
 *  - Quanto tempo leva para chegar aos números é uma decisão do usuário (só ele sabe o quanto
 *    consegue acelerar a captação, a recompra...): por isso o prazo é uma entrada, não uma previsão.
 *
 * Fora da conta, de propósito: (1) o efeito das gráficas novas continuarem comprando nos meses
 * seguintes (o simulador trata cada indicador separadamente; ver a aba "Metas comparadas") e
 * (2) a oscilação natural de um mês para o outro, que o gráfico mostra como faixa.
 */

import { SEGMENTOS, CAMPOS_ALAVANCA, totaisCenario, type Cenario, type TotaisCenario } from "./meta-faturamento";

/** Mesma tolerância que o simulador usa para dizer que "a meta fecha". */
export const TOLERANCIA_META = 0.9995;
export const PRAZO_PADRAO_MESES = 6;
export const PRAZO_MAXIMO_MESES = 24;
/** Mínimo de meses mostrados na linha do tempo, mesmo com prazo curto. */
export const HORIZONTE_MINIMO_MESES = 12;

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface MesCalendario {
  ano: number;
  /** 1 a 12. */
  mes: number;
  /** "out/2026". */
  rotulo: string;
}

/** O mês de calendário `k` meses depois do mês da data de referência (k = 0 é o mês corrente). */
export function mesApos(dataReferenciaISO: string, k: number): MesCalendario {
  const d = new Date(dataReferenciaISO);
  const indice = d.getUTCFullYear() * 12 + d.getUTCMonth() + k;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return { ano, mes, rotulo: `${NOMES_MES[mes - 1]}/${ano}` };
}

/** Prazo válido: inteiro entre 1 e o máximo (entradas vindas da tela nem sempre são). */
export function prazoValido(prazoMeses: number): number {
  if (!Number.isFinite(prazoMeses)) return PRAZO_PADRAO_MESES;
  return Math.min(PRAZO_MAXIMO_MESES, Math.max(1, Math.round(prazoMeses)));
}

/** Quantos meses mostrar: o prazo mais uma folga para ver o cenário se estabilizar. */
export function horizonteDaLinhaDoTempo(prazoMeses: number): number {
  return Math.min(PRAZO_MAXIMO_MESES, Math.max(HORIZONTE_MINIMO_MESES, prazoValido(prazoMeses) + 3));
}

/** Cenário a `progresso` (0 = hoje, 1 = cenário final) do caminho entre `base` e `regime`. */
export function interpolarCenario(base: Cenario, regime: Cenario, progresso: number): Cenario {
  const p = Math.min(1, Math.max(0, progresso));
  const saida = {} as Cenario;
  for (const s of SEGMENTOS) {
    const a = { ...base[s] };
    for (const campo of CAMPOS_ALAVANCA) a[campo] = base[s][campo] + (regime[s][campo] - base[s][campo]) * p;
    saida[s] = a;
  }
  return saida;
}

export interface PontoDaLinhaDoTempo {
  /** 0 = mês corrente (números de hoje), 1 = próximo mês... */
  mes: number;
  /** Quanto do caminho já foi percorrido (0 a 1). */
  progresso: number;
  cenario: Cenario;
  totais: TotaisCenario;
}

export function linhaDoTempo(base: Cenario, regime: Cenario, prazoMeses: number, horizonte?: number): PontoDaLinhaDoTempo[] {
  const prazo = prazoValido(prazoMeses);
  const ate = horizonte ?? horizonteDaLinhaDoTempo(prazo);
  const pontos: PontoDaLinhaDoTempo[] = [];
  for (let k = 0; k <= ate; k++) {
    const progresso = Math.min(1, k / prazo);
    const cenario = interpolarCenario(base, regime, progresso);
    pontos.push({ mes: k, progresso, cenario, totais: totaisCenario(cenario) });
  }
  return pontos;
}

/** Primeiro mês (0 = este mês) em que o faturamento previsto alcança a meta; null se não alcança no período. */
export function primeiroMesNaMeta(pontos: Array<{ mes: number; totais: { faturamento: number } }>, meta: number): number | null {
  const ponto = pontos.find(p => p.totais.faturamento >= meta * TOLERANCIA_META);
  return ponto ? ponto.mes : null;
}
