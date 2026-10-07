import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { deslocarRegioes } from "./clipper";
import { regiaoParaShape, type Regiao } from "./geometryUtils";

export interface OpcoesFace {
  /** Espessura real da chapa da face, em metros. */
  espessuraM: number;
  /** Aba da face: quanto a face avança além do contorno (kit.faceLipMm), em metros. */
  abaM: number;
  /** Chanfro pequeno no acrílico (borda de corte a laser polida). Só quando o acabamento o justifica. */
  bisel: boolean;
}

/** Chanfro de 0,2 mm da borda polida a laser (valor visual, não uma medida de fabricação). */
const BISEL_M = 0.0002;

/**
 * Face fina por região, com a espessura real e os vazados preservados. Cada geometria ocupa z ∈ [0, espessura]; o grupo 0 do
 * ExtrudeGeometry é a face (tampas) e o 1 é a borda — o conjunto usa material de borda separado para o acrílico.
 */
export function construirGeometriasFace(regioes: readonly Regiao[], opcoes: OpcoesFace): THREE.ExtrudeGeometry[] {
  const base = opcoes.abaM > 0 ? deslocarRegioes(regioes, opcoes.abaM) : [...regioes];
  const espessura = Math.max(opcoes.espessuraM, 0.0001);
  const bisel = opcoes.bisel && espessura > BISEL_M * 4 ? BISEL_M : 0;
  return base.map(regiao => {
    const geometria = new THREE.ExtrudeGeometry(regiaoParaShape(regiao), {
      depth: espessura - 2 * bisel,
      steps: 1,
      bevelEnabled: bisel > 0,
      bevelSize: bisel,
      bevelThickness: bisel,
      bevelSegments: bisel > 0 ? 2 : 0,
      curveSegments: 1,
    });
    // Com chanfro o Extrude cresce 1 bisel para cada lado em z: volta a base para z = 0.
    if (bisel > 0) geometria.translate(0, 0, bisel);
    return geometria;
  });
}

/**
 * Junta geometrias extrudadas preservando os dois grupos de material (0 = tampas/face, 1 = bordas) em apenas DOIS grupos no
 * resultado — dois draw calls por grupo de cor, mesmo com dezenas de letras. (`mergeGeometries(..., true)` criaria um grupo por
 * geometria e perderia a divisão face/borda.)
 */
export function mesclarFaces(geometrias: readonly THREE.ExtrudeGeometry[]): THREE.BufferGeometry | null {
  if (!geometrias.length) return null;
  const totalVertices = geometrias.reduce((total, geometria) => total + geometria.getAttribute("position").count, 0);
  const posicoes = new Float32Array(totalVertices * 3), normais = new Float32Array(totalVertices * 3), uvs = new Float32Array(totalVertices * 2);
  const indicesPorMaterial: number[][] = [[], []];
  let deslocamento = 0;
  for (const geometria of geometrias) {
    const posicao = geometria.getAttribute("position"), normal = geometria.getAttribute("normal"), uv = geometria.getAttribute("uv");
    posicoes.set(posicao.array as ArrayLike<number>, deslocamento * 3);
    normais.set(normal.array as ArrayLike<number>, deslocamento * 3);
    uvs.set(uv.array as ArrayLike<number>, deslocamento * 2);
    const indice = geometria.getIndex();
    const sequencia = indice ? (indice.array as ArrayLike<number>) : Array.from({ length: posicao.count }, (_, k) => k);
    const grupos = geometria.groups.length ? geometria.groups : [{ start: 0, count: sequencia.length, materialIndex: 0 }];
    for (const grupo of grupos) {
      const destino = indicesPorMaterial[Math.min(grupo.materialIndex ?? 0, 1)];
      for (let k = grupo.start; k < grupo.start + grupo.count; k += 1) destino.push(sequencia[k] + deslocamento);
    }
    deslocamento += posicao.count;
    geometria.dispose();
  }
  const mesclada = new THREE.BufferGeometry();
  mesclada.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  mesclada.setAttribute("normal", new THREE.BufferAttribute(normais, 3));
  mesclada.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  const todos = new Uint32Array(indicesPorMaterial[0].length + indicesPorMaterial[1].length);
  todos.set(indicesPorMaterial[0], 0);
  todos.set(indicesPorMaterial[1], indicesPorMaterial[0].length);
  mesclada.setIndex(new THREE.BufferAttribute(todos, 1));
  mesclada.addGroup(0, indicesPorMaterial[0].length, 0);
  mesclada.addGroup(indicesPorMaterial[0].length, indicesPorMaterial[1].length, 1);
  mesclada.computeBoundingSphere();
  return mesclada;
}

/** Junta geometrias de material único (fundo, parede) sem grupos. */
export function mesclarSimples(geometrias: readonly THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!geometrias.length) return null;
  if (geometrias.length === 1) return geometrias[0];
  const mesclada = mergeGeometries(geometrias.map(geometria => {
    const limpa = geometria.clone();
    limpa.clearGroups();
    return limpa;
  }), false);
  geometrias.forEach(geometria => geometria.dispose());
  return mesclada;
}
