import { describe, expect, it } from "vitest";
import { HISTORICO_ORC_COLS, orcParaLinha } from "./scheduled-sync-historico";

describe("orcParaLinha", () => {
  it("normaliza cidade e UF do endereço do orçamento", () => {
    const linha = orcParaLinha({
      sequencial_orcamento: 42,
      cliente: "Cliente de teste",
      cliente_endereco: [{ cidade: "  Campo Grande  ", estado: "ms" }],
    } as any, 11, 2026);

    expect(linha).toMatchObject({
      orcNumero: "42",
      cidade: "Campo Grande",
      estado: "MS",
      mes: 11,
      ano: 2026,
    });
  });

  it("aceita endereço singular dentro do objeto do cliente", () => {
    const linha = orcParaLinha({
      id: 7,
      cliente: { nome: "Cliente de teste", endereco: { cidade: "Cuiabá", uf: "MT" } },
    } as any, 10, 2026);

    expect(linha).toMatchObject({ cidade: "Cuiabá", estado: "MT" });
  });

  it("mantém cidade e descarta sigla de estado inválida", () => {
    const linha = orcParaLinha({
      id: 8,
      cliente: "Cliente de teste",
      cliente_endereco: [{ cidade: "Várzea Grande", estado: "XX" }],
    } as any, 9, 2026);

    expect(linha).toMatchObject({ cidade: "Várzea Grande", estado: null });
  });

  it("inclui os campos de região no upsert do histórico de orçamentos", () => {
    expect(HISTORICO_ORC_COLS).toContain("cidade");
    expect(HISTORICO_ORC_COLS).toContain("estado");
  });
});
