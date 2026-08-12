import { describe, it, expect } from "vitest";
import { fmtBrl, fmtNum, fmtPct, pct, fmtDate, fmtBrlCompact } from "./format";

describe("format", () => {
  it("fmtBrl formata moeda pt-BR", () => {
    expect(fmtBrl(1234.5)).toContain("1.234,50");
    expect(fmtBrl(null)).toBe("—");
  });

  it("fmtBrlCompact abrevia milhares e milhões", () => {
    expect(fmtBrlCompact(1_500_000)).toBe("R$ 1,5 mi");
    expect(fmtBrlCompact(34_500)).toBe("R$ 34,5 mil");
    expect(fmtBrlCompact(123)).toBe("R$ 123");
  });

  it("fmtNum respeita casas decimais", () => {
    expect(fmtNum(1234)).toBe("1.234");
    expect(fmtNum(1234.56, 2)).toBe("1.234,56");
  });

  it("fmtPct e pct", () => {
    expect(fmtPct(12.34)).toBe("12,3%");
    expect(pct(50, 200)).toBe(25);
    expect(pct(50, 0)).toBe(0);
  });

  it("fmtDate lida com string, Date e inválido", () => {
    expect(fmtDate(new Date(2025, 11, 31))).toBe("31/12/2025");
    expect(fmtDate("não é data")).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
  });
});
