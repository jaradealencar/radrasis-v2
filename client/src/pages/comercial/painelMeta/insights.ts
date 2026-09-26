import { totaisCenario } from "@shared/meta-faturamento";
import type { PainelMetaDados } from "./tipos";
import { parceirosAtivos } from "./calculos";
import { brlCurto, fmtNum } from "./comuns";

export interface Insight { tom: "positivo" | "atencao" | "risco"; titulo: string; texto: string }

export function baseRetidaPct(d: PainelMetaDados): number {
  const t = totaisCenario(d.media12m.cenario);
  const baseRetida = t.porSegmento.recompraConquistados.faturamento + t.porSegmento.carteira.faturamento;
  return t.faturamento > 0 ? (baseRetida / t.faturamento) * 100 : 0;
}

/** Leitura em português simples do que mudou e do que preocupa — cada frase carrega o número que a sustenta. */
export function gerarInsights(d: PainelMetaDados): Insight[] {
  const out: Insight[] = [];
  const atual = d.media12m;
  const ant = d.anoAnterior12m;

  if (ant.faturamento > 0 && ant.vendas > 0 && ant.ticketMedio > 0) {
    const dTicket = (atual.ticketMedio / ant.ticketMedio - 1) * 100;
    const dVendas = (atual.vendas / ant.vendas - 1) * 100;
    if (dTicket >= 5 && dVendas <= -5) {
      out.push({
        tom: "atencao",
        titulo: "O crescimento veio do ticket, não do volume",
        texto: `O ticket médio subiu ${fmtNum(dTicket, 0)}% em um ano, mas o número de pedidos por mês caiu ${fmtNum(-dVendas, 0)}% (de ${fmtNum(ant.vendas, 0)} para ${fmtNum(atual.vendas, 0)}). Para chegar na meta, recuperar volume de pedidos é o caminho que ficou para trás.`,
      });
    } else if (dTicket >= 3 && dVendas >= 3) {
      out.push({
        tom: "positivo",
        titulo: "Ticket e volume crescendo juntos",
        texto: `Ticket médio ${fmtNum(dTicket, 0)}% maior e ${fmtNum(dVendas, 0)}% mais pedidos que um ano atrás.`,
      });
    }
  }

  const { media12mPct, anoAnteriorPct } = d.margem;
  if (media12mPct !== null && anoAnteriorPct !== null && media12mPct - anoAnteriorPct >= 1) {
    const ganho = atual.faturamento * ((media12mPct - anoAnteriorPct) / 100);
    out.push({
      tom: "positivo",
      titulo: "A margem de contribuição subiu",
      texto: `De ${fmtNum(anoAnteriorPct, 1)}% para ${fmtNum(media12mPct, 1)}% (+${fmtNum(media12mPct - anoAnteriorPct, 1)} pontos): com o faturamento de hoje isso rende cerca de ${brlCurto(ganho)} a mais de contribuição por mês. Cada real vendido a mais rende mais do que rendia.`,
    });
  }

  const conc = d.distribuicoes.concentracao;
  if (conc.parceirosAtivos > 0 && conc.top10Pct <= 25) {
    out.push({
      tom: "positivo",
      titulo: "Receita bem distribuída entre as gráficas",
      texto: `${conc.parceirosAtivos} gráficas compraram nos últimos 12 meses e as 10 maiores respondem por só ${fmtNum(conc.top10Pct, 0)}% do faturamento (metade da receita vem de ${conc.parceirosPara50Pct} gráficas). Perder um parceiro grande não abala a meta.`,
    });
  }

  const top = d.vendedores.concentracaoTop1;
  if (top && top.pct >= 50) {
    out.push({
      tom: "risco",
      titulo: "Dependência de uma vendedora",
      texto: `${top.vendedor} responde por ${fmtNum(top.pct, 0)}% do faturamento dos últimos 12 meses. É o maior risco operacional da meta.`,
    });
  }

  const { taxaPct, taxaAnteriorPct } = d.retencao;
  if (taxaPct !== null) {
    const perda = 100 - taxaPct;
    const tendencia = taxaAnteriorPct !== null ? ` (um ano antes: ${fmtNum(taxaAnteriorPct, 0)}%)` : "";
    out.push({
      tom: perda >= 40 ? "atencao" : "positivo",
      titulo: `${fmtNum(perda, 0)}% das gráficas ativas no ano anterior não voltaram a comprar`,
      texto: `Retenção anual de ${fmtNum(taxaPct, 0)}%${tendencia}. Cada ponto de retenção a mais mantém mais parceiros na base retida, que já gera ${fmtNum(baseRetidaPct(d), 0)}% do faturamento.`,
    });
  }

  const hist = d.historico.map(h => h.faturamento);
  const min = Math.min(...hist), max = Math.max(...hist);
  out.push({
    tom: "atencao",
    titulo: "O faturamento oscila muito de um mês para o outro",
    texto: `Nos últimos 12 meses foi de ${brlCurto(min)} a ${brlCurto(max)}. Acompanhe a média dos últimos 3 a 12 meses, não o mês isolado, para saber se a meta está sendo alcançada.`,
  });
  return out;
}

/** Indicadores do ano anterior com o mesmo critério (para a tabela "o que mudou em 1 ano"). */
export function variacoesAnuais(d: PainelMetaDados) {
  const a = d.media12m, b = d.anoAnterior12m;
  return {
    faturamento: { atual: a.faturamento, anterior: b.faturamento },
    vendas: { atual: a.vendas, anterior: b.vendas },
    ticket: { atual: a.ticketMedio, anterior: b.ticketMedio },
    parceirosAtivosMes: { atual: parceirosAtivos(a.cenario), anterior: parceirosAtivos(b.cenario) },
    margem: { atual: d.margem.media12mPct, anterior: d.margem.anoAnteriorPct },
    retencao: { atual: d.retencao.taxaPct, anterior: d.retencao.taxaAnteriorPct },
  };
}
