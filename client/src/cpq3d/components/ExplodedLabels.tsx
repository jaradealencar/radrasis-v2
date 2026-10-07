import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { EstadoCena } from "./estadoCena";

/** Rótulo desenhado num canvas e mostrado como sprite: fica dentro do WebGL, então aparece também nos previews capturados. */
function criarTextura(texto: string): { textura: THREE.CanvasTexture; proporcao: number } {
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d")!;
  const fonte = "600 44px Inter, system-ui, sans-serif";
  contexto.font = fonte;
  const largura = Math.ceil(contexto.measureText(texto).width) + 44;
  canvas.width = largura;
  canvas.height = 72;
  contexto.font = fonte;
  contexto.fillStyle = "rgba(17, 24, 39, 0.82)";
  contexto.beginPath();
  contexto.roundRect(0, 4, largura, 64, 18);
  contexto.fill();
  contexto.fillStyle = "#ffffff";
  contexto.textBaseline = "middle";
  contexto.fillText(texto, 22, 37);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return { textura, proporcao: largura / 72 };
}

export interface RotuloExplodido {
  texto: string;
  /** Posição do rótulo, relativa ao grupo da peça (que se move na explosão). */
  posicao: [number, number, number];
}

/** Sprites dos nomes das peças; só aparecem (fade) com a visão explodida. */
export function ExplodedLabels({ rotulos, alturaM, estado }: { rotulos: RotuloExplodido[]; alturaM: number; estado: MutableRefObject<EstadoCena> }) {
  const sprites = useRef<THREE.Sprite[]>([]);
  const itens = useMemo(() => rotulos.map(rotulo => ({ rotulo, ...criarTextura(rotulo.texto) })), [rotulos]);
  useEffect(() => () => itens.forEach(item => item.textura.dispose()), [itens]);
  const altura = Math.max(alturaM * 0.075, 0.012);
  useFrame(() => {
    const opacidade = THREE.MathUtils.smoothstep(estado.current.explodido, 0.15, 0.7);
    sprites.current.forEach(sprite => {
      if (!sprite) return;
      sprite.visible = opacidade > 0.01;
      (sprite.material as THREE.SpriteMaterial).opacity = opacidade;
    });
  });
  return (
    <>
      {itens.map((item, indice) => (
        <sprite
          key={item.rotulo.texto}
          ref={sprite => { if (sprite) sprites.current[indice] = sprite; }}
          position={item.rotulo.posicao}
          scale={[altura * item.proporcao, altura, 1]}
          renderOrder={20}
        >
          <spriteMaterial map={item.textura} transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}
