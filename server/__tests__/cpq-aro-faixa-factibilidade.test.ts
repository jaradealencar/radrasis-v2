import { describe, expect, it } from "vitest";
import { calcularFactibilidadeFabricacao, type CpqPecaParaNesting } from "../services/cpqFactibilidadeFabricacao";

/**
 * Aro = chapa metálica com o miolo cortado (só a faixa das bordas), que sustenta a face de acrílico no frontlight.
 * Sem camada "Aro" no SVG, a factibilidade gera a faixa a partir da silhueta da face (largura em `faixaDaFaceMm`, padrão do CPQ 6 mm).
 */
const chapas = [{ id: 1, nome: "1000 x 2000", larguraMm: 1000, alturaMm: 2000 }];
const aro = (faixaDaFaceMm?: number) => ({
  id: 4530,
  nome: "Chapa galvanizada 1,2 mm",
  lotes: [{ camada: "aro" as const, ...(faixaDaFaceMm == null ? {} : { faixaDaFaceMm }) }],
  chapas,
});
const face = { id: 4520, nome: "Acrílico branco 3 mm", lotes: [{ camada: "face" as const }], chapas };

// 1 unidade do SVG = 1 mm. "O": anel externo 120×200 com vazado 60×140; "R": retângulo 100×100.
const O = "M100 20H220V220H100Z M130 50V190H190V50Z";
const R = "M300 20H400V120H300Z";
const miolo = `<path d="${O}" fill="#000" fill-rule="evenodd"/><path d="${R}" fill="#000"/>`;
const envolver = (corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 250" width="1000" height="250">${corpo}</svg>`;
const entrada = (corpo: string, materiais: Parameters<typeof calcularFactibilidadeFabricacao>[0]["materiais"]) =>
  ({ svg: envolver(corpo), larguraSvgMm: 1000, alturaSvgMm: 250, materiais });

/** Área líquida (mm²) de uma peça: o primeiro anel do caminho é o externo e os demais são furos. */
function areaDaPeca(peca: CpqPecaParaNesting): number {
  const d = /\sd="([^"]+)"/.exec(peca.svg)![1];
  const aneis = d.split("M").map(parte => parte.trim()).filter(Boolean).map(parte =>
    [...parte.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(m => [Number(m[1]), Number(m[2])] as [number, number]));
  const area = (anel: Array<[number, number]>) => Math.abs(anel.reduce((soma, p, i) => {
    const q = anel[(i + 1) % anel.length];
    return soma + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
  const [externo, ...furos] = aneis;
  return area(externo) - furos.reduce((soma, furo) => soma + area(furo), 0);
}

describe("aro gerado como faixa da face (SVG só com a camada Face)", () => {
  const resultado = calcularFactibilidadeFabricacao(entrada(`<g id="Face">${miolo}</g>`, [face, aro(6)]));
  const porId = new Map(resultado.materiais.map(item => [item.id_materia_prima, item]));
  const pecasAro = porId.get(4530)!.pecas_para_nesting;

  it("é apto para nesting e avisa que o aro foi gerado, com a largura da faixa", () => {
    expect(resultado.status_factibilidade).toBe("APTO_NESTING");
    expect(resultado.avisos.some(aviso => /aro de Chapa galvanizada 1,2 mm foi gerado como uma faixa de 6 mm/.test(aviso))).toBe(true);
  });

  it("cada anel de metal é uma peça: faixa externa do O, faixa em volta do vazado e faixa do retângulo", () => {
    expect(pecasAro).toHaveLength(3);
    expect(pecasAro.every(peca => peca.id.startsWith("aro-"))).toBe(true);
    const medidas = pecasAro.map(peca => `${Math.round(peca.larguraMm)}x${Math.round(peca.alturaMm)}`).sort();
    expect(medidas).toEqual(["100x100", "120x200", "72x152"].sort());
  });

  it("só sobram as bordas: ≈ 8,5 mil mm² de metal contra 25,6 mil mm² da face inteira", () => {
    const total = pecasAro.reduce((soma, peca) => soma + areaDaPeca(peca), 0);
    const esperado = (120 * 200 - 108 * 188) + (400 * 6 + Math.PI * 6 * 6) + (100 * 100 - 88 * 88);
    expect(Math.abs(total - esperado)).toBeLessThan(15);
    const faceInteira = porId.get(4520)!.pecas_para_nesting.reduce((soma, peca) => soma + areaDaPeca(peca), 0);
    expect(faceInteira).toBeCloseTo(120 * 200 - 60 * 140 + 100 * 100, 0);
    expect(total).toBeLessThan(faceInteira / 2);
  });

  it("a largura da faixa muda a peça (10 mm deixa o anel do vazado maior)", () => {
    const larga = calcularFactibilidadeFabricacao(entrada(`<g id="Face">${miolo}</g>`, [aro(10)]));
    const medidas = larga.materiais[0].pecas_para_nesting.map(peca => `${Math.round(peca.larguraMm)}x${Math.round(peca.alturaMm)}`).sort();
    expect(medidas).toEqual(["100x100", "120x200", "80x160"].sort());
    expect(larga.avisos.some(aviso => /faixa de 10 mm/.test(aviso))).toBe(true);
  });
});

describe("quando o aro NÃO é gerado da face", () => {
  it("sem largura da faixa no lote, o aro continua exigindo camada própria no SVG (comportamento antigo)", () => {
    expect(() => calcularFactibilidadeFabricacao(entrada(`<g id="Face">${miolo}</g>`, [aro()]))).toThrow(/camadas aro/);
  });

  it("com camada Aro própria no SVG, usa o desenho do usuário e não gera faixa nem aviso", () => {
    const resultado = calcularFactibilidadeFabricacao(entrada(`<g id="Face">${miolo}</g><g id="Aro"><path d="${R}" fill="#000"/></g>`, [aro(6)]));
    const pecas = resultado.materiais[0].pecas_para_nesting;
    expect(pecas).toHaveLength(1);
    expect(Math.round(pecas[0].larguraMm)).toBe(100);
    expect(areaDaPeca(pecas[0])).toBeCloseTo(100 * 100, 0); // inteira, sem faixa
    expect(resultado.avisos.some(aviso => /foi gerado como uma faixa/.test(aviso))).toBe(false);
  });

  it("sem Face no SVG não há de onde tirar a faixa", () => {
    expect(() => calcularFactibilidadeFabricacao(entrada(`<g id="Fundo"><path d="${R}" fill="#000"/></g>`, [aro(6)]))).toThrow(/camadas aro/);
  });
});
