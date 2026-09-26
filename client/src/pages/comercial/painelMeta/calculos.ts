import {
  SEGMENTOS, totaisCenario, resolverMeta, dividirFunil, sensibilidadesDoPainel,
  type Cenario, type TotaisCenario, type Sensibilidade,
} from "@shared/meta-faturamento";
import type { PainelMetaDados } from "./tipos";

export function parceirosAtivos(c: Cenario): number {
  return SEGMENTOS.reduce((soma, s) => soma + c[s].clientes, 0);
}

/** Lucro estimado pela regressão do Financeiro (lucro × faturamento); null sem dados suficientes. */
export function lucroEstimado(economia: PainelMetaDados["economia"], faturamento: number): number | null {
  return economia ? economia.intercepto + economia.inclinacao * faturamento : null;
}

export interface CanalReceita { id: "novos" | "reativados" | "baseRetida"; rotulo: string; valor: number; pct: number }

/** Os 3 canais de entrada do faturamento: parceiros novos, reativados e base retida (recompra + carteira). */
export function canaisDeReceita(totais: TotaisCenario): CanalReceita[] {
  const novos = totais.porSegmento.novos.faturamento;
  const reativados = totais.porSegmento.reativados.faturamento;
  const baseRetida = totais.porSegmento.recompraConquistados.faturamento + totais.porSegmento.carteira.faturamento;
  const total = novos + reativados + baseRetida;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return [
    { id: "novos", rotulo: "Parceiros novos (1ª compra)", valor: novos, pct: pct(novos) },
    { id: "reativados", rotulo: "Parceiros reativados", valor: reativados, pct: pct(reativados) },
    { id: "baseRetida", rotulo: "Base retida (recompra + carteira)", valor: baseRetida, pct: pct(baseRetida) },
  ];
}

export interface LinhaComparativa {
  id: string;
  grupo: "Funil de orçamentos" | "Parceiros (gráficas)" | "Resultado";
  rotulo: string;
  unidade: "numero" | "pct" | "brl";
  casas: number;
  atual: number | null;
  meta1: number | null;
  meta2: number | null;
  /** Explica de onde vem o número (aparece em texto pequeno). */
  nota?: string;
}

export function montarComparativo(
  data: PainelMetaDados,
  meta1: number,
  meta2: number,
  pesoConversao: number,
  margemPct: number,
): LinhaComparativa[] {
  const base = data.media12m.cenario;
  const totaisAtual = totaisCenario(base);
  const r1 = resolverMeta(base, {}, meta1);
  const r2 = resolverMeta(base, {}, meta2);
  const funilAtual = { leadsPorMes: data.funil.leadsPorMes, conversaoPct: data.funil.conversaoPct };
  const f1 = dividirFunil(totaisAtual.vendas, r1.totais.vendas, funilAtual, pesoConversao);
  const f2 = dividirFunil(totaisAtual.vendas, r2.totais.vendas, funilAtual, pesoConversao);

  const ativosBase = base.recompraConquistados.clientes + base.carteira.clientes;
  const retencaoImplicita = (c: Cenario): number | null => {
    if (data.retencao.taxaPct === null || ativosBase <= 0) return null;
    return Math.min(100, data.retencao.taxaPct * ((c.recompraConquistados.clientes + c.carteira.clientes) / ativosBase));
  };
  const contrib = (fat: number) => fat * (margemPct / 100);

  const linha = (l: Omit<LinhaComparativa, "casas"> & { casas?: number }): LinhaComparativa => ({ casas: 0, ...l });
  return [
    linha({ id: "leads", grupo: "Funil de orçamentos", rotulo: "Orçamentos recebidos por mês", unidade: "numero", atual: funilAtual.leadsPorMes, meta1: f1.leads, meta2: f2.leads, nota: "O aumento de vendas é dividido entre orçamentos e conversão (ajustável)." }),
    linha({ id: "conversao", grupo: "Funil de orçamentos", rotulo: "Taxa de conversão de orçamentos", unidade: "pct", casas: 1, atual: funilAtual.conversaoPct, meta1: f1.conversaoPct, meta2: f2.conversaoPct, nota: "Orçamentos em aberto e vencidos contam como perdidos." }),
    linha({ id: "vendas", grupo: "Funil de orçamentos", rotulo: "Número total de pedidos por mês", unidade: "numero", atual: totaisAtual.vendas, meta1: r1.totais.vendas, meta2: r2.totais.vendas }),
    linha({ id: "ticket", grupo: "Funil de orçamentos", rotulo: "Ticket médio geral por pedido", unidade: "brl", atual: totaisAtual.ticketMedio, meta1: r1.totais.ticketMedio, meta2: r2.totais.ticketMedio }),
    linha({ id: "novos", grupo: "Parceiros (gráficas)", rotulo: "Novas gráficas atraídas por mês", unidade: "numero", casas: 1, atual: base.novos.clientes, meta1: r1.cenario.novos.clientes, meta2: r2.cenario.novos.clientes }),
    linha({ id: "reativados", grupo: "Parceiros (gráficas)", rotulo: "Parceiros reativados por mês", unidade: "numero", casas: 1, atual: base.reativados.clientes, meta1: r1.cenario.reativados.clientes, meta2: r2.cenario.reativados.clientes, nota: "Voltaram depois de 6 meses ou mais sem comprar." }),
    linha({ id: "recompra", grupo: "Parceiros (gráficas)", rotulo: "Recompra de gráficas conquistadas (por mês)", unidade: "numero", casas: 1, atual: base.recompraConquistados.clientes, meta1: r1.cenario.recompraConquistados.clientes, meta2: r2.cenario.recompraConquistados.clientes, nota: "Novas ou reativadas dos últimos 12 meses que compraram de novo." }),
    linha({ id: "carteira", grupo: "Parceiros (gráficas)", rotulo: "Gráficas ativas da carteira (por mês)", unidade: "numero", casas: 1, atual: base.carteira.clientes, meta1: r1.cenario.carteira.clientes, meta2: r2.cenario.carteira.clientes }),
    linha({ id: "retencao", grupo: "Parceiros (gráficas)", rotulo: "Retenção anual da base (implícita)", unidade: "pct", casas: 1, atual: data.retencao.taxaPct, meta1: retencaoImplicita(r1.cenario), meta2: retencaoImplicita(r2.cenario), nota: "Aproximação: acompanha o crescimento das gráficas que já compravam." }),
    linha({ id: "faturamento", grupo: "Resultado", rotulo: "Faturamento por mês", unidade: "brl", atual: totaisAtual.faturamento, meta1: r1.totais.faturamento, meta2: r2.totais.faturamento }),
    linha({ id: "margem", grupo: "Resultado", rotulo: "Margem de contribuição", unidade: "pct", casas: 1, atual: margemPct, meta1: margemPct, meta2: margemPct, nota: "Mantida no nível atual (ajustável no simulador)." }),
    linha({ id: "contribuicao", grupo: "Resultado", rotulo: "Contribuição por mês", unidade: "brl", atual: contrib(totaisAtual.faturamento), meta1: contrib(r1.totais.faturamento), meta2: contrib(r2.totais.faturamento) }),
    ...(data.economia
      ? [linha({ id: "lucro", grupo: "Resultado", rotulo: "Lucro estimado por mês", unidade: "brl", atual: lucroEstimado(data.economia, totaisAtual.faturamento), meta1: lucroEstimado(data.economia, r1.totais.faturamento), meta2: lucroEstimado(data.economia, r2.totais.faturamento), nota: "Estimativa pela relação histórica entre faturamento e lucro no Financeiro." })]
      : []),
  ];
}

export type { Sensibilidade };

/** Quanto cada movimento pequeno vale por mês (cálculo no módulo compartilhado, igual ao usado pelo consultor de IA). */
export function calcularSensibilidades(data: PainelMetaDados): Sensibilidade[] {
  return sensibilidadesDoPainel(data);
}
