import { describe, expect, it } from "vitest";
import { classificarClientePorRecencia } from "../routers/performanceComercial";

// Referência: propostas de setembro/2026 (mes=9, ano=2026)
const MES = 9;
const ANO = 2026;

describe("classificarClientePorRecencia (estrela das propostas de alto valor)", () => {
  it("sem nenhuma compra registrada antes do mês → novo (estrela amarela)", () => {
    expect(classificarClientePorRecencia(undefined, undefined, MES, ANO))
      .toEqual({ status: "novo", mesesSemComprar: null });
  });

  it("última compra há exatamente 6 meses (03/2026) → reativado", () => {
    expect(classificarClientePorRecencia({ mes: 3, ano: 2026 }, undefined, MES, ANO))
      .toEqual({ status: "reativado", mesesSemComprar: 6 });
  });

  it("última compra há 5 meses (04/2026) → cliente ativo, sem estrela", () => {
    expect(classificarClientePorRecencia({ mes: 4, ano: 2026 }, undefined, MES, ANO))
      .toEqual({ status: null, mesesSemComprar: null });
  });

  it("conta meses de calendário atravessando o ano (12/2025 → 09/2026 = 9 meses)", () => {
    expect(classificarClientePorRecencia({ mes: 12, ano: 2025 }, undefined, MES, ANO))
      .toEqual({ status: "reativado", mesesSemComprar: 9 });
  });

  it("override manual 'recorrente' tira a estrela mesmo sem compra registrada", () => {
    expect(classificarClientePorRecencia(undefined, "recorrente", MES, ANO))
      .toEqual({ status: null, mesesSemComprar: null });
    expect(classificarClientePorRecencia({ mes: 1, ano: 2025 }, "recorrente", MES, ANO))
      .toEqual({ status: null, mesesSemComprar: null });
  });

  it("override manual 'novo' força a estrela: amarela sem compra anterior, vermelha com compra", () => {
    expect(classificarClientePorRecencia(undefined, "novo", MES, ANO).status).toBe("novo");
    expect(classificarClientePorRecencia({ mes: 8, ano: 2026 }, "novo", MES, ANO))
      .toEqual({ status: "reativado", mesesSemComprar: 1 });
  });
});
