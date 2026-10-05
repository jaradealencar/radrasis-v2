import { describe, expect, it } from "vitest";
import {
  chaveExataPantone, hexDoPantone, hexesDoPantone, listaPantoneValida, normalizarListaPantone, separarPantones,
} from "../../shared/pantone-referencia";

describe("várias referências Pantone na mesma célula", () => {
  it("separa o que foi digitado na tela: '021 C  804 C' (dois espaços) e '021 C 804 C' (um espaço)", () => {
    expect(separarPantones("021 C  804 C")).toEqual(["021 C", "804 C"]);
    expect(separarPantones("021 C 804 C")).toEqual(["021 C", "804 C"]);
  });

  it("aceita vírgula, ponto e vírgula, barra, +, e, ou e quebra de linha", () => {
    for (const texto of ["185 C, 299 C", "185 C; 299 C", "185 C / 299 C", "185 C + 299 C", "185 C e 299 C", "185 C ou 299 C", "185 C\n299 C"]) {
      expect(separarPantones(texto)).toEqual(["185 C", "299 C"]);
    }
  });

  it("três referências, com prefixo PMS/Pantone e sem sufixo", () => {
    expect(separarPantones("PMS 185 PMS 299 pantone 286")).toEqual(["PMS 185", "PMS 299", "PANTONE 286"]);
    expect(separarPantones("185 299 286")).toEqual(["185", "299", "286"]);
  });

  it("nomes continuam inteiros e repetidos somem", () => {
    expect(separarPantones("Orange 021, Process Yellow")).toEqual(["ORANGE 021", "PROCESS YELLOW"]);
    expect(separarPantones("185 C, 185c, PMS 185 C")).toEqual(["185 C", "185C"].slice(0, 1));
  });

  it("uma única referência continua uma referência", () => {
    expect(separarPantones("185 C")).toEqual(["185 C"]);
    expect(separarPantones("")).toEqual([]);
    expect(separarPantones(null)).toEqual([]);
  });

  it("normaliza para o texto salvo", () => {
    expect(normalizarListaPantone("021 c  804 c")).toBe("021 C, 804 C");
    expect(normalizarListaPantone("   ")).toBeNull();
  });

  it("limita a 6 referências de até 30 caracteres", () => {
    expect(listaPantoneValida("1 C, 2 C, 3 C, 4 C, 5 C, 6 C")).toBe(true);
    expect(listaPantoneValida("1 C, 2 C, 3 C, 4 C, 5 C, 6 C, 7 C")).toBe(false);
    expect(listaPantoneValida("x".repeat(31))).toBe(false);
  });

  it("acha a amostra ignorando o sufixo de cobertura e o alias Orange 021", () => {
    expect(hexDoPantone("185 C")).toBe(hexDoPantone("PMS 185"));
    expect(hexDoPantone("185U")).toBe(hexDoPantone("185"));
    expect(hexDoPantone("021 C")).toBe(hexDoPantone("Orange 021"));
    expect(hexDoPantone("185 C")).not.toBeNull();
  });

  it("não confunde nome terminado em c, u ou m com sufixo de cobertura", () => {
    expect(hexDoPantone("Platinum")).toBeNull();
  });

  it("indica quais referências têm amostra e quais não", () => {
    const itens = hexesDoPantone("021 C  999999 C");
    expect(itens[0]).toEqual({ codigo: "021 C", hex: hexDoPantone("Orange 021") });
    expect(itens[1].hex).toBeNull();
  });

  it("chave exata ignora espaço, caixa e prefixo PMS", () => {
    expect(chaveExataPantone("PMS 185 C")).toBe(chaveExataPantone("pantone 185c"));
    expect(chaveExataPantone("185 C")).not.toBe(chaveExataPantone("185 U"));
  });
});
