import { describe, expect, it } from "vitest";
import { normalizarIdsTabelaPrecos } from "../integrations/priceTableIds";

const section = (contentJson: unknown) => ({
  contentJson: JSON.stringify(contentJson),
});

describe("normalizarIdsTabelaPrecos", () => {
  it("atribui IDs persistentes para faixas sem conflitar com outras seções", () => {
    const atual = {
      type: "margin_table",
      columns: ["Até 10 cm", "Acima de 10 cm"],
      rows: [{ id: 4, label: "Letreiro", values: ["1,2", "1,4"] }],
    };
    const other = section({
      type: "margin_table",
      columns: ["Faixa"],
      faixaIds: [1],
      rows: [{ id: 1 }],
    });

    const normalized = JSON.parse(
      normalizarIdsTabelaPrecos(JSON.stringify(atual), [other])
    );

    expect(normalized.faixaIds).toEqual([2, 3]);
    expect(normalized.rows[0].id).toBe(4);
  });

  it("preserva os IDs das faixas existentes quando a seção é editada", () => {
    const atual = {
      type: "margin_table_multi",
      columns: ["Material", "Até 10 cm", "Acima de 10 cm"],
      faixaIds: [31, 32],
      rows: [{ id: 17, label: "Inox", values: ["1,2", "1,4"] }],
    };

    const normalized = JSON.parse(
      normalizarIdsTabelaPrecos(JSON.stringify(atual), [])
    );

    expect(normalized.faixaIds).toEqual([31, 32]);
    expect(normalized.rows[0].id).toBe(17);
  });

  it("gera um ID novo ao acrescentar uma faixa e mantém as anteriores", () => {
    const atual = {
      type: "margin_table",
      columns: ["Até 10 cm", "Acima de 10 cm", "Especial"],
      faixaIds: [31, 32],
      rows: [{ id: 17, label: "Letreiro", values: ["1,2", "1,4", "1,8"] }],
    };

    const normalized = JSON.parse(
      normalizarIdsTabelaPrecos(JSON.stringify(atual), [])
    );

    expect(normalized.faixaIds).toEqual([31, 32, 33]);
  });
});
