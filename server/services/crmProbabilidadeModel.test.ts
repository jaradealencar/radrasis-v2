import { describe, expect, it } from "vitest";
import {
  calcularProbabilidadeCrmAprendida,
  CRM_PROBABILITY_FEATURE_NAMES,
  CRM_PROBABILITY_MIN_TRAINING_EXAMPLES,
  CRM_PROBABILITY_TICKET_BANDS,
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
    expect(result.explicacao[0]).toContain("calibração temporal válida");
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
