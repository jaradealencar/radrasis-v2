// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { construirFundo } from "../geometry/buildBackGeometry";
import { construirGeometriasFace } from "../geometry/buildFaceGeometry";
import { construirLayoutFixadores, construirLayoutLeds } from "../geometry/buildLedLayout";
import { buildReturnShellGeometry, construirParedeOca, perimetroDaFaixa } from "../geometry/buildReturnShellGeometry";
import { deslocarRegioes, diferencaDeRegioes, uniaoDeRegioes } from "../geometry/clipper";
import { areaDaRegiao, perimetroDoAnel, pontoNaRegiao, regiaoParaShape, type Regiao } from "../geometry/geometryUtils";
import { SvgInvalidoError, svgParaFormas } from "../svgToShapes";

const svg = (conteudo: string, viewBox = "0 0 1000 400") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${conteudo}</svg>`;
const preenchido = (d: string, extra = "") => `<path d="${d}" fill="#ffffff" stroke="#000000" ${extra}/>`;
const retangulo = (x: number, y: number, w: number, h: number) => `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`;
const retanguloInverso = (x: number, y: number, w: number, h: number) => `M${x} ${y} L${x} ${y + h} L${x + w} ${y + h} L${x + w} ${y} Z`;

/** Letras simplificadas (polígonos) que exercitam os vazados: O (1 furo), A (1 furo), B (2 furos), R (1 furo). */
const LETRA_O = `${retangulo(0, 0, 100, 140)} ${retanguloInverso(30, 30, 40, 80)}`;
const LETRA_A = `M0 140 L50 0 L100 140 Z M35 100 L65 100 L50 50 Z`;
const LETRA_B = `${retangulo(0, 0, 100, 140)} ${retanguloInverso(30, 20, 40, 40)} ${retanguloInverso(30, 80, 40, 40)}`;
const LETRA_R = `${retangulo(0, 0, 100, 140)} ${retanguloInverso(30, 20, 40, 40)}`;

function formasDe(d: string, extra = "") {
  return svgParaFormas(svg(preenchido(d, extra), "0 0 100 140"), { larguraMm: 100, alturaMm: 140 });
}

describe("SVG -> formas físicas", () => {
  it("escala para as medidas reais, centraliza na origem e vira Y para cima", () => {
    const resultado = svgParaFormas(svg(preenchido(retangulo(100, 50, 400, 200)), "0 0 1000 400"), { larguraMm: 800, alturaMm: 400 });
    const [forma] = resultado.formas;
    const xs = forma.regiao.outer.map(p => p.x), ys = forma.regiao.outer.map(p => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.8, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.4, 6);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0, 9);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(0, 9);
    expect(resultado.larguraMm).toBeCloseTo(800, 6);
  });

  it("letras A, B, O e R preservam os vazados", () => {
    expect(formasDe(LETRA_O).formas).toHaveLength(1);
    expect(formasDe(LETRA_O).formas[0].regiao.holes).toHaveLength(1);
    expect(formasDe(LETRA_A).formas[0].regiao.holes).toHaveLength(1);
    expect(formasDe(LETRA_B).formas[0].regiao.holes).toHaveLength(2);
    expect(formasDe(LETRA_R).formas[0].regiao.holes).toHaveLength(1);
    // área = externo − vazados (em m², na escala 100×140 mm)
    expect(areaDaRegiao(formasDe(LETRA_O).formas[0].regiao)).toBeCloseTo((100 * 140 - 40 * 80) / 1e6, 8);
    expect(areaDaRegiao(formasDe(LETRA_B).formas[0].regiao)).toBeCloseTo((100 * 140 - 2 * 40 * 40) / 1e6, 8);
  });

  it("respeita fill-rule: com evenodd o anel interno de mesmo sentido é vazado; com nonzero é preenchido", () => {
    const aneis = `${retangulo(0, 0, 100, 140)} ${retangulo(30, 30, 40, 80)}`;
    expect(formasDe(aneis, `fill-rule="evenodd"`).formas[0].regiao.holes).toHaveLength(1);
    expect(formasDe(aneis).formas[0].regiao.holes).toHaveLength(0);
  });

  it("vários caminhos e ilhas: cada <path> guarda o seu pathIndex (base das cores por região)", () => {
    const resultado = svgParaFormas(
      svg(`<g id="Face">${preenchido(retangulo(0, 0, 100, 100))}${preenchido(retangulo(200, 0, 100, 100))}<path d="${retangulo(400, 0, 50, 50)} ${retangulo(500, 0, 50, 50)}" fill="#fff"/></g>`, "0 0 600 100"),
      { larguraMm: 550, alturaMm: 100 },
    );
    expect(resultado.formas.map(f => f.pathIndex)).toEqual([0, 1, 2, 2]);
    expect(resultado.caminhosLidos).toBe(3);
    expect(resultado.avisos).toEqual([]);
  });

  it("aplica transforms dos elementos e ignora caminhos só de contorno", () => {
    const resultado = svgParaFormas(
      svg(`<g transform="translate(100 0) scale(2)">${preenchido(retangulo(0, 0, 50, 50))}</g><path d="${retangulo(300, 0, 10, 10)}" fill="none" stroke="#000"/>`, "0 0 500 100"),
      { larguraMm: 100, alturaMm: 100 },
    );
    expect(resultado.formas).toHaveLength(1);
    expect(resultado.larguraMm).toBeCloseTo(100, 6);
  });

  it("rejeita proporção incompatível com as medidas físicas e SVG inseguro", () => {
    expect(() => svgParaFormas(svg(preenchido(retangulo(0, 0, 200, 100))), { larguraMm: 200, alturaMm: 200 })).toThrow(SvgInvalidoError);
    expect(() => svgParaFormas(svg(`<script>alert(1)</script>${preenchido(retangulo(0, 0, 10, 10))}`), { larguraMm: 10, alturaMm: 10 })).toThrow(/recusado/);
    expect(() => svgParaFormas(svg(`<image href="https://x.test/a.png"/>${preenchido(retangulo(0, 0, 10, 10))}`), { larguraMm: 10, alturaMm: 10 })).toThrow(SvgInvalidoError);
  });
});

describe("clipper: offsets e booleanas", () => {
  const quadrado = (lado: number, cx = 0, cy = 0): Regiao => ({
    outer: [{ x: cx - lado / 2, y: cy - lado / 2 }, { x: cx + lado / 2, y: cy - lado / 2 }, { x: cx + lado / 2, y: cy + lado / 2 }, { x: cx - lado / 2, y: cy + lado / 2 }],
    holes: [],
  });

  it("encolhe e expande pela distância pedida; região fina some", () => {
    const [menor] = deslocarRegioes([quadrado(0.1)], -0.01);
    expect(areaDaRegiao(menor)).toBeCloseTo(0.08 * 0.08, 6);
    const [maior] = deslocarRegioes([quadrado(0.1)], 0.01, "miter");
    expect(areaDaRegiao(maior)).toBeCloseTo(0.12 * 0.12, 6);
    expect(deslocarRegioes([quadrado(0.01)], -0.01)).toEqual([]);
  });

  it("encolher uma região com vazado faz o vazado crescer", () => {
    const comFuro: Regiao = { outer: quadrado(0.1).outer, holes: [quadrado(0.02).outer] };
    const [r] = deslocarRegioes([comFuro], -0.005);
    expect(r.holes).toHaveLength(1);
    expect(areaDaRegiao(r)).toBeCloseTo(0.09 * 0.09 - 0.03 * 0.03, 4);
  });

  it("diferença e união", () => {
    const [d] = diferencaDeRegioes([quadrado(0.1)], [quadrado(0.04)]);
    expect(d.holes).toHaveLength(1);
    expect(areaDaRegiao(d)).toBeCloseTo(0.01 - 0.0016, 8);
    expect(uniaoDeRegioes([quadrado(0.1, 0), quadrado(0.1, 0.05)])).toHaveLength(1);
    expect(uniaoDeRegioes([quadrado(0.1, 0), quadrado(0.1, 1)])).toHaveLength(2);
  });
});

describe("lateral oca (retorno)", () => {
  const tile: [number, number] = [0.2, 0.2];
  const regiaoDa = (d: string) => formasDe(d).formas[0].regiao; // 100×140 mm

  it("tem a profundidade e a espessura reais: faixa = silhueta − miolo", () => {
    const parede = construirParedeOca(regiaoDa(LETRA_O), 0.08, 0.002, tile)!;
    parede.geometria.computeBoundingBox();
    const caixa = parede.geometria.boundingBox!;
    expect(caixa.min.z).toBeCloseTo(0, 6);
    expect(caixa.max.z).toBeCloseTo(0.08, 6);
    expect(parede.maciça).toBe(false);
    // O furo do O (40×80) cresce 2 mm; o externo (100×140) encolhe 2 mm. Os cantos do vazado que cresce ficam arredondados (junção
    // round do clipper), então a faixa real é ~0,3 % maior que a conta de retângulos.
    const esperada = (0.1 * 0.14 - 0.04 * 0.08) - (0.096 * 0.136 - 0.044 * 0.084);
    const obtida = parede.faixa.reduce((total, parte) => total + areaDaRegiao(parte), 0);
    expect(Math.abs(obtida - esperada) / esperada).toBeLessThan(0.01);
  });

  it("não é o miolo maciço: a geometria cobre só o contorno (volume da faixa, não da letra)", () => {
    const parede = construirParedeOca(regiaoDa(LETRA_R), 0.05, 0.0015, tile)!;
    const indice = parede.geometria.getIndex()!;
    const posicao = parede.geometria.getAttribute("position");
    let volume = 0;
    for (let i = 0; i < indice.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(k => ({ x: posicao.getX(indice.getX(i + k)), y: posicao.getY(indice.getX(i + k)), z: posicao.getZ(indice.getX(i + k)) }));
      volume += (a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x)) / 6;
    }
    const volumeFaixa = parede.faixa.reduce((total, parte) => total + areaDaRegiao(parte), 0) * 0.05;
    const volumeMacico = areaDaRegiao(regiaoDa(LETRA_R)) * 0.05;
    expect(Math.abs(volume)).toBeCloseTo(volumeFaixa, 7);
    expect(Math.abs(volume)).toBeLessThan(volumeMacico * 0.25);
  });

  it("UV: U acompanha o perímetro e V a profundidade, em metros/tile", () => {
    const parede = construirParedeOca(regiaoDa(LETRA_B), 0.06, 0.002, tile)!;
    const uv = parede.geometria.getAttribute("uv");
    const normal = parede.geometria.getAttribute("normal");
    let maxV = 0, somaU = 0;
    // Quads de parede = 4 vértices consecutivos com normal horizontal (as tampas vêm em blocos próprios).
    for (let i = 0; i < normal.count;) {
      if (Math.abs(normal.getZ(i)) > 1e-9) { i += 1; continue; }
      somaU += Math.abs(uv.getX(i + 1) - uv.getX(i));
      for (let k = 0; k < 4; k += 1) maxV = Math.max(maxV, uv.getY(i + k));
      i += 4;
    }
    expect(maxV).toBeCloseTo(0.06 / tile[1], 6);
    expect(somaU * tile[0]).toBeCloseTo(perimetroDaFaixa(parede.faixa), 5);
  });

  it("contorno côncavo (letra C/U) e letra mais fina que 2× a espessura funcionam", () => {
    const letraC: Regiao = {
      outer: [[0, 0], [0.1, 0], [0.1, 0.02], [0.02, 0.02], [0.02, 0.1], [0.1, 0.1], [0.1, 0.12], [0, 0.12]].map(([x, y]) => ({ x, y })),
      holes: [],
    };
    const parede = construirParedeOca(letraC, 0.05, 0.002, tile)!;
    expect(parede.faixa.length).toBeGreaterThan(0);
    const area = parede.faixa.reduce((total, parte) => total + areaDaRegiao(parte), 0);
    const perimetro = perimetroDoAnel(letraC.outer);
    // faixa ≈ perímetro × espessura (menos o excesso dos cantos convexos); 10 % de tolerância
    expect(area).toBeGreaterThan(perimetro * 0.002 * 0.8);
    expect(area).toBeLessThan(perimetro * 0.002 * 1.1);

    const fina: Regiao = { outer: [[0, 0], [0.1, 0], [0.1, 0.003], [0, 0.003]].map(([x, y]) => ({ x, y })), holes: [] };
    const solida = construirParedeOca(fina, 0.05, 0.002, tile)!;
    expect(solida.maciça).toBe(true);
  });

  it("buildReturnShellGeometry aceita um Shape do Three", () => {
    const geometria = buildReturnShellGeometry({ shape: regiaoParaShape(regiaoDa(LETRA_O)), depthM: 0.08, sheetThicknessM: 0.002, textureTileM: tile, curveSegments: 4 });
    expect(geometria.getAttribute("position").count).toBeGreaterThan(0);
    expect(geometria.getAttribute("normal").count).toBe(geometria.getAttribute("position").count);
  });
});

describe("face e fundo", () => {
  const regiao = (d: string) => formasDe(d).formas[0].regiao;

  it("face com a espessura real, vazados preservados e aba que a faz avançar", () => {
    const [face] = construirGeometriasFace([regiao(LETRA_O)], { espessuraM: 0.003, abaM: 0, bisel: false });
    face.computeBoundingBox();
    expect(face.boundingBox!.max.z - face.boundingBox!.min.z).toBeCloseTo(0.003, 9);
    const [comAba] = construirGeometriasFace([regiao(LETRA_O)], { espessuraM: 0.003, abaM: 0.005, bisel: false });
    comAba.computeBoundingBox();
    face.computeBoundingBox();
    expect(comAba.boundingBox!.max.x - comAba.boundingBox!.min.x).toBeCloseTo(0.1 + 0.01, 4);
  });

  it("bisel pequeno mantém a espessura total", () => {
    const [face] = construirGeometriasFace([regiao(LETRA_O)], { espessuraM: 0.003, abaM: 0, bisel: true });
    face.computeBoundingBox();
    expect(face.boundingBox!.max.z - face.boundingBox!.min.z).toBeCloseTo(0.003, 6);
  });

  it("fundo recuado pela espessura da lateral; região fina mantém o contorno e é contada", () => {
    const fundo = construirFundo([regiao(LETRA_O)], 0.01, 0.002);
    expect(fundo.semRecuo).toBe(0);
    expect(areaDaRegiao(fundo.regioes[0])).toBeLessThan(areaDaRegiao(regiao(LETRA_O)));
    const fina: Regiao = { outer: [[0, 0], [0.1, 0], [0.1, 0.003], [0, 0.003]].map(([x, y]) => ({ x, y })), holes: [] };
    const comFina = construirFundo([fina], 0.01, 0.002);
    expect(comFina.semRecuo).toBe(1);
    expect(comFina.regioes).toHaveLength(1);
  });
});

describe("layout de LEDs e fixadores", () => {
  const letra = (d: string): Regiao => svgParaFormas(svg(preenchido(d), "0 0 100 140"), { larguraMm: 500, alturaMm: 700 }).formas[0].regiao;

  it("LEDs ficam dentro da silhueta e fora dos vazados, respeitando a folga da borda", () => {
    const regiao = letra(LETRA_B);
    const { pontos } = construirLayoutLeds({ silhueta: [regiao], passoM: 0.06, folgaBordaM: 0.015, moduloLarguraM: 0.02, moduloAlturaM: 0.01, quantidade: null });
    expect(pontos.length).toBeGreaterThan(10);
    for (const ponto of pontos) expect(pontoNaRegiao(ponto, regiao)).toBe(true);
    // distância mínima à borda ≥ folga (dentro do erro do arco de 0,05 mm)
    const [util] = deslocarRegioes([regiao], -0.015);
    for (const ponto of pontos) expect(pontoNaRegiao(ponto, util)).toBe(true);
  });

  it("é determinístico e respeita a quantidade física da composição", () => {
    const regiao = letra(LETRA_O);
    const entrada = { silhueta: [regiao], passoM: 0.08, folgaBordaM: 0.01, moduloLarguraM: null, moduloAlturaM: null, quantidade: 37 };
    const a = construirLayoutLeds(entrada), b = construirLayoutLeds(entrada);
    expect(a.pontos).toHaveLength(37);
    expect(a.pontos).toEqual(b.pontos);
    expect(new Set(a.pontos.map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)}`)).size).toBe(37);
  });

  it("formas finas demais para a grade ganham um LED ilustrativo e um aviso", () => {
    const haste: Regiao = { outer: [[0, 0], [0.5, 0], [0.5, 0.02], [0, 0.02]].map(([x, y]) => ({ x, y })), holes: [] };
    const { pontos, avisos } = construirLayoutLeds({ silhueta: [haste], passoM: 0.2, folgaBordaM: 0.008, moduloLarguraM: null, moduloAlturaM: null, quantidade: null });
    expect(pontos.length).toBeGreaterThanOrEqual(1);
    expect(avisos.join(" ")).toMatch(/finos|ilustrativo|couberam/);
  });

  it("haste mais fina que a folga + meio módulo (área útil vazia) cai no LED central ilustrativo, nunca num letreiro apagado", () => {
    // Achado no teste real do CPQ (07/10/2026): Arial Bold a 17 cm de altura tem haste ~3 cm; folga 15 mm + meio módulo 12,5 mm tira tudo.
    const haste: Regiao = { outer: [[0, 0], [0.5, 0], [0.5, 0.03], [0, 0.03]].map(([x, y]) => ({ x, y })), holes: [] };
    const outra: Regiao = { outer: [[0.6, 0], [0.63, 0], [0.63, 0.17], [0.6, 0.17]].map(([x, y]) => ({ x, y })), holes: [] };
    const { pontos, avisos } = construirLayoutLeds({ silhueta: [haste, outra], passoM: 0.08, folgaBordaM: 0.015, moduloLarguraM: 0.025, moduloAlturaM: 0.008, quantidade: 24 });
    expect(pontos).toHaveLength(2); // um por região
    expect(pontos.map(p => p.ilha).sort()).toEqual([0, 1]);
    expect(pontoNaRegiao(pontos[0], haste) || pontoNaRegiao(pontos[0], outra)).toBe(true);
    expect(avisos.join(" ")).toMatch(/finos.*LED central/);
  });

  it("fixadores: até 4 por região, dentro da área recuada", () => {
    const regiao = letra(LETRA_R);
    const pontos = construirLayoutFixadores([regiao], 0.01);
    expect(pontos.length).toBeGreaterThanOrEqual(1);
    expect(pontos.length).toBeLessThanOrEqual(4);
    for (const ponto of pontos) expect(pontoNaRegiao(ponto, regiao)).toBe(true);
  });
});
