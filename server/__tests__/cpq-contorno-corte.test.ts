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

describe("fundo derivado da silhueta da face", () => {
  const pvc = { id: 4521, nome: "PVC Expandido 10mm", lotes: [{ camada: "fundo" as const }], chapas };

  it("SVG só com a camada Face: o material do Fundo recebe a mesma silhueta (com o vazado) e um aviso", () => {
    const resultado = calcularFactibilidadeFabricacao({
      svg: envolver(`<g id="Face">${miolo}</g>`), larguraSvgMm: 1000, alturaSvgMm: 250, materiais: [material, pvc],
    });
    expect(resultado.status_factibilidade).toBe("APTO_NESTING");
    const porId = new Map(resultado.materiais.map(item => [item.id_materia_prima, item]));
    expect(porId.get(4520)!.pecas_para_nesting).toHaveLength(2);
    const fundo = porId.get(4521)!.pecas_para_nesting;
    expect(fundo).toHaveLength(2);
    expect(fundo.every(peca => peca.id.startsWith("fundo-"))).toBe(true);
    expect(resultado.avisos.some(aviso => /fundo de PVC Expandido 10mm usa a mesma silhueta da face/.test(aviso))).toBe(true);
  });

  it("com camada Fundo própria no SVG, não deriva da face", () => {
    const resultado = calcularFactibilidadeFabricacao({
      svg: envolver(`<g id="Face">${miolo}</g><g id="Fundo"><path d="${R}" fill="#000"/></g>`), larguraSvgMm: 1000, alturaSvgMm: 250, materiais: [pvc],
    });
    expect(resultado.materiais[0].pecas_para_nesting).toHaveLength(1);
    expect(resultado.avisos.some(aviso => /fundo de/.test(aviso))).toBe(false);
  });
});

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
