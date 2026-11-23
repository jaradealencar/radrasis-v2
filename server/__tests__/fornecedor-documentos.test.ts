import { describe, expect, it } from "vitest";
import { identidadeNfFornecedor, normalizarNomeFornecedorDocumento } from "../services/fornecedorDocumentos";

describe("identificação de documentos de fornecedores", () => {
  it("não conta outra compra por pontuação no CNPJ ou zeros na numeração", () => {
    expect(identidadeNfFornecedor({ cnpj: "12.345.678/0001-90", numero: "000123", serie: "001" }))
      .toBe(identidadeNfFornecedor({ cnpj: "12345678000190", numero: "123", serie: "1" }));
  });
  it("não usa apenas o número da NF para contar compras", () => {
    expect(identidadeNfFornecedor({ cnpj: "12345678000190", numero: "123" })).toBeNull();
    expect(identidadeNfFornecedor({ numero: "123", serie: "1" })).toBeNull();
  });
  it("distingue fornecedores com o mesmo número de NF", () => {
    expect(identidadeNfFornecedor({ cnpj: "12345678000190", numero: "123", serie: "1" }))
      .not.toBe(identidadeNfFornecedor({ cnpj: "12345678000191", numero: "123", serie: "1" }));
  });
  it("reconhece variações de razão social sem misturar nomes distintos", () => {
    expect(normalizarNomeFornecedorDocumento("BOLD S.A.")).toBe(normalizarNomeFornecedorDocumento("Bold SA"));
    expect(normalizarNomeFornecedorDocumento("Aço Teste Ltda")).toBe(normalizarNomeFornecedorDocumento("ACO TESTE"));
    expect(normalizarNomeFornecedorDocumento("Bold")).not.toBe(normalizarNomeFornecedorDocumento("Bold Acrílicos"));
  });
});
