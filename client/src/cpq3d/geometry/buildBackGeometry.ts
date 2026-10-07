import * as THREE from "three";
import { deslocarRegioes } from "./clipper";
import { regiaoParaShape, type Regiao } from "./geometryUtils";

export interface FundoConstruido {
  geometrias: THREE.ExtrudeGeometry[];
  /** Regiões do fundo (já recuadas): o 3D usa as mesmas para posicionar LEDs e fixadores. */
  regioes: Regiao[];
  /** Regiões finas demais para o recuo: o fundo delas usa o contorno sem recuo. */
  semRecuo: number;
}

/**
 * Fundo: peça separada, com a espessura real e material próprio, recuada para dentro da parede (offset negativo = espessura da
 * lateral). Offset validado: se o recuo faz uma região desaparecer (letra fina), ela mantém o contorno original e conta em
 * `semRecuo` em vez de sumir do desenho. Ocupa z ∈ [0, espessura].
 */
export function construirFundo(silhueta: readonly Regiao[], espessuraM: number, recuoM: number): FundoConstruido {
  const recuadas: Regiao[] = [];
  let semRecuo = 0;
  for (const regiao of silhueta) {
    const menor = recuoM > 0 ? deslocarRegioes([regiao], -recuoM) : [regiao];
    if (menor.length) recuadas.push(...menor);
    else { recuadas.push(regiao); semRecuo += 1; }
  }
  const espessura = Math.max(espessuraM, 0.0001);
  const geometrias = recuadas.map(regiao => new THREE.ExtrudeGeometry(regiaoParaShape(regiao), { depth: espessura, bevelEnabled: false, curveSegments: 1, steps: 1 }));
  return { geometrias, regioes: recuadas, semRecuo };
}
