/**
 * Utilitários de geometria 2D do 3D do CPQ. Unidade do mundo: 1 unidade = 1 metro. Plano do letreiro = XY (Y para cima),
 * profundidade = Z (para o observador). Polígonos são listas de pontos simples (sem Three.js) para serem testáveis em Node.
 */
import * as THREE from "three";

export const mmToWorld = (mm: number): number => mm / 1000;
export const worldToMm = (metros: number): number => metros * 1000;

export interface Vec {
  x: number;
  y: number;
}

/** Contorno externo + vazados (em metros). Convenção após `normalizarRegiao`: externo anti-horário, vazados horários. */
export interface Regiao {
  outer: Vec[];
  holes: Vec[][];
}

export function areaAssinada(anel: readonly Vec[]): number {
  let soma = 0;
  for (let i = 0; i < anel.length; i += 1) {
    const a = anel[i], b = anel[(i + 1) % anel.length];
    soma += a.x * b.y - b.x * a.y;
  }
  return soma / 2;
}

export function perimetroDoAnel(anel: readonly Vec[]): number {
  let total = 0;
  for (let i = 0; i < anel.length; i += 1) {
    const a = anel[i], b = anel[(i + 1) % anel.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Remove pontos repetidos (inclusive o de fechamento) e quase colineares duplicados mínimos. */
export function limparAnel(anel: readonly Vec[], tolerancia = 1e-9): Vec[] {
  const saida: Vec[] = [];
  for (const ponto of anel) {
    const ultimo = saida[saida.length - 1];
    if (!ultimo || Math.hypot(ponto.x - ultimo.x, ponto.y - ultimo.y) > tolerancia) saida.push({ x: ponto.x, y: ponto.y });
  }
  while (saida.length > 1 && Math.hypot(saida[0].x - saida[saida.length - 1].x, saida[0].y - saida[saida.length - 1].y) <= tolerancia) saida.pop();
  return saida;
}

export function orientarAnel(anel: readonly Vec[], antiHorario: boolean): Vec[] {
  const copia = anel.map(ponto => ({ x: ponto.x, y: ponto.y }));
  return (areaAssinada(copia) > 0) === antiHorario ? copia : copia.reverse();
}

/** Limpa os anéis e aplica a convenção de orientação. Devolve `null` se o contorno externo degenerou. */
export function normalizarRegiao(regiao: Regiao): Regiao | null {
  const outer = limparAnel(regiao.outer);
  if (outer.length < 3 || Math.abs(areaAssinada(outer)) < 1e-12) return null;
  const holes = regiao.holes
    .map(anel => limparAnel(anel))
    .filter(anel => anel.length >= 3 && Math.abs(areaAssinada(anel)) >= 1e-12)
    .map(anel => orientarAnel(anel, false));
  return { outer: orientarAnel(outer, true), holes };
}

export function areaDaRegiao(regiao: Regiao): number {
  return Math.abs(areaAssinada(regiao.outer)) - regiao.holes.reduce((total, anel) => total + Math.abs(areaAssinada(anel)), 0);
}

export interface Caixa {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function caixaDasRegioes(regioes: readonly Regiao[]): Caixa | null {
  let caixa: Caixa | null = null;
  for (const regiao of regioes)
    for (const ponto of regiao.outer) {
      if (!caixa) caixa = { minX: ponto.x, minY: ponto.y, maxX: ponto.x, maxY: ponto.y };
      else {
        if (ponto.x < caixa.minX) caixa.minX = ponto.x;
        if (ponto.y < caixa.minY) caixa.minY = ponto.y;
        if (ponto.x > caixa.maxX) caixa.maxX = ponto.x;
        if (ponto.y > caixa.maxY) caixa.maxY = ponto.y;
      }
    }
  return caixa;
}

export function pontoNoAnel(ponto: Vec, anel: readonly Vec[]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const a = anel[i], b = anel[j];
    if ((a.y > ponto.y) !== (b.y > ponto.y) && ponto.x < ((b.x - a.x) * (ponto.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/** Dentro do contorno externo e fora de todos os vazados. */
export function pontoNaRegiao(ponto: Vec, regiao: Regiao): boolean {
  return pontoNoAnel(ponto, regiao.outer) && !regiao.holes.some(anel => pontoNoAnel(ponto, anel));
}

/** Ponto garantidamente dentro da região: ponto médio do maior trecho de uma varredura horizontal pelo centro da caixa. */
export function pontoInterior(regiao: Regiao): Vec | null {
  const caixa = caixaDasRegioes([regiao]);
  if (!caixa) return null;
  const aneis = [regiao.outer, ...regiao.holes];
  let melhor: Vec | null = null;
  let melhorLargura = 0;
  // Varre algumas alturas: o centro nem sempre cruza o corpo (ex.: letra "C" ou "U" deitada).
  for (const fracao of [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]) {
    const y = caixa.minY + (caixa.maxY - caixa.minY) * fracao;
    const xs: number[] = [];
    for (const anel of aneis)
      for (let i = 0; i < anel.length; i += 1) {
        const a = anel[i], b = anel[(i + 1) % anel.length];
        if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const largura = xs[i + 1] - xs[i];
      if (largura > melhorLargura) { melhorLargura = largura; melhor = { x: (xs[i] + xs[i + 1]) / 2, y }; }
    }
    if (melhor && fracao === 0.5) break;
  }
  return melhor && pontoNaRegiao(melhor, regiao) ? melhor : null;
}

export function regiaoParaShape(regiao: Regiao): THREE.Shape {
  const shape = new THREE.Shape(regiao.outer.map(ponto => new THREE.Vector2(ponto.x, ponto.y)));
  for (const anel of regiao.holes) shape.holes.push(new THREE.Path(anel.map(ponto => new THREE.Vector2(ponto.x, ponto.y))));
  return shape;
}

/** Converte um `Shape` do Three (curvas) em região poligonal, com `divisoes` segmentos por curva. */
export function shapeParaRegiao(shape: THREE.Shape, divisoes: number): Regiao | null {
  const { shape: externo, holes } = shape.extractPoints(divisoes);
  return normalizarRegiao({
    outer: externo.map(ponto => ({ x: ponto.x, y: ponto.y })),
    holes: holes.map(anel => anel.map(ponto => ({ x: ponto.x, y: ponto.y }))),
  });
}
