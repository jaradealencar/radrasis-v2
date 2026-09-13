import { describe, it, expect } from "vitest";
import {
  round2, safeDiv, pctSobre,
  cacPonderado, custoReativacaoPonderado,
  margemDoPedido, agregarMargem,
  calcularResultadoGrupo, calcularResultadoConsolidado,
  mediana, participacaoTopN,
  avaliarSemaforoTeto, avaliarSemaforoPiso,
  conciliar,
} from "../../shared/marketing-financeiro";

describe("marketing-financeiro: guards numéricos", () => {
  it("safeDiv retorna null (nunca NaN/Infinity) com divisor zero", () => {
    expect(safeDiv(100, 0)).toBeNull();
    expect(safeDiv(100, null)).toBeNull();
    expect(safeDiv(null, 10)).toBeNull();
    expect(safeDiv(undefined, 10)).toBeNull();
  });

  it("safeDiv calcula normalmente com valores válidos", () => {
    expect(safeDiv(100, 4)).toBe(25);
  });

  it("pctSobre nunca retorna Infinity/NaN", () => {
    expect(pctSobre(50, 0)).toBeNull();
    expect(pctSobre(50, 100)).toBe(50);
    expect(pctSobre(-50, 100)).toBe(-50);
  });

  it("round2 corrige erro de ponto flutuante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("marketing-financeiro: CAC/custo de reativação ponderados (correção do bug de média simples)", () => {
  it("CAC ponderado usa soma dos totais, não a média das razões mensais", () => {
    // Cenário do bug original: mês A = 1 cliente novo por R$ 1.000 (CAC 1.000);
    // mês B = 40 clientes novos por R$ 2.000 (CAC 50). Média simples dos CAC
    // mensais seria (1000+50)/2 = 525 — errado, pesa igual os dois meses.
    // Ponderado: (1000+2000)/(1+40) = 73.17 — reflete o volume real.
    const investimentoTotal = 1000 + 2000;
    const clientesTotal = 1 + 40;
    const cac = cacPonderado(investimentoTotal, clientesTotal);
    expect(cac).toBeCloseTo(73.17, 2);
    expect(cac).not.toBeCloseTo(525, 0);
  });

  it("CAC ponderado retorna null sem investimento ou sem clientes novos", () => {
    expect(cacPonderado(null, 10)).toBeNull();
    expect(cacPonderado(1000, 0)).toBeNull();
  });

  it("custo de reativação ponderado usa eventos de reativação como denominador, não clientes únicos", () => {
    // 3 clientes únicos reativados, mas 5 eventos (2 deles reativaram 2x no período)
    const custo = custoReativacaoPonderado(500, 5);
    expect(custo).toBe(100);
  });
});

describe("marketing-financeiro: margem real vs. estimada (fallback)", () => {
  it("usa contribuicaoReais quando disponível (método primário)", () => {
    const r = margemDoPedido({ valorOs: 1000, contribuicaoReais: 550 }, 51);
    expect(r).toEqual({ valor: 550, origem: "real" });
  });

  it("cai para o percentual de fallback só quando contribuicaoReais está ausente", () => {
    const r = margemDoPedido({ valorOs: 1000, contribuicaoReais: null }, 51);
    expect(r).toEqual({ valor: 510, origem: "estimada" });
  });

  it("agrega margem 'real' quando todos os pedidos têm dado real", () => {
    const agg = agregarMargem([
      { valorOs: 1000, contribuicaoReais: 400 },
      { valorOs: 2000, contribuicaoReais: 900 },
    ], 51);
    expect(agg.origem).toBe("real");
    expect(agg.margemTotal).toBe(1300);
    expect(agg.pctPedidosComMargemReal).toBe(100);
  });

  it("agrega margem 'mista' quando parte dos pedidos usa fallback", () => {
    const agg = agregarMargem([
      { valorOs: 1000, contribuicaoReais: 400 },
      { valorOs: 1000, contribuicaoReais: null }, // fallback: 510
    ], 51);
    expect(agg.origem).toBe("mista");
    expect(agg.margemTotal).toBe(910);
    expect(agg.pctPedidosComMargemReal).toBe(50);
  });

  it("agrega margem 'sem-dado' para lista vazia, sem dividir por zero", () => {
    const agg = agregarMargem([], 51);
    expect(agg.origem).toBe("sem-dado");
    expect(agg.margemTotal).toBe(0);
    expect(agg.pctPedidosComMargemReal).toBeNull();
  });
});

describe("marketing-financeiro: resultado/ROI/ROAS por grupo e consolidado", () => {
  it("calcula resultado e ROI normalmente com investimento preenchido", () => {
    const r = calcularResultadoGrupo(1000, 3000, 5000);
    expect(r.resultado).toBe(2000);
    expect(r.roiPct).toBe(200);
    expect(r.roas).toBe(5); // 5000/1000
  });

  it("resultado/ROI ficam null quando investimento não foi preenchido (nunca 0 silencioso)", () => {
    const r = calcularResultadoGrupo(null, 3000, 5000);
    expect(r.resultado).toBeNull();
    expect(r.roiPct).toBeNull();
    expect(r.roas).toBeNull();
  });

  it("resultado negativo (prejuízo) e ROI negativo são calculados sem cair em NaN", () => {
    const r = calcularResultadoGrupo(5000, 3000, 4000);
    expect(r.resultado).toBe(-2000);
    expect(r.roiPct).toBe(-40);
  });

  it("investimento explicitamente zero não gera Infinity no ROI", () => {
    const r = calcularResultadoGrupo(0, 1000, 1000);
    expect(r.resultado).toBe(1000);
    expect(r.roiPct).toBeNull(); // divisão por zero => null, nunca Infinity
  });

  it("resultado consolidado soma múltiplos grupos e calcula ROI sobre o investimento total", () => {
    const c = calcularResultadoConsolidado([
      { investimento: 1000, margemContribuicao: 3000 },
      { investimento: 500, margemContribuicao: 1200 },
    ]);
    expect(c.investimento).toBe(1500);
    expect(c.margemContribuicao).toBe(4200);
    expect(c.resultado).toBe(2700);
    expect(c.roiPct).toBe(180);
  });

  it("resultado consolidado fica null quando NENHUM grupo tem investimento preenchido", () => {
    const c = calcularResultadoConsolidado([
      { investimento: null, margemContribuicao: 3000 },
      { investimento: null, margemContribuicao: 1200 },
    ]);
    expect(c.investimento).toBeNull();
    expect(c.resultado).toBeNull();
  });
});

describe("marketing-financeiro: mediana e concentração (outliers)", () => {
  it("mediana de lista ímpar e par", () => {
    expect(mediana([100, 300, 200])).toBe(200);
    expect(mediana([100, 200, 300, 400])).toBe(250);
    expect(mediana([])).toBeNull();
  });

  it("participação dos N maiores pedidos no faturamento, sem excluir automaticamente", () => {
    const valores = [100, 100, 100, 100, 600]; // 1 pedido de 600 num total de 1000
    expect(participacaoTopN(valores, 1)).toBe(60);
    expect(participacaoTopN(valores, 5)).toBe(100);
  });

  it("participação retorna null para lista vazia, 0 para soma total zero", () => {
    expect(participacaoTopN([], 5)).toBeNull();
    expect(participacaoTopN([0, 0, 0], 5)).toBe(0);
  });
});

describe("marketing-financeiro: semáforo de metas", () => {
  it("semáforo de teto (CAC máximo): verde dentro, amarelo perto, vermelho longe", () => {
    expect(avaliarSemaforoTeto(80, 100)).toBe("verde");
    expect(avaliarSemaforoTeto(110, 100)).toBe("amarelo"); // 10% acima, dentro da folga de 15%
    expect(avaliarSemaforoTeto(200, 100)).toBe("vermelho");
  });

  it("semáforo de teto sem meta configurada retorna 'sem-meta', nunca falso-positivo", () => {
    expect(avaliarSemaforoTeto(80, null)).toBe("sem-meta");
    expect(avaliarSemaforoTeto(null, 100)).toBe("sem-meta");
  });

  it("semáforo de piso (ROI mínimo): verde acima, amarelo perto, vermelho abaixo", () => {
    expect(avaliarSemaforoPiso(120, 100)).toBe("verde");
    expect(avaliarSemaforoPiso(90, 100)).toBe("amarelo"); // 10% abaixo, dentro da folga de 15%
    expect(avaliarSemaforoPiso(50, 100)).toBe("vermelho");
  });
});

describe("marketing-financeiro: conciliação de categorias", () => {
  it("concilia quando a soma das categorias bate com o total de referência", () => {
    const r = conciliar(1000, [400, 350, 250]);
    expect(r.conciliado).toBe(true);
    expect(r.divergencia).toBe(0);
  });

  it("tolera diferença de arredondamento (≤ R$0,05)", () => {
    const r = conciliar(1000, [400.02, 350.01, 249.99]);
    expect(r.conciliado).toBe(true);
  });

  it("reporta divergência real sem escondê-la (ex.: pedido não classificado faltando)", () => {
    const r = conciliar(1000, [400, 350]); // faltam 250 de "não classificado"
    expect(r.conciliado).toBe(false);
    expect(r.divergencia).toBe(250);
    expect(r.divergenciaPct).toBe(25);
  });
});
