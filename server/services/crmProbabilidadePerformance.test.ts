import { describe, expect, it } from "vitest";
import {
  calcularMetricasProbabilidade,
  construirPainelProbabilidade,
  resolverDesfechoMonitorado,
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

describe("resolução de desfecho monitorado do CRM", () => {
  it.each([
    {
      desfechosCrm: [1] as Array<0 | 1>,
      esperado: {
        situacao: "ganho_crm",
        desfecho: 1,
        desfechoConsiderandoVencidas: 1,
        origem: "crm",
      },
    },
    {
      desfechosCrm: [0] as Array<0 | 1>,
      esperado: {
        situacao: "perda_crm",
        desfecho: 0,
        desfechoConsiderandoVencidas: 0,
        origem: "crm",
      },
    },
  ])("preserva o desfecho explícito do CRM: $esperado.situacao", ({ desfechosCrm, esperado }) => {
    expect(resolverDesfechoMonitorado({
      statusMubiSys: "em aberto",
      existeNoHistorico: true,
      dataCadastro: "2026-11-01",
      validade: "30",
      desfechosCrm,
      agora: new Date("2026-11-15T12:00:00.000Z"),
    })).toEqual(esperado);
  });

  it.each([
    {
      statusMubiSys: "aprovado",
      desfechosCrm: [0] as Array<0 | 1>,
    },
    {
      statusMubiSys: "em aberto",
      desfechosCrm: [1, 0] as Array<0 | 1>,
    },
    {
      statusMubiSys: "Orc.: Aprovado | OS.: Cancelada",
      desfechosCrm: [1] as Array<0 | 1>,
    },
  ])("marca fontes contraditórias como conflito: $statusMubiSys / $desfechosCrm", ({ statusMubiSys, desfechosCrm }) => {
    expect(resolverDesfechoMonitorado({
      statusMubiSys,
      existeNoHistorico: true,
      dataCadastro: "2026-11-01",
      validade: "30",
      desfechosCrm,
      agora: new Date("2026-11-15T12:00:00.000Z"),
    })).toEqual({
      situacao: "conflito",
      desfecho: null,
      desfechoConsiderandoVencidas: null,
      origem: null,
    });
  });

  it("mantém uma proposta aberta dentro do prazo sem rotulá-la como perda", () => {
    expect(resolverDesfechoMonitorado({
      statusMubiSys: "em aberto",
      existeNoHistorico: true,
      dataCadastro: "2026-11-01",
      validade: "30",
      agora: new Date("2026-11-15T12:00:00.000Z"),
    })).toEqual({
      situacao: "aberta_na_validade",
      desfecho: null,
      desfechoConsiderandoVencidas: null,
      origem: null,
    });
  });

  it("marca uma proposta aberta vencida como perda presumida sem convertê-la em desfecho confirmado", () => {
    expect(resolverDesfechoMonitorado({
      statusMubiSys: "em aberto",
      existeNoHistorico: true,
      dataCadastro: "2026-10-01",
      validade: "30",
      agora: new Date("2026-11-15T12:00:00.000Z"),
    })).toEqual({
      situacao: "perda_presumida_validade",
      desfecho: null,
      desfechoConsiderandoVencidas: 0,
      origem: "presumida",
    });
  });

  it("uses 30 days only when validity is missing", () => {
    expect(resolverDesfechoMonitorado({
      statusMubiSys: "em aberto",
      existeNoHistorico: true,
      dataCadastro: "2026-10-01",
      validade: null,
      agora: new Date("2026-11-15T12:00:00.000Z"),
    })).toMatchObject({
      situacao: "perda_presumida_validade",
      desfecho: null,
      desfechoConsiderandoVencidas: 0,
      origem: "presumida",
    });
  });

  it("requires the recognized open status before presuming a loss from age", () => {
    expect(resolverDesfechoMonitorado({
      statusMubiSys: "pendente",
      existeNoHistorico: true,
      dataCadastro: "2026-09-01",
      validade: "10",
      agora: new Date("2026-11-15T12:00:00.000Z"),
    })).toMatchObject({
      situacao: "status_nao_reconhecido",
      desfecho: null,
      desfechoConsiderandoVencidas: null,
      origem: null,
    });
  });

  it.each([
    {
      statusMubiSys: "em aberto",
      existeNoHistorico: false,
      esperado: "sem_historico",
    },
    {
      statusMubiSys: null,
      existeNoHistorico: true,
      esperado: "sem_status",
    },
    {
      statusMubiSys: "aguardando aprovação externa",
      existeNoHistorico: true,
      esperado: "status_nao_reconhecido",
    },
  ] as const)("distingue histórico/status ausente ou não reconhecido ($esperado)", ({ statusMubiSys, existeNoHistorico, esperado }) => {
    expect(resolverDesfechoMonitorado({
      statusMubiSys,
      existeNoHistorico,
      dataCadastro: "2026-11-01",
      validade: "30",
      agora: new Date("2026-11-15T12:00:00.000Z"),
    })).toEqual({
      situacao: esperado,
      desfecho: null,
      desfechoConsiderandoVencidas: null,
      origem: null,
    });
  });
});
