/**
 * Lateral/retorno OCO do letreiro: uma faixa com a espessura real da chapa (ou do perfil) que acompanha o contorno de cada letra e
 * de cada vazado — nunca o miolo maciço de uma extrusão.
 *
 * Construção: parede = silhueta − silhueta encolhida pela espessura (clipper-lib). As faces laterais são quads entre o plano
 * traseiro e o frontal, com normais suavizadas só em curvas (cantos vivos ficam vivos), UV com U no perímetro e V na profundidade
 * (em metros, para o repeat da textura ser pelo tamanho real do tile) e as bordas anterior e posterior fechadas por triangulação.
 * A malha serve só para desenhar: nunca substitui a geometria do nesting/CNC.
 */
import * as THREE from "three";
import { deslocarRegioes, diferencaDeRegioes } from "./clipper";
import { normalizarRegiao, perimetroDoAnel, shapeParaRegiao, type Regiao, type Vec } from "./geometryUtils";

/** Ângulo (graus) abaixo do qual vértices vizinhos compartilham a normal (suaviza curvas, mantém cantos). */
const LIMITE_SUAVIZACAO_GRAUS = 35;
const COS_LIMITE = Math.cos((LIMITE_SUAVIZACAO_GRAUS * Math.PI) / 180);

interface Buffers {
  posicoes: number[];
  normais: number[];
  uvs: number[];
  indices: number[];
}

export interface EntradaRetorno {
  shape: THREE.Shape;
  depthM: number;
  sheetThicknessM: number;
  /** Tamanho real (m) que uma repetição da textura cobre: [ao longo do perímetro, ao longo da profundidade]. */
  textureTileM: [number, number];
  curveSegments: number;
}

function suavizar(a: Vec, b: Vec): Vec {
  if (a.x * b.x + a.y * b.y < COS_LIMITE) return b;
  const x = a.x + b.x, y = a.y + b.y, comprimento = Math.hypot(x, y) || 1;
  return { x: x / comprimento, y: y / comprimento };
}

/** Parede vertical (de z0 a z1) ao longo de um anel cujo material fica à ESQUERDA do sentido (externo anti-horário, vazado horário). */
function adicionarParede(anel: readonly Vec[], z0: number, z1: number, tile: [number, number], buffers: Buffers): void {
  const n = anel.length;
  const normais: Vec[] = [];
  const comprimentos: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = anel[i], b = anel[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y, comprimento = Math.hypot(dx, dy) || 1e-12;
    normais.push({ x: dy / comprimento, y: -dx / comprimento }); // direita do sentido = para fora do material
    comprimentos.push(comprimento);
  }
  let acumulado = 0;
  for (let i = 0; i < n; i += 1) {
    const a = anel[i], b = anel[(i + 1) % n];
    const atual = normais[i];
    const nA = suavizar(normais[(i - 1 + n) % n], atual), nB = suavizar(atual, normais[(i + 1) % n]);
    const u0 = acumulado / tile[0], u1 = (acumulado + comprimentos[i]) / tile[0];
    const v0 = z0 / tile[1], v1 = z1 / tile[1];
    const base = buffers.posicoes.length / 3;
    buffers.posicoes.push(a.x, a.y, z0, b.x, b.y, z0, b.x, b.y, z1, a.x, a.y, z1);
    buffers.normais.push(nA.x, nA.y, 0, nB.x, nB.y, 0, nB.x, nB.y, 0, nA.x, nA.y, 0);
    buffers.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    acumulado += comprimentos[i];
  }
}

/** Borda (aro) anterior ou posterior da parede, triangulada. `frente` = normal +z. */
function adicionarTampa(regiao: Regiao, z: number, frente: boolean, tile: [number, number], buffers: Buffers): void {
  const contorno = regiao.outer.map(ponto => new THREE.Vector2(ponto.x, ponto.y));
  const vazados = regiao.holes.map(anel => anel.map(ponto => new THREE.Vector2(ponto.x, ponto.y)));
  const faces = THREE.ShapeUtils.triangulateShape(contorno, vazados);
  const pontos = [...regiao.outer, ...regiao.holes.flat()];
  const base = buffers.posicoes.length / 3;
  for (const ponto of pontos) {
    buffers.posicoes.push(ponto.x, ponto.y, z);
    buffers.normais.push(0, 0, frente ? 1 : -1);
    buffers.uvs.push(ponto.x / tile[0], ponto.y / tile[1]);
  }
  for (const [a, b, c] of faces) buffers.indices.push(...(frente ? [base + a, base + b, base + c] : [base + c, base + b, base + a]));
}

export interface ParedeOca {
  geometria: THREE.BufferGeometry;
  /** Regiões da faixa (silhueta − miolo): útil para testes e para conferir a espessura. */
  faixa: Regiao[];
  /** Verdadeiro quando a letra é mais fina que 2× a espessura e a parede virou peça inteira. */
  maciça: boolean;
}

/** Núcleo: constrói a parede oca de uma região, de z = 0 a z = depth. */
export function construirParedeOca(regiao: Regiao, depthM: number, sheetThicknessM: number, tile: [number, number]): ParedeOca | null {
  const normal = normalizarRegiao(regiao);
  if (!normal || !(depthM > 0) || !(sheetThicknessM > 0)) return null;
  const miolo = deslocarRegioes([normal], -sheetThicknessM);
  const faixa = miolo.length ? diferencaDeRegioes([normal], miolo) : [normal];
  const buffers: Buffers = { posicoes: [], normais: [], uvs: [], indices: [] };
  for (const parte of faixa) {
    adicionarParede(parte.outer, 0, depthM, tile, buffers);
    for (const anel of parte.holes) adicionarParede(anel, 0, depthM, tile, buffers);
    adicionarTampa(parte, depthM, true, tile, buffers);
    adicionarTampa(parte, 0, false, tile, buffers);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(buffers.posicoes, 3));
  geometria.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normais, 3));
  geometria.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometria.setIndex(buffers.indices);
  geometria.computeBoundingSphere();
  return { geometria, faixa, maciça: miolo.length === 0 };
}

/** Assinatura do contrato do prompt: recebe um `Shape` do Three e devolve a geometria da lateral oca (z de 0 a `depthM`). */
export function buildReturnShellGeometry(entrada: EntradaRetorno): THREE.BufferGeometry {
  const regiao = shapeParaRegiao(entrada.shape, entrada.curveSegments);
  const parede = regiao && construirParedeOca(regiao, entrada.depthM, entrada.sheetThicknessM, entrada.textureTileM);
  return parede?.geometria ?? new THREE.BufferGeometry();
}

/** Perímetro total (externo + vazados) da faixa, em metros — referência para testar o U do UV. */
export function perimetroDaFaixa(faixa: readonly Regiao[]): number {
  return faixa.reduce((total, parte) => total + perimetroDoAnel(parte.outer) + parte.holes.reduce((soma, anel) => soma + perimetroDoAnel(anel), 0), 0);
}
