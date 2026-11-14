import { describe, expect, it } from "vitest";
import {
  calcularMetricasProbabilidade,
  construirPainelProbabilidade,
  type PrevisaoCrmMonitorada,
} from "./crmProbabilidadePerformance";

function previsao(
  data: string,
  desfecho: 0 | 1 | null,
  probabilidadePct: number,
  orcNumero: string
): PrevisaoCrmMonitorada {
  return {
    orcNumero,
    exibidaEm: new Date(`${data}T12:00:00.000Z`),
    probabilidadePct,
    valorProposta: 500,
    modeloVersao: "teste-v1",
    vendedor: "Vendedor teste",
    faixaTicket: "R$335~750",
    faixaIdadeEmpresa: "3 a 10 anos",
    coorteCliente: "2023-2024",
    faixaRecenciaCompra: "até 6 meses",
    regiao: "Centro-Oeste",
    comprasUltimos12m: 2,
    valorComprasUltimos12m: 1000,
    desfecho,
    statusNoHistorico: desfecho === null ? "em aberto" : desfecho ? "aprovado" : "cancelada",
    existeNoHistorico: true,
  };
}

describe("métricas do painel de probabilidade do CRM", () => {
  it("calcula indicadores independentes a partir das previsões e dos desfechos", () => {
    const metrics = calcularMetricasProbabilidade([
      previsao("2026-10-01", 1, 90, "1"),
      previsao("2026-10-02", 0, 30, "2"),
      previsao("2026-10-03", null, 75, "3"),
    ]);

    expect(metrics.previsoes).toBe(3);
    expect(metrics.resolvidas).toBe(2);
    expect(metrics.pendentes).toBe(1);
    expect(metrics.ganhos).toBe(1);
    expect(metrics.perdas).toBe(1);
    expect(metrics.conversaoEsperadaPct).toBe(60);
    expect(metrics.conversaoRealPct).toBe(50);
    expect(metrics.diferencaConversaoPct).toBeCloseTo(-10);
    expect(metrics.brier).toBeCloseTo(0.05);
    expect(metrics.logLoss).toBeCloseTo((-Math.log(0.9) - Math.log(0.7)) / 2);
    expect(metrics.auc).toBe(1);
  });

  it("mostra vinte indicadores com valores próprios por mês e no trimestre", () => {
    const painel = construirPainelProbabilidade({
      dias: 90,
      agora: new Date("2026-11-15T12:00:00.000Z"),
      previsoes: [
        previsao("2026-08-05", 1, 90, "ago-ganha"),
        previsao("2026-09-05", 0, 80, "set-perdida"),
        previsao("2026-10-05", 1, 70, "out-ganha"),
        previsao("2026-10-20", 0, 20, "out-perdida"),
        previsao("2026-10-25", null, 55, "out-pendente"),
      ],
    });

    const indicadores = painel.indicadoresMensais.indicadores;
    const obter = (chave: string) =>
      indicadores.find(indicador => indicador.chave === chave)!;

    expect(indicadores).toHaveLength(20);
    expect(painel.indicadoresMensais.totalGeralPrevisoes).toBe(5);
    expect(painel.indicadoresMensais.totalGeralResolvidas).toBe(4);
    expect(painel.indicadoresMensais.ultimosTresMesesResolvidas).toBe(4);
    expect(obter("ganhos").mediaGeral).toBe(2);
    expect(obter("perdas").mediaGeral).toBe(2);
    expect(obter("conversaoRealPct").mediaGeral).toBe(50);
    expect(obter("conversaoEsperadaPct").mediaGeral).toBeCloseTo(65);
    expect(obter("brier").mediaGeral).toBeCloseTo(0.195);
    expect(obter("ganhos").meses.map(mes => mes.valor)).toEqual([1, 0, 1]);
    expect(obter("perdas").meses.map(mes => mes.valor)).toEqual([0, 1, 1]);
    expect(obter("conversaoRealPct").meses.map(mes => mes.valor)).toEqual([100, 0, 50]);
    expect(obter("conversaoEsperadaPct").meses.map(mes =>
      mes.valor === null ? null : Number(mes.valor.toFixed(6))
    )).toEqual([90, 80, 45]);
  });
});
