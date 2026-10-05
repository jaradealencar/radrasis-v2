import { describe, expect, it } from "vitest";
import { calcularFactibilidadeFabricacao } from "../services/cpqFactibilidadeFabricacao";

/**
 * O contorno de corte CNC é uma silhueta de uma cor só. A factibilidade separa as peças por camada, então o SVG do
 * Vectorizer (sem camadas) precisa do grupo "Face" — o CPQ o acrescenta antes de enviar.
 */
const chapas = [{ id: 1, nome: "1000 x 2000", larguraMm: 1000, alturaMm: 2000 }];
const material = { id: 4520, nome: "Acrílico transparente 3mm", lotes: [{ camada: "face" as const }], chapas };

// "O" com vazado (anel externo + anel interno) e um retângulo
const O = "M100 20H220V220H100Z M130 50V190H190V50Z";
const R = "M300 20H400V120H300Z";
const miolo = `<path d="${O}" fill="#000" fill-rule="evenodd"/><path d="${R}" fill="#000"/>`;
const envolver = (corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 250" width="1000" height="250">${corpo}</svg>`;

describe("contorno de corte CNC na factibilidade", () => {
  it("SVG sem camadas não tem peças na camada Face (por isso o CPQ acrescenta o grupo)", () => {
    expect(() => calcularFactibilidadeFabricacao({ svg: envolver(miolo), larguraSvgMm: 1000, alturaSvgMm: 250, materiais: [material] }))
      .toThrow(/camadas face/);
  });

  it("com o grupo Face, cada contorno externo vira uma peça e o vazado fica dentro dela", () => {
    const resultado = calcularFactibilidadeFabricacao({
      svg: envolver(`<g id="Face">${miolo}</g>`), larguraSvgMm: 1000, alturaSvgMm: 250, materiais: [material],
    });
    expect(resultado.status_factibilidade).toBe("APTO_NESTING");
    const pecas = resultado.materiais[0].pecas_para_nesting ?? [];
    expect(pecas).toHaveLength(2);
  });
});
