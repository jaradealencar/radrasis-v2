import { describe, expect, it } from "vitest";
import {
  calcularProbabilidadeCrmAprendida,
  limitarScoreCrmClienteNovo,
  CRM_PROBABILITY_FEATURE_NAMES,
  CRM_PROBABILITY_MIN_TRAINING_EXAMPLES,
  CRM_PROBABILITY_MIN_NEW_CUSTOMER_CALIBRATION_EXAMPLES,
  CRM_PROBABILITY_TICKET_BANDS,
  classificarDesfechoExplicito,
  preverComLogistica,
  treinarRegressaoLogistica,
  type ExemploProbabilidadeCrm,
  type ModeloProbabilidadeCrm,
} from "./crmProbabilidadeModel";

function modeloVazio(): ModeloProbabilidadeCrm {
  return {
    modelo: treinarRegressaoLogistica([]),
    exemplos: [],
    propostasPorCliente: new Map(),
    osPorCliente: new Map(),
    inicioEmpresaPorCliente: new Map(),
    taxaGeral: 0.2,
    nTreino: 0,
    ultimaPropostaTreino: null,
    ultimaPropostaHistorico: null,
    propostasHistoricoSemDesfecho: 0,
    coberturaIdadeEmpresarial: {
      clientesHistoricos: 0,
      clientesComIdade: 0,
      propostasTreino: 0,
      propostasComIdade: 0,
    },
    distribuicaoIdade: [],
    coberturaHistoricoOs: {
      registrosSincronizados: 0,
      comprasValidas: 0,
      comUf: 0,
      semUf: 0,
      primeiraCompra: null,
      ultimaCompra: null,
      porRegiao: [],
    },
    conversaoHistoricaPorRegiao: [],
  };
}

describe("modelo de probabilidade do CRM", () => {
  it("aplica o teto final de 30% sempre que a lista classifica a proposta como cliente novo", () => {
    expect(limitarScoreCrmClienteNovo(53, true)).toBe(30);
    expect(limitarScoreCrmClienteNovo(30, true)).toBe(30);
    expect(limitarScoreCrmClienteNovo(53, false)).toBe(53);
    expect(limitarScoreCrmClienteNovo(null, true)).toBeNull();
  });

  it.each([
    ["faturado", 1],
    ["concluído", 1],
    ["cancelado", 0],
  ] as const)("classifica o status ERP alternativo %s como %i", (status, desfecho) => {
    expect(classificarDesfechoExplicito(status)).toBe(desfecho);
  });

  it("nao transforma o fallback de 20% em score sem amostra suficiente", () => {
    const result = calcularProbabilidadeCrmAprendida({
      modelo: modeloVazio(),
      nomeCliente: "Cliente de teste",
      valorProposta: 250,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
    });

    expect(CRM_PROBABILITY_MIN_TRAINING_EXAMPLES).toBe(300);
    expect(result.probabilidade).toBeNull();
    expect(result.explicacao[0]).toContain("20%");
    expect(result.segmentos.faixaTicket).toBe(CRM_PROBABILITY_TICKET_BANDS[0]);
  });

  it("oculta o score com 100 a 299 decisões, antes do mínimo de treino calibrado", () => {
    const modelo = modeloVazio();
    modelo.nTreino = 299;
    modelo.modelo.calibrador = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: 100,
      taxaObservada: 0.2,
    };

    const result = calcularProbabilidadeCrmAprendida({
      modelo,
      nomeCliente: "Cliente de teste",
      valorProposta: 250,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
    });

    expect(result.probabilidade).toBeNull();
    expect(result.explicacao[0]).toContain("300");
  });

  it("não reutiliza a calibração geral para cliente sem compras anteriores", () => {
    const modelo = modeloVazio();
    modelo.nTreino = CRM_PROBABILITY_MIN_TRAINING_EXAMPLES;
    modelo.modelo.calibrador = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: 200,
      taxaObservada: 0.24,
    };

    const result = calcularProbabilidadeCrmAprendida({
      modelo,
      nomeCliente: "Cliente sem compras",
      valorProposta: 63.47,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
    });

    expect(CRM_PROBABILITY_MIN_NEW_CUSTOMER_CALIBRATION_EXAMPLES).toBe(100);
    expect(result.probabilidade).toBeNull();
    expect(result.explicacao[0]).toContain("clientes sem compras anteriores");
    expect(result.explicacao[0]).toContain("100 previsões");
  });

  it("aplica a calibração própria e reduz scores altos sem histórico de compras", () => {
    const modelo = modeloVazio();
    modelo.nTreino = CRM_PROBABILITY_MIN_TRAINING_EXAMPLES;
    modelo.modelo.intercepto = Math.log(0.72 / 0.28);
    modelo.modelo.calibrador = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: 200,
      taxaObservada: 0.24,
    };
    modelo.modelo.calibradorSemCompras = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: CRM_PROBABILITY_MIN_NEW_CUSTOMER_CALIBRATION_EXAMPLES,
      taxaObservada: 0.15,
    };

    const result = calcularProbabilidadeCrmAprendida({
      modelo,
      nomeCliente: "Cliente sem compras",
      valorProposta: 63.47,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
    });

    expect(result.probabilidade).not.toBeNull();
    expect(result.probabilidade).toBe(30);
    expect(result.explicacao.some((linha) => linha.includes("100 previsões históricas fora da amostra"))).toBe(true);
    expect(result.explicacao.some((linha) => linha.includes("conversão observada do segmento 15.0% + 15 p.p., até 30%"))).toBe(true);
  });

  it("nunca passa de 30% para cliente sem compras, mesmo sem conversão individual calculável", () => {
    const modelo = modeloVazio();
    modelo.nTreino = CRM_PROBABILITY_MIN_TRAINING_EXAMPLES;
    modelo.modelo.intercepto = Math.log(0.95 / 0.05);
    modelo.modelo.calibrador = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: 200,
      taxaObservada: 0.42,
    };
    modelo.modelo.calibradorSemCompras = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: CRM_PROBABILITY_MIN_NEW_CUSTOMER_CALIBRATION_EXAMPLES,
      taxaObservada: 0.42,
    };

    const result = calcularProbabilidadeCrmAprendida({
      modelo,
      nomeCliente: "Cliente novo com ticket alto",
      valorProposta: 15_000,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
      regiaoCliente: "SP",
      taxaConversaoClientePct: null,
    });

    expect(result.probabilidade).toBe(30);
    expect(result.explicacao.some((linha) => linha.includes("até 30%"))).toBe(true);
  });

  it("limita a previsão de um cliente com conversão zero a 15%", () => {
    const modelo = modeloVazio();
    modelo.nTreino = CRM_PROBABILITY_MIN_TRAINING_EXAMPLES;
    modelo.modelo.intercepto = Math.log(0.72 / 0.28);
    modelo.modelo.calibrador = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: 200,
      taxaObservada: 0.24,
    };
    modelo.modelo.calibradorSemCompras = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: CRM_PROBABILITY_MIN_NEW_CUSTOMER_CALIBRATION_EXAMPLES,
      taxaObservada: 0.15,
    };

    const result = calcularProbabilidadeCrmAprendida({
      modelo,
      nomeCliente: "Cliente sem compras",
      valorProposta: 63.47,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
      taxaConversaoClientePct: 0,
    });

    expect(result.probabilidade).toBe(15);
    expect(result.explicacao.some((linha) => linha.includes("conversão registrada do cliente: 0.0% + 15 p.p., até 15%"))).toBe(true);
  });

  it("oculta o score se a calibração temporal não estiver disponível", () => {
    const modelo = modeloVazio();
    modelo.nTreino = 300;

    const result = calcularProbabilidadeCrmAprendida({
      modelo,
      nomeCliente: "Cliente de teste",
      valorProposta: 250,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
    });

    expect(result.probabilidade).toBeNull();
    expect(result.explicacao[0]).toContain("calibração temporal geral válida");
  });

  it("libera a previsão com amostra suficiente e calibração válida", () => {
    const modelo = modeloVazio();
    modelo.nTreino = CRM_PROBABILITY_MIN_TRAINING_EXAMPLES;
    modelo.modelo.calibrador = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: 100,
      taxaObservada: 0.2,
    };
    modelo.modelo.calibradorSemCompras = {
      mediaLogit: 0,
      escalaLogit: 1,
      coeficiente: 1,
      intercepto: 0,
      n: CRM_PROBABILITY_MIN_NEW_CUSTOMER_CALIBRATION_EXAMPLES,
      taxaObservada: 0.2,
    };

    const result = calcularProbabilidadeCrmAprendida({
      modelo,
      nomeCliente: "Cliente de teste",
      valorProposta: 250,
      dataProposta: new Date("2026-01-15T12:00:00Z"),
    });

    expect(result.probabilidade).not.toBeNull();
  });

  it("diferencia previsoes de tickets historicamente distintos", () => {
    const names = CRM_PROBABILITY_FEATURE_NAMES;
    const ticketIndex = names.indexOf("ticketLog");
    const lowBandIndex = names.indexOf(`ticket:${CRM_PROBABILITY_TICKET_BANDS[0]}`);
    const highBandIndex = names.indexOf(`ticket:${CRM_PROBABILITY_TICKET_BANDS[6]}`);
    const examples: ExemploProbabilidadeCrm[] = Array.from({ length: 400 }, (_, i) => {
      const lowTicket = i < 200;
      const ganhou = lowTicket ? i % 2 === 0 : i % 20 === 0;
      const features = Array(names.length).fill(0) as number[];
      features[ticketIndex] = Math.log1p(lowTicket ? 250 : 15_000);
      features[lowTicket ? lowBandIndex : highBandIndex] = 1;
      return {
        proposta: {
          empresa: `Cliente ${i}`,
          empresaKey: `cliente-${i}`,
          valor: lowTicket ? 250 : 15_000,
          data: new Date(Date.UTC(2025, 0, i + 1)),
          numero: String(i),
          ganhou,
          regiao: null,
        },
        alvo: ganhou ? 1 : 0,
        features,
      };
    });
    const model = treinarRegressaoLogistica(examples, false);
    const lowFeatures = examples[0].features;
    const highFeatures = examples[200].features;

    expect(preverComLogistica(model, lowFeatures)).toBeGreaterThan(
      preverComLogistica(model, highFeatures) + 0.2
    );
  });
});
