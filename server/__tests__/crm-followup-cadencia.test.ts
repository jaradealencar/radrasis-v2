import { describe, expect, it } from "vitest";
import { montarEtapasCrmFollowup, proximoEnvioEtapaCrm } from "../services/crmFollowupCadencia";

const faixas = [
  { faixa: 1 as const, diasInicio: 1, diasFim: 2 },
  { faixa: 2 as const, diasInicio: 3, diasFim: 5 },
  { faixa: 3 as const, diasInicio: 6, diasFim: 10 },
];

describe("agendamento automático das faixas CRM", () => {
  it("usa a primeira data útil ainda disponível de cada faixa", () => {
    const resultado = montarEtapasCrmFollowup({
      dataCriacao: "2026-11-16T10:00:00",
      agora: new Date("2026-11-18T13:00:00.000Z"),
      faixas,
      templates: ["crm-f1", "crm-f2", "crm-f3"],
    });

    expect(resultado.etapas.map(etapa => etapa.faixaCrm)).toEqual([1, 2, 3]);
    expect(resultado.etapas.map(etapa => [etapa.dataInicioCrm, etapa.dataFimCrm])).toEqual([
      ["2026-11-18", "2026-11-18"],
      ["2026-11-19", "2026-11-23"],
      ["2026-11-24", "2026-11-30"],
    ]);
    expect(resultado.primeiroEnvioEm?.toISOString()).toBe("2026-11-18T13:00:00.000Z");
  });

  it("ignora faixas que já expiraram e mantém os templates da faixa correta", () => {
    const resultado = montarEtapasCrmFollowup({
      dataCriacao: "2026-11-16",
      agora: new Date("2026-11-20T13:00:00.000Z"),
      faixas,
      templates: ["crm-f1", "crm-f2", "crm-f3"],
    });

    expect(resultado.etapas.map(etapa => etapa.faixaCrm)).toEqual([2, 3]);
    expect(resultado.etapas.map(etapa => etapa.numero)).toEqual([1, 2]);
    expect(resultado.etapas.map(etapa => etapa.templateId)).toEqual(["crm-f2", "crm-f3"]);
  });

  it("não agenda etapas depois do fim da última faixa", () => {
    const resultado = montarEtapasCrmFollowup({
      dataCriacao: "2026-11-02",
      agora: new Date("2026-11-20T13:00:00.000Z"),
      faixas,
      templates: ["crm-f1", "crm-f2", "crm-f3"],
    });

    expect(resultado.etapas).toEqual([]);
    expect(resultado.primeiroEnvioEm).toBeNull();
  });

  it("não desloca uma etapa para fora de sua janela CRM", () => {
    const etapa = {
      numero: 2,
      templateId: "crm-f2",
      atrasoDiasUteis: 0,
      faixaCrm: 2 as const,
      dataInicioCrm: "2026-11-19",
      dataFimCrm: "2026-11-23",
    };
    expect(proximoEnvioEtapaCrm(etapa, new Date("2026-11-18T13:00:00.000Z"))?.toISOString())
      .toBe("2026-11-19T12:30:00.000Z");
    expect(proximoEnvioEtapaCrm(etapa, new Date("2026-11-24T13:00:00.000Z"))).toBeNull();
  });

  it("keeps national holidays as CRM weekdays, matching the visible CRM bands", () => {
    const resultado = montarEtapasCrmFollowup({
      dataCriacao: "2026-11-18",
      agora: new Date("2026-11-20T14:00:00.000Z"),
      faixas,
      templates: ["crm-f1", "crm-f2", "crm-f3"],
    });

    expect(resultado.etapas[0].dataInicioCrm).toBe("2026-11-20");
    expect(resultado.primeiroEnvioEm?.toISOString()).toBe("2026-11-20T14:00:00.000Z");
  });
});
