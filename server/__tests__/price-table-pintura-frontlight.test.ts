import { describe, expect, it } from "vitest";
import { margemEquivalenteParaReducaoDePreco } from "../../shared/price-table-pintura";

describe("margemEquivalenteParaReducaoDePreco", () => {
  it("calcula a margem equivalente a um desconto no preço final", () => {
    expect(margemEquivalenteParaReducaoDePreco("45,8%", 20)).toBe("32,25%");
    expect(margemEquivalenteParaReducaoDePreco("37,8%", 20)).toBe("22,25%");
  });

  it("mantém explícita a margem negativa quando o desconto passa do custo", () => {
    expect(margemEquivalenteParaReducaoDePreco("17,8%", 20)).toBe("-2,75%");
  });

  it("preserva valores que não sejam margem percentual", () => {
    expect(margemEquivalenteParaReducaoDePreco("NÃO DISPONÍVEL", 20)).toBe(
      "NÃO DISPONÍVEL"
    );
  });
});
