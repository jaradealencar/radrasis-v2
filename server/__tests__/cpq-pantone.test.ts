import { describe, expect, it } from "vitest";
import { hexDoPantone, PANTONE_REFERENCIA } from "../../shared/pantone-referencia";
import { listarPantone, pantoneMaisProximos, rgbParaCmykAproximado } from "../services/cpqPantone";

describe("referência Pantone do CPQ", () => {
  it("tem códigos únicos e cores hexadecimais válidas", () => {
    const codigos = PANTONE_REFERENCIA.map(([codigo]) => codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(PANTONE_REFERENCIA.every(([, hex]) => /^#[0-9A-F]{6}$/.test(hex))).toBe(true);
    expect(listarPantone().length).toBe(PANTONE_REFERENCIA.length);
  });

  it("devolve a própria amostra como a mais próxima, com diferença zero", () => {
    const [codigo, hex] = PANTONE_REFERENCIA.find(([nome]) => nome === "PMS 185")!;
    const [primeiro] = pantoneMaisProximos(hex, 3)!;
    expect(primeiro.codigo).toBe(codigo);
    expect(primeiro.deltaE00).toBe(0);
  });

  it("acha um Pantone amarelo para o amarelo do logotipo", () => {
    const [primeiro] = pantoneMaisProximos("#FFC700", 3)!;
    expect(primeiro.deltaE00).toBeLessThan(8);
    const hex = hexDoPantone(primeiro.codigo)!;
    expect(parseInt(hex.slice(1, 3), 16)).toBeGreaterThan(200);
  });

  it("rejeita cor inválida e aceita código com ou sem PMS", () => {
    expect(pantoneMaisProximos("não é cor")).toBeNull();
    expect(hexDoPantone("pms 185")).toBe(hexDoPantone("185"));
    expect(hexDoPantone("inexistente")).toBeNull();
  });

  it("converte RGB em CMYK aproximado", () => {
    expect(rgbParaCmykAproximado([255, 255, 255])).toEqual({ c: 0, m: 0, y: 0, k: 0 });
    expect(rgbParaCmykAproximado([0, 0, 0])).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(rgbParaCmykAproximado([255, 0, 0])).toEqual({ c: 0, m: 100, y: 100, k: 0 });
  });
});
