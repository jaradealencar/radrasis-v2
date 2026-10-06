import { describe, expect, it } from "vitest";
import { calcularFactibilidadeFabricacao, contornosFisicosDoSvg } from "../services/cpqFactibilidadeFabricacao";

/**
 * Emendas (cortes) de peças maiores que a chapa: as linhas vão para os pontos de menor material e o fatiamento não perde
 * nada, qualquer que seja a posição da peça no desenho.
 */
const chapas = [{ id: 1, nome: "2080 x 1000", larguraMm: 2080, alturaMm: 1000 }]; // útil: 2080 - 40 = 2040 mm de comprimento
const material = { id: 1, nome: "Chapa", lotes: [{ camada: "face" as const }], chapas };
const envolver = (corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 700" width="4000" height="700"><g id="Face">${corpo}</g></svg>`;

const areaFragmentos = (r: ReturnType<typeof calcularFactibilidadeFabricacao>) => r.materiais[0].pecas_para_nesting.reduce((soma, peca) => {
  const [poligono] = contornosFisicosDoSvg(peca.svg, peca.larguraMm, peca.alturaMm);
  const anel = (a: number[][]) => Math.abs(a.reduce((t, [x1, y1], k) => { const [x2, y2] = a[(k + 1) % a.length]; return t + x1 * y2 - x2 * y1; }, 0)) / 2;
  return soma + poligono.reduce((s, a, i) => s + (i === 0 ? anel(a) : -anel(a)), 0);
}, 0);

describe("fatiamento sem perder material", () => {
  it.each([0, 500, 733.5])("peça que começa em x=%s: os fragmentos somam toda a área e a largura", x0 => {
    const r = calcularFactibilidadeFabricacao({
      svg: envolver(`<path d="M${x0} 100H${x0 + 3100}V400H${x0}Z"/>`), larguraSvgMm: 4000, alturaSvgMm: 700, materiais: [material],
    });
    expect(r.status_factibilidade).toBe("REQUER_APROVACAO_EMENDA");
    expect(areaFragmentos(r)).toBeCloseTo(3100 * 300, 0);
    const pecas = r.materiais[0].pecas_para_nesting;
    expect(pecas.reduce((soma, peca) => soma + peca.larguraMm, 0)).toBeCloseTo(3100, 3);
    // a linha de corte fica dentro da peça: x0 + 2040 (retângulo uniforme = intervalos iguais)
    expect(r.detalhes_corte.coordenadas_linha_corte[0].x1).toBeCloseTo(x0 + 2040, 3);
  });
});

describe("emenda no ponto de menor material", () => {
  // Halteres: bloco esquerdo 0–1500, ponte fina 1500–1700 (40 mm), bloco direito 1700–3200. Alvo do corte: 2040 (no meio do bloco direito).
  const halteres = "M0 100H1500V230H1700V100H3200V500H1700V370H1500V500H0Z";

  it("recua o corte até a ponte fina em vez de cortar o bloco inteiro", () => {
    const r = calcularFactibilidadeFabricacao({ svg: envolver(`<path d="${halteres}"/>`), larguraSvgMm: 4000, alturaSvgMm: 700, materiais: [material] });
    const [linha] = r.detalhes_corte.coordenadas_linha_corte;
    expect(linha.x1).toBeGreaterThanOrEqual(1500 - 1e-6);
    expect(linha.x1).toBeLessThanOrEqual(1700 + 1e-6);
    expect(linha.materialCortadoMm).toBeCloseTo(140, 1); // ponte de 140 mm (230→370), contra 400 mm de um corte no bloco
    expect(r.avisos.some(aviso => /menor material/.test(aviso))).toBe(true);
  });

  it("os fragmentos continuam cobrindo a peça inteira", () => {
    const r = calcularFactibilidadeFabricacao({ svg: envolver(`<path d="${halteres}"/>`), larguraSvgMm: 4000, alturaSvgMm: 700, materiais: [material] });
    const areaPeca = 1500 * 400 + 200 * 140 + 1500 * 400;
    expect(areaFragmentos(r)).toBeCloseTo(areaPeca, 0);
  });

  it("corta num vão entre dois blocos (zero de material cortado)", () => {
    // dois blocos separados por vão de 100 mm, ligados por uma peça só? Aqui são peças distintas no mesmo caminho: o vão é o melhor corte.
    const dois = "M0 100H1600V500H0Z M1700 100H3200V500H1700Z";
    const r = calcularFactibilidadeFabricacao({ svg: envolver(`<path d="${dois}"/>`), larguraSvgMm: 4000, alturaSvgMm: 700, materiais: [material] });
    // cada bloco (1600 e 1500) cabe nos 2040 úteis: não há o que fatiar
    expect(r.status_factibilidade).toBe("APTO_NESTING");
  });
});
