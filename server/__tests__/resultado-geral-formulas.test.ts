import { describe, it, expect } from "vitest";
import {
  calcularPontoEquilibrio, calcularDesvioMargem, montarPonteResultado,
  custoFixoMedioPorPedido, resultadoMedioPorPedido, calcularIndicadoresPorFuncionario,
  ratearCustoFixo,
} from "../../shared/resultado-geral";

describe("resultado-geral: ponto de equilíbrio", () => {
  it("calcula ponto de equilíbrio, margem de segurança e distância normalmente", () => {
    // custosFixos 100.000 + marketing 20.000, margem de contribuição 40% (0.40)
    const r = calcularPontoEquilibrio(100_000, 20_000, 0.40, 400_000, 2_000);
    expect(r.pontoEquilibrio).toBe(300_000); // 120.000 / 0.40
    expect(r.distanciaAoEquilibrio).toBe(100_000); // 400.000 - 300.000
    expect(r.margemSegurancaPct).toBe(25); // 100.000/400.000 * 100
    expect(r.pedidosParaEquilibrio).toBe(150); // 300.000 / 2.000
  });

  it("marketing é somado ao custo fixo no ponto de equilíbrio, não duplicado nem ignorado", () => {
    const semMarketing = calcularPontoEquilibrio(100_000, null, 0.40, 400_000, 2_000);
    const comMarketing = calcularPontoEquilibrio(100_000, 20_000, 0.40, 400_000, 2_000);
    expect(semMarketing.pontoEquilibrio).toBe(250_000);
    expect(comMarketing.pontoEquilibrio).toBe(300_000);
  });

  it("retorna tudo null com margem de contribuição zero ou negativa (guard, nunca Infinity)", () => {
    expect(calcularPontoEquilibrio(100_000, 0, 0, 400_000, 2_000).pontoEquilibrio).toBeNull();
    expect(calcularPontoEquilibrio(100_000, 0, -0.1, 400_000, 2_000).pontoEquilibrio).toBeNull();
  });

  it("retorna tudo null sem custos fixos preenchidos (nunca assume zero silenciosamente)", () => {
    const r = calcularPontoEquilibrio(null, 20_000, 0.40, 400_000, 2_000);
    expect(r.pontoEquilibrio).toBeNull();
  });

  it("margem de segurança/distância ficam null sem faturamento líquido, mas ponto de equilíbrio continua calculável", () => {
    const r = calcularPontoEquilibrio(100_000, 20_000, 0.40, null, 2_000);
    expect(r.pontoEquilibrio).toBe(300_000);
    expect(r.margemSegurancaPct).toBeNull();
    expect(r.distanciaAoEquilibrio).toBeNull();
  });

  it("pedidos para equilíbrio fica null sem ticket médio válido", () => {
    const r = calcularPontoEquilibrio(100_000, 20_000, 0.40, 400_000, 0);
    expect(r.pedidosParaEquilibrio).toBeNull();
  });

  it("faturamento abaixo do ponto de equilíbrio dá distância/margem de segurança negativas", () => {
    const r = calcularPontoEquilibrio(100_000, 20_000, 0.40, 200_000, 2_000);
    expect(r.distanciaAoEquilibrio).toBe(-100_000);
    expect(r.margemSegurancaPct).toBe(-50);
  });
});

describe("resultado-geral: margem-meta (administrativa) vs. margem real", () => {
  it("calcula desvio em pontos percentuais e impacto financeiro", () => {
    const r = calcularDesvioMargem(0.51, 0.45, 400_000);
    expect(r.desvioPontosPct).toBe(-6); // 45% - 51% = -6 pontos
    expect(r.impactoFinanceiro).toBe(-24_000); // 400.000 * (0.45-0.51)
  });

  it("margem real acima da meta gera impacto positivo", () => {
    const r = calcularDesvioMargem(0.51, 0.60, 400_000);
    expect(r.desvioPontosPct).toBe(9);
    expect(r.impactoFinanceiro).toBe(36_000);
  });

  it("sem margem real disponível, retorna null em vez de assumir a meta como real", () => {
    const r = calcularDesvioMargem(0.51, null, 400_000);
    expect(r.margemRealPct).toBeNull();
    expect(r.desvioPontosPct).toBeNull();
    expect(r.impactoFinanceiro).toBeNull();
  });
});

describe("resultado-geral: ponte de resultado (bridge)", () => {
  it("monta a ponte completa sem contar nenhuma despesa 2x", () => {
    const r = montarPonteResultado({
      faturamentoBruto: 420_000,
      cancelamentosInformativo: 5_000,
      faturamentoLiquido: 400_000,
      custosVariaveis: 150_000,
      investimentoMarketing: 20_000,
      custosFixos: 100_000,
      despesasFinanceiras: 8_000,
      despesasNaoOperacionais: 2_000,
      receitasNaoOperacionais: 1_000,
    });
    expect(r.margemContribuicao).toBe(250_000); // 400.000 - 150.000
    expect(r.margemContribuicaoPct).toBeCloseTo(0.625, 4);
    expect(r.contribuicaoAposMarketing).toBe(230_000); // 250.000 - 20.000
    expect(r.resultadoOperacional).toBe(130_000); // 230.000 - 100.000
    expect(r.resultadoNaoOperacional).toBe(-1_000); // 1.000 - 2.000
    expect(r.resultadoFinal).toBe(121_000); // 130.000 - 8.000 + (-1.000)
    // cancelamentos é só informativo — não afeta faturamentoLiquido nem nenhum subtotal
    expect(r.faturamentoLiquido).toBe(400_000);
  });

  it("prejuízo (resultado final negativo) é calculado normalmente, sem esconder o sinal", () => {
    const r = montarPonteResultado({
      faturamentoBruto: 200_000,
      cancelamentosInformativo: null,
      faturamentoLiquido: 200_000,
      custosVariaveis: 190_000,
      investimentoMarketing: 5_000,
      custosFixos: 168_000,
      despesasFinanceiras: null,
      despesasNaoOperacionais: null,
      receitasNaoOperacionais: null,
    });
    expect(r.resultadoOperacional).toBeLessThan(0);
    expect(r.resultadoFinal).toBeLessThan(0);
  });

  it("subtotais ficam null (não zero) quando o insumo correspondente está ausente", () => {
    const r = montarPonteResultado({
      faturamentoBruto: null, cancelamentosInformativo: null, faturamentoLiquido: null,
      custosVariaveis: null, investimentoMarketing: null, custosFixos: null,
      despesasFinanceiras: null, despesasNaoOperacionais: null, receitasNaoOperacionais: null,
    });
    expect(r.margemContribuicao).toBeNull();
    expect(r.resultadoOperacional).toBeNull();
    expect(r.resultadoFinal).toBeNull();
  });
});

describe("resultado-geral: indicadores por pedido / por funcionário", () => {
  it("custo fixo médio e resultado médio por pedido", () => {
    expect(custoFixoMedioPorPedido(100_000, 200)).toBe(500);
    expect(resultadoMedioPorPedido(50_000, 200)).toBe(250);
  });

  it("indicadores por pedido ficam null com zero pedidos (guard de divisão por zero)", () => {
    expect(custoFixoMedioPorPedido(100_000, 0)).toBeNull();
  });

  it("indicadores por funcionário ficam TODOS null quando numColaboradores não foi preenchido — nunca hardcodar um valor", () => {
    const r = calcularIndicadoresPorFuncionario(400_000, 250_000, 130_000, null);
    expect(r.faturamentoPorFuncionario).toBeNull();
    expect(r.margemPorFuncionario).toBeNull();
    expect(r.resultadoPorFuncionario).toBeNull();
  });

  it("indicadores por funcionário funcionam normalmente quando numColaboradores está preenchido", () => {
    const r = calcularIndicadoresPorFuncionario(400_000, 250_000, 130_000, 25);
    expect(r.faturamentoPorFuncionario).toBe(16_000);
    expect(r.margemPorFuncionario).toBe(10_000);
    expect(r.resultadoPorFuncionario).toBe(5_200);
  });
});

describe("resultado-geral: rateio de custo fixo (gerencial, nunca substitui o real)", () => {
  it("rateia proporcionalmente ao direcionador escolhido (ex.: faturamento por vendedor)", () => {
    const r = ratearCustoFixo(100_000, "faturamento", [
      { chave: "V1", valorDirecionador: 300_000 },
      { chave: "V2", valorDirecionador: 100_000 },
    ]);
    expect(r.V1).toBe(75_000);
    expect(r.V2).toBe(25_000);
  });

  it("direcionador 'rateio_erp' usa o valor já calculado pelo MubiSys, ignora o proporcional", () => {
    const r = ratearCustoFixo(100_000, "rateio_erp", [
      { chave: "V1", valorDirecionador: 0, valorJaRateado: 42_000 },
    ]);
    expect(r.V1).toBe(42_000);
  });

  it("sem direcionador confiável (soma zero), retorna null em vez de dividir por zero ou ratear igual sem aviso", () => {
    const r = ratearCustoFixo(100_000, "pedidos", [
      { chave: "V1", valorDirecionador: 0 },
      { chave: "V2", valorDirecionador: 0 },
    ]);
    expect(r.V1).toBeNull();
    expect(r.V2).toBeNull();
  });
});
