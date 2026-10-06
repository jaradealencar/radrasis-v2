/**
 * Faixa do Aro: o que sobra da chapa metálica depois de cortar o miolo da face.
 *
 * Aro = silhueta da face − (silhueta da face deslocada `larguraMm` para dentro). Cada contorno externo ganha uma faixa por dentro e cada
 * vazado (miolo do P, do O, do R…) ganha uma faixa por fora do furo, ou seja, dentro do metal da letra. Haste mais fina que o dobro da
 * largura não tem miolo para cortar: vira peça inteira. Funções puras, em milímetros; o deslocamento usa o Clipper (inteiros em µm).
 *
 * Cada polígono da faixa (um anel com seus furos) é uma peça separada de metal, e assim deve ir para o nesting.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ClipperLib = require("clipper-lib") as typeof import("clipper-lib");

export type Par = [number, number];
export type Anel = Par[];
export type Poligono = Anel[];
export type MultiPoligono = Poligono[];

/** Clipper trabalha com inteiros: 1 mm = 1000 unidades (resolução de 1 µm). */
const ESCALA = 1000;
/** Erro máximo do arco nos cantos arredondados do deslocamento (mm). */
const TOLERANCIA_ARCO_MM = 0.05;
/** Resíduos menores que isto (mm²) são ruído de arredondamento, não metal. */
const AREA_MINIMA_MM2 = 0.01;

type Caminho = import("clipper-lib").Path;
type Caminhos = import("clipper-lib").Paths;

function paraCaminhos(geometria: MultiPoligono): Caminhos {
  const caminhos: Caminhos = [];
  for (const poligono of geometria) {
    for (const anel of poligono) {
      const pontos = anel.map(([x, y]) => ({ X: Math.round(x * ESCALA), Y: Math.round(y * ESCALA) }));
      const ultimo = pontos[pontos.length - 1];
      if (pontos.length > 1 && ultimo.X === pontos[0].X && ultimo.Y === pontos[0].Y) pontos.pop();
      if (pontos.length >= 3) caminhos.push(pontos);
    }
  }
  return caminhos;
}

function paraAnel(caminho: Caminho): Anel {
  const anel = caminho.map(ponto => [ponto.X / ESCALA, ponto.Y / ESCALA] as Par);
  anel.push([anel[0][0], anel[0][1]]);
  return anel;
}

function areaAnel(anel: Anel): number {
  let dobro = 0;
  for (let i = 0; i < anel.length - 1; i += 1) dobro += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  return Math.abs(dobro) / 2;
}

/** Árvore do Clipper (externos, furos, ilhas dentro de furos…) → polígonos com seus furos; ilhas viram polígonos próprios. */
function arvoreParaMultiPoligono(arvore: import("clipper-lib").PolyTree): MultiPoligono {
  const resultado: MultiPoligono = [];
  const visitarExternos = (nos: import("clipper-lib").PolyNode[]) => {
    for (const no of nos) {
      const furos = no.Childs();
      const poligono: Poligono = [paraAnel(no.Contour()), ...furos.map(furo => paraAnel(furo.Contour()))];
      if (areaAnel(poligono[0]) >= AREA_MINIMA_MM2) resultado.push(poligono);
      for (const furo of furos) visitarExternos(furo.Childs());
    }
  };
  visitarExternos(arvore.Childs());
  return resultado;
}

/** Área (mm²) de um multipolígono: externos menos furos. */
export function areaMultiPoligono(geometria: MultiPoligono): number {
  return geometria.reduce((total, poligono) => total + poligono.reduce((soma, anel, indice) => soma + (indice === 0 ? 1 : -1) * areaAnel(anel), 0), 0);
}

/**
 * Faixa de `larguraMm` ao longo de todos os contornos da geometria (coordenadas em mm). Devolve um polígono por peça de metal,
 * já com seus furos; vazio se a geometria for vazia.
 */
export function faixaDeBorda(geometria: MultiPoligono, larguraMm: number): MultiPoligono {
  if (!Number.isFinite(larguraMm) || larguraMm <= 0) throw new RangeError("A largura da faixa do aro precisa ser maior que zero.");
  const entrada = paraCaminhos(geometria);
  if (!entrada.length) return [];

  // 1) Normaliza (par/ímpar): externos com área positiva e furos com área negativa, como o deslocamento do Clipper espera.
  const normalizador = new ClipperLib.Clipper();
  normalizador.AddPaths(entrada, ClipperLib.PolyType.ptSubject, true);
  const silhueta: Caminhos = [];
  normalizador.Execute(ClipperLib.ClipType.ctUnion, silhueta, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

  // 2) A mesma silhueta deslocada para dentro (os furos crescem para dentro do metal).
  const deslocador = new ClipperLib.ClipperOffset(2, TOLERANCIA_ARCO_MM * ESCALA);
  deslocador.AddPaths(silhueta, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const miolo: Caminhos = [];
  deslocador.Execute(miolo, -larguraMm * ESCALA);

  // 3) Faixa = silhueta − miolo.
  const subtracao = new ClipperLib.Clipper();
  subtracao.AddPaths(silhueta, ClipperLib.PolyType.ptSubject, true);
  subtracao.AddPaths(miolo, ClipperLib.PolyType.ptClip, true);
  const arvore = new ClipperLib.PolyTree();
  subtracao.Execute(ClipperLib.ClipType.ctDifference, arvore, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return arvoreParaMultiPoligono(arvore);
}
