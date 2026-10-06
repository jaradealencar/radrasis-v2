import polygonClipping from "polygon-clipping";
import { describe, expect, it } from "vitest";
import { contornosFisicosDoSvg } from "../services/cpqFactibilidadeFabricacao";
import { executarMotorInterno, type PecaMotorInterno, type ResultadoMotorInterno } from "../services/cpqNestingInterno";
import { angulosDaPeca } from "../services/cpqNestingRaster";

type Par = [number, number];
const peca = (id: string, d: string, w: number, h: number): PecaMotorInterno => ({
  id, svg: `<svg viewBox="0 0 ${w} ${h}"><path d="${d}"/></svg>`, larguraMm: w, alturaMm: h,
});
const quadrado = (id: string, l: number) => peca(id, `M0 0H${l}V${l}H0Z`, l, l);
const anel = (id: string, externo: number, vazado: number) => {
  const borda = (externo - vazado) / 2;
  return peca(id, `M0 0H${externo}V${externo}H0Z M${borda} ${borda}V${borda + vazado}H${borda + vazado}V${borda}Z`, externo, externo);
};
const L = (id: string) => peca(id, "M0 0H100V50H50V150H0Z", 100, 150);
const Lfino = (id: string) => peca(id, "M0 0H100V30H30V150H0Z", 100, 150);
const triangulo = (id: string) => peca(id, "M0 0H160L0 90Z", 160, 90);
const T = (id: string) => peca(id, "M0 0H140V40H90V160H50V40H0Z", 140, 160);

/** Polígonos da peça já girados/posicionados como o motor mandou (mesma regra do desenho no CPQ). */
function posicionada(pecas: PecaMotorInterno[], r: ResultadoMotorInterno, indice: number) {
  const p = r.placements.find(item => item.source === indice)!;
  const geometria = contornosFisicosDoSvg(pecas[indice].svg, pecas[indice].larguraMm, pecas[indice].alturaMm);
  const rad = (p.rotacaoGraus * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const girados = geometria.map(poligono => poligono.map(anelGeo => anelGeo.map(([x, y]): Par => [x * cos - y * sin, x * sin + y * cos])));
  const minX = Math.min(...girados.flat(2).map(([x]) => x)), minY = Math.min(...girados.flat(2).map(([, y]) => y));
  return girados.map(poligono => poligono.map(anelGeo => anelGeo.map(([x, y]): Par => [x - minX + p.xMm, y - minY + p.yMm])));
}

const areaGeo = (geo: Par[][][]) => geo.reduce((soma, poligono) => soma + poligono.reduce((s, anelGeo, i) => {
  const a = Math.abs(anelGeo.reduce((t, [x1, y1], k) => { const [x2, y2] = anelGeo[(k + 1) % anelGeo.length]; return t + x1 * y2 - x2 * y1; }, 0)) / 2;
  return s + (i === 0 ? a : -a);
}, 0), 0);

function distanciaPontoSegmento([px, py]: Par, [ax, ay]: Par, [bx, by]: Par) {
  const dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const segmentos = (geo: Par[][][]) => geo.flat().flatMap(anelGeo => anelGeo.map((p, i): [Par, Par] => [p, anelGeo[(i + 1) % anelGeo.length]]));
function menorDistancia(a: Par[][][], b: Par[][][]) {
  let menor = Infinity;
  const segA = segmentos(a), segB = segmentos(b);
  for (const [p] of segA) for (const [s1, s2] of segB) menor = Math.min(menor, distanciaPontoSegmento(p, s1, s2));
  for (const [p] of segB) for (const [s1, s2] of segA) menor = Math.min(menor, distanciaPontoSegmento(p, s1, s2));
  return menor;
}

/** Confere, com a geometria real: tudo dentro da chapa, nenhuma sobreposição e o espaçamento pedido entre as peças. */
function conferir(pecas: PecaMotorInterno[], r: ResultadoMotorInterno, W: number, H: number, espacamento: number) {
  const geos = pecas.map((_, i) => posicionada(pecas, r, i));
  geos.forEach(geo => {
    for (const [x, y] of geo.flat(2)) {
      expect(x).toBeGreaterThanOrEqual(-0.01);
      expect(y).toBeGreaterThanOrEqual(-0.01);
      expect(x).toBeLessThanOrEqual(W + 0.01);
      expect(y).toBeLessThanOrEqual(H + 0.01);
    }
  });
  for (let i = 0; i < geos.length; i += 1) {
    for (let j = i + 1; j < geos.length; j += 1) {
      const comum = polygonClipping.intersection(geos[i] as never, geos[j] as never) as unknown as Par[][][];
      expect(areaGeo(comum)).toBeLessThan(0.5);
      expect(menorDistancia(geos[i], geos[j])).toBeGreaterThanOrEqual(espacamento - 0.05);
    }
  }
}

describe("nesting por contorno real (motor interno)", () => {
  it("encaixa peças dentro do vazado de outra (onde as caixas não deixariam)", () => {
    // Anel 300×300 com vazado 200×200 + 4 quadrados de 90: pelas caixas só sobra uma faixa à direita, que comporta 3.
    const pecas = [anel("anel", 300, 200), ...[1, 2, 3, 4].map(n => quadrado(`q${n}`, 90))];
    const r = executarMotorInterno(pecas, 420, 330, 5);
    expect(r.completo).toBe(true);
    expect(r.quantidadePosicionada).toBe(5);
    conferir(pecas, r, 420, 330, 5);
    // um dos quadrados ficou dentro do vazado do anel (entre as bordas internas)
    const dentro = pecas.slice(1).some((_, i) => { const p = r.placements.find(item => item.source === i + 1)!; return p.xMm > 50 && p.xMm + p.larguraMm < 250 && p.yMm > 50 && p.yMm + p.alturaMm < 250; });
    expect(dentro).toBe(true);
  });

  it("gira as peças em vários ângulos e nunca sobrepõe nem desrespeita o espaçamento", () => {
    const pecas = [L("L1"), L("L2"), L("L3"), triangulo("t1"), triangulo("t2"), T("T1"), T("T2"), anel("a", 200, 120), quadrado("q", 60)];
    const r = executarMotorInterno(pecas, 800, 500, 6);
    expect(r.completo).toBe(true);
    conferir(pecas, r, 800, 500, 6);
    expect(new Set(r.placements.map(p => p.rotacaoGraus)).size).toBeGreaterThan(1);
  });

  it("cabe com o contorno o que não cabe pelas caixas (letras em L que se encaixam)", () => {
    // 6 L's finos: as caixas somam 90 000 mm² (mais que a chapa de 330×250 = 82 500), mas a área real é só 39 600 mm².
    const pecas = Array.from({ length: 6 }, (_, i) => Lfino(`L${i}`));
    const r = executarMotorInterno(pecas, 330, 250, 4);
    expect(r.completo).toBe(true);
    conferir(pecas, r, 330, 250, 4);
  });

  it("em bobina (largura fixa) avança no comprimento usando a largura toda", () => {
    const pecas = Array.from({ length: 8 }, (_, i) => (i % 2 ? L(`L${i}`) : triangulo(`t${i}`)));
    const r = executarMotorInterno(pecas, 50_000, 300, 3, { bobina: true });
    expect(r.completo).toBe(true);
    conferir(pecas, r, 50_000, 300, 3);
    // 4 L's (10 000) + 4 triângulos (7 200) = 68 800 mm² em 300 mm de largura: precisa de bem menos de 1 m de rolo
    expect(r.bounds!.maxX).toBeLessThan(700);
  });

  it("escolhe ângulos que alinham a maior aresta de peças inclinadas", () => {
    const losango: Par[] = [[0, 50], [100, 0], [200, 50], [100, 100]];
    const angulos = angulosDaPeca(losango);
    expect(angulos).toEqual(expect.arrayContaining([0, 90, 180, 270]));
    expect(angulos.length).toBeGreaterThan(4);
  });
});
