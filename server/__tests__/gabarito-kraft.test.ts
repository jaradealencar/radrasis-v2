import { describe, expect, it } from "vitest";
import { consumoGabaritoKraftM2, faixasGabaritoKraft } from "../../shared/gabarito";

describe("gabarito de kraft (bobina de 1200 mm)", () => {
  it("usa uma faixa até a largura da bobina", () => {
    expect(faixasGabaritoKraft(0.9)).toBe(1);
    expect(faixasGabaritoKraft(1.2)).toBe(1);
  });

  it("repete o papel em faixas quando a altura passa da bobina", () => {
    expect(faixasGabaritoKraft(1.3)).toBe(2);
    expect(faixasGabaritoKraft(2.4)).toBe(2);
    expect(faixasGabaritoKraft(2.5)).toBe(3);
  });

  it("cobra faixas × 1,2 m × largura do letreiro", () => {
    expect(consumoGabaritoKraftM2(2, 0.9)).toBeCloseTo(2.4, 6);
    expect(consumoGabaritoKraftM2(2, 1.9)).toBeCloseTo(4.8, 6);
    expect(consumoGabaritoKraftM2(0.5, 2.5)).toBeCloseTo(1.8, 6);
  });
});
