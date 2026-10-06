import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BASES_COBRANCA_PRODUTO, baseCobrancaValida } from "../../shared/base-cobranca-produto";

/**
 * Base de cobrança do produto no cadastro de kits do CPQ (pedido de 06/10/2026): área líquida, área geral, perímetro ou unidade,
 * a mesma lógica das matérias-primas. O servidor só aceita as chaves de fórmula "comuns"; o HTML repete a lista e as fórmulas.
 */
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => null } } }));
const { kitSchema } = await import("../routes/estudio-kits");

describe("base de cobrança do produto", () => {
  it("aceita cada base conhecida e a ausência de base (cada linha define a sua fórmula)", () => {
    for (const base of BASES_COBRANCA_PRODUTO) expect(kitSchema.safeParse({ linhas: [], baseCobranca: base }).success).toBe(true);
    expect(kitSchema.safeParse({ linhas: [] }).success).toBe(true);
    expect(kitSchema.safeParse({ linhas: [], baseCobranca: null }).success).toBe(true);
  });

  it("recusa fórmulas específicas e valores inventados como base", () => {
    for (const invalida of ["gabaritoKraft", "soldaPerimAte11", "perimetro", "AREA", ""])
      expect(kitSchema.safeParse({ linhas: [], baseCobranca: invalida }).success, invalida).toBe(false);
  });

  it("baseCobrancaValida normaliza o que não for base conhecida para null", () => {
    expect(baseCobrancaValida("area")).toBe("area");
    expect(baseCobrancaValida("fixo")).toBe("fixo");
    expect(baseCobrancaValida("gabaritoKraft")).toBeNull();
    expect(baseCobrancaValida(undefined)).toBeNull();
  });

  it("o HTML do CPQ repete exatamente a mesma lista de bases e todas existem em FORMULA_TYPES", () => {
    const html = readFileSync("client/public/cpq-letreiros-express.html", "utf8");
    const lista = /const BASES_COBRANCA_PRODUTO = \[([^\]]+)\];/.exec(html)?.[1];
    expect(lista).toBeDefined();
    const doHtml = [...lista!.matchAll(/'([A-Za-z]+)'/g)].map(item => item[1]);
    expect(doHtml).toEqual([...BASES_COBRANCA_PRODUTO]);
    const formulas = /const FORMULA_TYPES = \{([\s\S]*?)\n\};/.exec(html)?.[1] ?? "";
    for (const base of BASES_COBRANCA_PRODUTO) expect(formulas, base).toMatch(new RegExp(`\\n  ${base}: \\{label:`));
  });
});
