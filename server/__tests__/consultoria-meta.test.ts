import { describe, it, expect } from "vitest";
import {
  calcularEconomia, calcularMarketing, calcularVendedores, calcularPipeline,
  calcularDistribuicoes, gerarRecomendacoes, resumirFila,
  type EntradaRecomendacoes,
} from "../services/consultoriaMeta";
import { calcularBandas, calcularPainelMeta } from "../services/painelMeta";
import { calcularConversaoPorFaixaTicket, type ClienteBase, type OrcamentoRow } from "../services/inteligenciaClientes";
import {
  rankearAlavancas, dividirFunil, compararCaminhos, type Cenario,
} from "../../shared/meta-faturamento";

const HOJE = new Date(2026, 8, 15); // set/2026 → últimos 12 meses fechados: set/2025 a ago/2026
const ATUAL = 2026 * 12 + 8;

function cliente(nome: string, compras: Array<{ d: [number, number, number]; valor: number; vendedor?: string; estado?: string; contrib?: number | null }>): ClienteBase {
  return {
    empresaKey: nome,
    empresaExibicao: nome,
    compras: compras
      .map((c, i) => ({
        osNumero: `${nome}-${i}`,
        data: new Date(c.d[0], c.d[1] - 1, c.d[2]),
        valor: c.valor,
        custo: null,
        contribuicao: c.contrib === undefined ? c.valor * 0.5 : c.contrib,
        vendedor: c.vendedor ?? "Ana",
        cidade: null,
        estado: c.estado ?? "MS",
        trabalho: null,
      }))
      .sort((a, b) => a.data.getTime() - b.data.getTime()),
  };
}

function orc(o: Partial<OrcamentoRow> & { ano: number; mes: number; status: string; vendedor: string; total: string }): OrcamentoRow {
  return {
    orcNumero: null, empresa: "Gráfica X", dataCadastro: `10/${String(o.mes).padStart(2, "0")}/${o.ano} 10:00`,
    validade: "15", motivoCancelamento: null, ...o,
  } as OrcamentoRow;
}

describe("calcularEconomia", () => {
  const linhas = Array.from({ length: 8 }, (_, i) => {
    const fat = 300_000 + i * 20_000;
    return { ano: 2026, mes: i + 1, faturamentoOficial: String(fat), lucroLiquido: String(0.7 * fat - 210_000), lucroBruto: null };
  });

  it("acha a inclinação, o ponto de equilíbrio e a confiança", () => {
    const e = calcularEconomia(linhas, ATUAL)!;
    expect(e.inclinacao).toBeCloseTo(0.7, 6);
    expect(e.pontoEquilibrio).toBeCloseTo(300_000, 3);
    expect(e.r2).toBeCloseTo(1, 6);
    expect(e.confianca).toBe("alta");
    expect(e.meses).toBe(8);
  });

  it("devolve null com menos de 6 meses ou inclinação negativa", () => {
    expect(calcularEconomia(linhas.slice(0, 5), ATUAL)).toBeNull();
    const invertido = linhas.map((l, i) => ({ ...l, lucroLiquido: String(100_000 - i * 10_000) }));
    expect(calcularEconomia(invertido, ATUAL)).toBeNull();
  });

  it("ignora o mês corrente e usa lucro bruto se o líquido não existir", () => {
    const comCorrente = [...linhas, { ano: 2026, mes: 9, faturamentoOficial: "999999", lucroLiquido: "1", lucroBruto: null }];
    expect(calcularEconomia(comCorrente, ATUAL)!.meses).toBe(8);
    const semLiquido = linhas.map(l => ({ ...l, lucroBruto: l.lucroLiquido, lucroLiquido: null }));
    expect(calcularEconomia(semLiquido, ATUAL)!.inclinacao).toBeCloseTo(0.7, 6);
  });
});

describe("calcularMarketing", () => {
  it("divide o investimento pelos parceiros novos dos mesmos meses", () => {
    const historico = [
      { mes: "07/2026", clientes: { novos: 20 } },
      { mes: "08/2026", clientes: { novos: 30 } },
    ] as any;
    const m = calcularMarketing([
      { ano: 2026, mes: 7, investimentoAquisicao: "5000", investimento: null },
      { ano: 2026, mes: 8, investimentoAquisicao: null, investimento: "10000" },
      { ano: 2026, mes: 2, investimentoAquisicao: "999", investimento: null }, // fora do histórico
    ], historico)!;
    expect(m.meses).toBe(2);
    expect(m.cacPorNovo).toBeCloseTo(15000 / 50, 6);
    expect(m.investimentoMedioMensal).toBeCloseTo(7500, 6);
    expect(calcularMarketing([], historico)).toBeNull();
  });
});

describe("calcularVendedores", () => {
  // 200 orçamentos de Ana (60 ganhos → 30%) e 200 de Bia (20 ganhos → 10%); todos de ago/2026
  const rows: OrcamentoRow[] = [];
  for (let i = 0; i < 200; i++) rows.push(orc({ ano: 2026, mes: 8, vendedor: "Ana", total: "1000", status: i < 60 ? "Aprovado" : "Reprovado" }));
  for (let i = 0; i < 200; i++) rows.push(orc({ ano: 2026, mes: 8, vendedor: "Bia", total: "1000", status: i < 20 ? "Aprovado" : "Reprovado" }));
  const base = new Map<string, ClienteBase>();
  base.set("c1", cliente("c1", [{ d: [2026, 5, 1], valor: 8000, vendedor: "Ana" }, { d: [2026, 6, 1], valor: 2000, vendedor: "Bia" }]));

  it("mede conversão por vendedor, define o benchmark e o ganho de fechar metade da diferença", () => {
    const a = calcularVendedores(rows, base, HOJE, 2000);
    expect(a.benchmark).toEqual({ vendedor: "Ana", conversaoPct: 30 });
    expect(a.abaixoDoBenchmark).toHaveLength(1);
    // Bia: 200 orçamentos/mês × (30%−10%)/2 × R$ 2.000
    expect(a.abaixoDoBenchmark[0].ganhoMensalMetadeGap).toBeCloseTo(200 * 0.1 * 2000, 6);
    expect(a.impactoFecharMetadeDoGap).toBeCloseTo(40_000, 6);
    expect(a.concentracaoTop1).toEqual({ vendedor: "Ana", pct: 80 });
  });

  it("não define benchmark com poucas decisões", () => {
    expect(calcularVendedores(rows.slice(0, 20), base, HOJE, 2000).benchmark).toBeNull();
  });
});

describe("calcularPipeline", () => {
  const faixas = calcularConversaoPorFaixaTicket([
    { status: "Aprovado", total: "1000", dataCadastro: "01/08/2026", validade: "10" },
    { status: "Reprovado", total: "1000", dataCadastro: "01/08/2026", validade: "10" },
  ], HOJE); // faixa R$760~1.300 com 50%

  const rows: OrcamentoRow[] = [
    orc({ ano: 2026, mes: 9, status: "Em aberto", vendedor: "Ana", total: "1000", dataCadastro: "10/09/2026 09:00", validade: "15", empresa: "A" }), // vence 25/09
    orc({ ano: 2026, mes: 9, status: "Em aberto", vendedor: "Bia", total: "1000", dataCadastro: "13/09/2026 09:00", validade: "4", empresa: "B" }), // vence 17/09 (3 dias)
    orc({ ano: 2026, mes: 8, status: "Em aberto", vendedor: "Bia", total: "5000", dataCadastro: "01/08/2026 09:00", validade: "10", empresa: "C" }), // vencido
    orc({ ano: 2026, mes: 9, status: "Aprovado", vendedor: "Bia", total: "700", dataCadastro: "10/09/2026 09:00", empresa: "D" }),
  ];

  it("considera só orçamentos em aberto ainda válidos e pondera pela conversão da faixa", () => {
    const p = calcularPipeline(rows, faixas, HOJE);
    expect(p.quantidade).toBe(2);
    expect(p.valorTotal).toBe(2000);
    expect(p.valorEsperado).toBeCloseTo(1000, 6);
    expect(p.vencendoEm3Dias.quantidade).toBe(1);
    expect(p.top[0].empresa).toBeDefined();
  });
});

describe("calcularDistribuicoes", () => {
  const base = new Map<string, ClienteBase>();
  base.set("a", cliente("a", [
    { d: [2026, 3, 1], valor: 500, estado: "MS" }, { d: [2026, 4, 1], valor: 1000, estado: "MS" },
    { d: [2026, 5, 1], valor: 8000, estado: "DF" },
  ]));
  base.set("b", cliente("b", [{ d: [2026, 5, 1], valor: 2500, estado: "SP" }]));
  base.set("fora", cliente("fora", [{ d: [2025, 1, 1], valor: 99999, estado: "SP" }])); // fora da janela

  const d = calcularDistribuicoes(base, HOJE);

  it("agrupa pedidos por faixa de ticket dentro dos 12 meses fechados", () => {
    expect(d.faixasTicket.map(f => f.pedidos)).toEqual([1, 1, 1, 0, 1]);
    expect(d.faixasTicket.reduce((s, f) => s + f.faturamento, 0)).toBe(12_000);
    expect(d.faixasTicket[4].pctFaturamento).toBeCloseTo((8000 / 12000) * 100, 6);
  });

  it("mede concentração e estados", () => {
    expect(d.concentracao.parceirosAtivos).toBe(2);
    expect(d.concentracao.top1Pct).toBeCloseTo((9500 / 12000) * 100, 6);
    expect(d.estados[0].estado).toBe("DF");
    expect(d.estados.find(e => e.estado === "MS")!.ticket).toBeCloseTo(750, 6);
    expect(d.ticketMedioGeral).toBeCloseTo(3000, 6);
  });
});

describe("resumirFila", () => {
  it("soma o ticket de uma compra de cada parceiro por tipo de ação", () => {
    const base = new Map<string, ClienteBase>();
    base.set("x", cliente("x", [{ d: [2026, 1, 1], valor: 1000 }, { d: [2026, 2, 1], valor: 3000 }]));
    base.set("y", cliente("y", [{ d: [2026, 6, 1], valor: 500 }]));
    const r = resumirFila([
      { tipo: "atraso_recompra", empresaKey: "x" } as any,
      { tipo: "primeira_sem_segunda", empresaKey: "y" } as any,
      { tipo: "alto_volume_baixa_margem", empresaKey: "x" } as any,
    ], base, HOJE);
    expect(r.atrasoRecompra).toEqual({ quantidade: 1, valorDeUmaCompraCadaUm: 2000 });
    expect(r.primeiraSemSegunda).toEqual({ quantidade: 1, valorDeUmaCompraCadaUm: 500 });
  });
});

describe("gerarRecomendacoes", () => {
  const entrada = (): EntradaRecomendacoes => ({
    painel: {
      coorte: { meses: [{ k: 0, elegiveis: 100, ativosPct: 100, receitaPorParceiro: 2500 }], ltv12m: 6000, parceirosAnalisados: 300, periodo: "", ltvAcumulado: [] },
      recompra: { taxaPct: 40, clientesAnalisados: 300, periodo: "" },
    } as any,
    funil: {} as any,
    vendedores: {
      vendedores: [], concentracaoTop1: { vendedor: "Ana", pct: 62 },
      benchmark: { vendedor: "Ana", conversaoPct: 30 }, impactoFecharMetadeDoGap: 40_000,
      abaixoDoBenchmark: [{ vendedor: "Bia", conversaoPct: 10, leadsPorMes: 200, ganhoMensalMetadeGap: 40_000 }],
    },
    pipeline: { quantidade: 30, valorTotal: 150_000, valorEsperado: 30_000, vencendoEm3Dias: { quantidade: 4, valor: 12_000 }, top: [] },
    distribuicoes: {
      faixasTicket: [
        { faixa: "a", pedidos: 500, pctPedidos: 35, faturamento: 1, pctFaturamento: 4 },
        { faixa: "b", pedidos: 300, pctPedidos: 20, faturamento: 1, pctFaturamento: 8 },
        { faixa: "c", pedidos: 0, pctPedidos: 0, faturamento: 0, pctFaturamento: 0 },
        { faixa: "d", pedidos: 0, pctPedidos: 0, faturamento: 0, pctFaturamento: 0 },
        { faixa: "e", pedidos: 0, pctPedidos: 0, faturamento: 0, pctFaturamento: 0 },
      ],
      estados: [{ estado: "DF", pedidos: 40, parceiros: 14, faturamento: 230_000, pctFaturamento: 5, ticket: 5500 }],
      concentracao: { parceirosAtivos: 500, top1Pct: 3, top10Pct: 20, parceirosPara50Pct: 58, parceirosPara80Pct: 196 },
      ticketMedioGeral: 2200,
    },
    fila: { atrasoRecompra: { quantidade: 40, valorDeUmaCompraCadaUm: 100_000 }, primeiraSemSegunda: { quantidade: 25, valorDeUmaCompraCadaUm: 50_000 } },
    marketing: { meses: 8, investimentoMedioMensal: 5700, novosMedioMensal: 22, cacPorNovo: 260 },
  });

  it("gera as recomendações com número de sustentação e ordena por ganho ÷ esforço", () => {
    const recs = gerarRecomendacoes(entrada());
    const ids = recs.map(r => r.id);
    expect(ids).toEqual(expect.arrayContaining([
      "conversao-vendedores", "pipeline-aberto", "recompra-atrasada", "novos-sem-segunda",
      "aquisicao-cac-ltv", "pedidos-pequenos", "concentracao-vendedor", "estados-ticket-alto",
    ]));
    const conv = recs.find(r => r.id === "conversao-vendedores")!;
    expect(conv.impactoMensal).toBe(40_000);
    expect(conv.diagnostico).toContain("Bia");
    const aq = recs.find(r => r.id === "aquisicao-cac-ltv")!;
    expect(aq.impactoMensal).toBe(30_000); // 5 novos × LTV 6.000
    expect(aq.diagnostico).toContain("23×"); // 6000 / 260
    // ordenação: impacto mensal por peso de esforço (40k/2 = 20k > 30k/2 = 15k)
    expect(ids.indexOf("conversao-vendedores")).toBeLessThan(ids.indexOf("aquisicao-cac-ltv"));
  });

  it("omite recomendações sem dado de sustentação", () => {
    const e = entrada();
    e.marketing = null;
    e.vendedores.benchmark = null;
    e.vendedores.abaixoDoBenchmark = [];
    e.vendedores.impactoFecharMetadeDoGap = null;
    e.pipeline.quantidade = 0;
    const ids = gerarRecomendacoes(e).map(r => r.id);
    expect(ids).not.toContain("aquisicao-cac-ltv");
    expect(ids).not.toContain("conversao-vendedores");
    expect(ids).not.toContain("pipeline-aberto");
  });
});

describe("calcularBandas", () => {
  it("devolve faixa mensal maior que a faixa da média de 12 meses e é determinística", () => {
    const erros = [-0.4, -0.25, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];
    const a = calcularBandas(erros);
    const b = calcularBandas(erros);
    expect(a).toEqual(b);
    expect(a.mensal!.pessimista).toBeLessThan(a.mensal!.otimista);
    const larguraMensal = a.mensal!.otimista - a.mensal!.pessimista;
    const larguraMedia = a.media12m!.otimista - a.media12m!.pessimista;
    expect(larguraMedia).toBeLessThan(larguraMensal / 2);
  });

  it("não inventa faixa com poucos meses", () => {
    expect(calcularBandas([0.1, -0.1]).mensal).toBeNull();
  });
});

describe("painelMeta — coorte, correlações e ano anterior", () => {
  // 40 parceiros novos entram por mês de jun/2024 a ago/2026; cada um compra na entrada e em k=1 (R$ 1000 e R$ 500)
  const base = new Map<string, ClienteBase>();
  const firstChave = 2023 * 12 + 4; // mai/2023: início do histórico
  base.set("antigo", cliente("antigo", [{ d: [2023, 5, 10], valor: 100 }]));
  for (let ch = 2024 * 12 + 5; ch <= 2026 * 12 + 7; ch++) {
    const quantos = 40 + (ch % 5) * 5;
    for (let i = 0; i < quantos; i++) {
      const ano = Math.floor(ch / 12), mes = (ch % 12) + 1;
      const compras = [{ d: [ano, mes, 5] as [number, number, number], valor: 1000 }];
      const prox = ch + 1;
      compras.push({ d: [Math.floor(prox / 12), (prox % 12) + 1, 5], valor: 500 });
      base.set(`p${ch}-${i}`, cliente(`p${ch}-${i}`, compras));
    }
  }
  void firstChave;
  const painel = calcularPainelMeta(base, HOJE, 6);

  it("mede a vida de um parceiro novo e o LTV de 12 meses", () => {
    const c = painel.coorte;
    expect(c.parceirosAnalisados).toBeGreaterThan(300);
    expect(c.meses[0].ativosPct).toBeCloseTo(100, 6);
    expect(c.meses[0].receitaPorParceiro).toBeCloseTo(1000, 6);
    expect(c.meses[1].receitaPorParceiro).toBeCloseTo(500, 6);
    expect(c.meses[2].ativosPct).toBeCloseTo(0, 6);
    expect(c.ltv12m).toBeCloseTo(1500, 6);
  });

  it("calcula o ano anterior, a margem sem o mês mais recente e as correlações", () => {
    expect(painel.anoAnterior12m.faturamento).toBeGreaterThan(0);
    expect(painel.margem.media12mPct).toBeCloseTo(50, 6);
    expect(painel.margem.periodo).toBe("08/2025 a 07/2026");
    expect(painel.correlacoes.itens.length).toBeGreaterThan(0);
    for (const i of painel.correlacoes.itens) expect(i.r2Pct).toBeGreaterThanOrEqual(0);
  });
});

describe("rankearAlavancas", () => {
  const base: Cenario = {
    novos: { clientes: 20, pedidosPorCliente: 1, ticket: 2000 },
    reativados: { clientes: 20, pedidosPorCliente: 1, ticket: 2000 },
    recompraConquistados: { clientes: 40, pedidosPorCliente: 1.5, ticket: 2000 },
    carteira: { clientes: 30, pedidosPorCliente: 1.5, ticket: 2000 },
  };
  // faturamento: 20×2000 + 20×2000 + 60×2000 + 45×2000 = 290.000; vendas = 20+20+60+45 = 145; ticket 2.000
  const fat = 290_000;

  it("classifica pelo histórico: o que já foi atingido em vários meses é esforço menor", () => {
    const r = rankearAlavancas({
      faturamentoAtual: fat, meta: 340_000, base,
      leads: { atual: 700, serie: [650, 690, 720, 800, 900, 710] }, // precisa de 821 → atingiu 1 de 6 (900)
      conversao: { atual: 20, serie: [18, 19, 20, 21, 22, 20] },     // precisa de 23,4 → nunca
      ticket: { serie: [1800, 2100, 2500, 2400, 2300, 2000] },       // precisa de 2.345 → 2 de 6 (2500, 2400)
      novos: { serie: [15, 18, 20, 22, 25, 30] },                    // precisa de 20 + 50.000/2.000 = 45 → nunca
      reativados: { serie: [10, 15, 20, 25, 45, 46] },               // idem 45 → 2 de 6
    });
    const porId = Object.fromEntries(r.map(a => [a.id, a]));
    expect(porId.ticket.necessario).toBeCloseTo(2000 * (340 / 290), 6);
    expect(porId.ticket.mesesJaAtingiu).toBe(2);
    expect(porId.ticket.esforco).toBe("menor"); // já atingido em 2 de 6 meses (33% ≥ 25%)
    expect(porId.leads.esforco).toBe("medio"); // 1 de 6 meses
    expect(porId.novos.necessario).toBeCloseTo(45, 6);
    expect(porId.novos.esforco).toBe("maior");
    expect(porId.conversao.esforco).toBe("maior");
    expect(r[0].esforco).not.toBe("maior");
  });

  it("devolve vazio se a meta já foi atingida", () => {
    expect(rankearAlavancas({
      faturamentoAtual: fat, meta: 200_000, base,
      leads: { atual: null, serie: [] }, conversao: { atual: null, serie: [] },
      ticket: { serie: [] }, novos: { serie: [] }, reativados: { serie: [] },
    })).toEqual([]);
  });
});

describe("dividirFunil e compararCaminhos", () => {
  it("divide o aumento de vendas entre orçamentos e conversão", () => {
    const f = { leadsPorMes: 700, conversaoPct: 20 };
    const metade = dividirFunil(140, 196, f, 0.5); // vendas ×1,4
    expect(metade.leads! * (metade.conversaoPct! / 100)).toBeCloseTo(700 * 0.2 * 1.4, 6);
    expect(metade.leads).toBeCloseTo(700 * Math.sqrt(1.4), 6);
    expect(dividirFunil(140, 196, f, 0).conversaoPct).toBeCloseTo(20, 6); // só orçamentos
    expect(dividirFunil(140, 196, f, 1).leads).toBeCloseTo(700, 6); // só conversão
    expect(dividirFunil(0, 10, f, 0.5)).toEqual({ leads: null, conversaoPct: null });
  });

  it("compara o caminho da conversão com o dos parceiros novos", () => {
    const r = compararCaminhos({
      faturamentoAtual: 350_000, meta: 500_000, conversaoPct: 22, conversaoMaximaPct: 26,
      novosAtual: 20, novosMaximoMensal: 30, ltv12m: 5_000, receitaEntradaPorNovo: 3_000,
    });
    expect(r.gap).toBe(150_000);
    expect(r.conversao!.valorPorPontoPercentual).toBeCloseTo(350_000 / 22, 6);
    expect(r.conversao!.pontosNecessarios).toBeCloseTo(150_000 / (350_000 / 22), 6);
    expect(r.conversao!.acimaDoMaximoHistorico).toBe(true);
    expect(r.novos.adicionaisPorMesEmRegime).toBeCloseTo(30, 6);
    expect(r.novos.novosNecessariosEmRegime).toBeCloseTo(50, 6);
    expect(r.novos.adicionaisPorMesImediato).toBeCloseTo(50, 6);
    expect(r.novos.acimaDoMaximoHistorico).toBe(true);
  });
});
