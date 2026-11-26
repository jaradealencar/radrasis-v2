import { describe, expect, it } from "vitest";
import { formatarValorParaColar } from "../../shared/price-table-clipboard";

describe("formatarValorParaColar", () => {
  it("converte valores monetários para os dígitos esperados pela máscara 0,00", () => {
    expect(formatarValorParaColar("R$ 31,00")).toBe("3100");
    expect(formatarValorParaColar("31.00")).toBe("3100");
    expect(formatarValorParaColar("31,2")).toBe("3120");
    expect(formatarValorParaColar("31.2")).toBe("3120");
    expect(formatarValorParaColar("1.250,00")).toBe("125000");
    expect(formatarValorParaColar("R$ 31")).toBe("3100");
  });

  it("mantém percentuais como algarismos, sem multiplicá-los por 100", () => {
    expect(formatarValorParaColar("31%")).toBe("31");
    expect(formatarValorParaColar("31,2%")).toBe("312");
  });

  it("preserva números inteiros sem símbolo monetário", () => {
    expect(formatarValorParaColar("31")).toBe("31");
  });
});
