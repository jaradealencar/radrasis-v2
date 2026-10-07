import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

/** HDRI de estúdio local (gerado por scripts/gerar-hdri-estudio.mjs, sem licença de terceiros). Nunca um preset remoto. */
export const HDRI_ESTUDIO = "/render3d/environments/studio-1k.hdr";

/**
 * Ambiente (IBL) do 3D. Carrega o HDRI local e converte para o formato de reflexo (PMREM) FORA do loop de render, atribuindo o
 * resultado a `scene.environment`. Deixar o Three converter sozinho no meio do frame (equirretangular + EffectComposer) deixava os
 * metais sem reflexo. Se o arquivo faltar, a cena segue sem ambiente (metais mais escuros) e o erro vai para o console.
 */
export function AmbienteEstudio({ intensidade = 1 }: { intensidade?: number }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    let cancelado = false;
    let alvo: THREE.WebGLRenderTarget | null = null;
    new HDRLoader().setDataType(THREE.HalfFloatType).load(
      HDRI_ESTUDIO,
      textura => {
        if (cancelado) { textura.dispose(); return; }
        textura.mapping = THREE.EquirectangularReflectionMapping;
        const gerador = new THREE.PMREMGenerator(gl);
        alvo = gerador.fromEquirectangular(textura);
        gerador.dispose();
        textura.dispose();
        scene.environment = alvo.texture;
        scene.environmentIntensity = intensidade;
        // Materiais compilados antes de o ambiente chegar precisam recompilar para usá-lo.
        scene.traverse(objeto => {
          const material = (objeto as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (material) for (const item of Array.isArray(material) ? material : [material]) item.needsUpdate = true;
        });
        invalidate();
      },
      undefined,
      erro => console.error("[CPQ 3D] HDRI de estúdio indisponível; seguindo sem ambiente:", erro),
    );
    return () => {
      cancelado = true;
      if (alvo && scene.environment === alvo.texture) scene.environment = null;
      alvo?.dispose();
    };
  }, [gl, scene, invalidate, intensidade]);
  return null;
}
