import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { CenaDados } from "../cena";
import { interpolar, type EstadoCena } from "./estadoCena";

const FUNDO_DIA = new THREE.Color("#e8ecf2");
const FUNDO_NOITE = new THREE.Color("#080b12");

/**
 * Luz da cena. Dia e noite NÃO são só o fundo: de dia o ambiente (HDRI) e a luz principal dominam e a emissão cai; à noite o
 * ambiente quase some, entra só uma luz mínima e a emissão (face, LEDs, halo) passa a ser a fonte. Uma única luz principal com
 * sombra; nunca uma luz por módulo LED.
 */
export function LightingRig({ estado, cena, iluminada }: { estado: MutableRefObject<EstadoCena>; cena: CenaDados; iluminada: boolean }) {
  const { scene, invalidate } = useThree();
  const principal = useRef<THREE.DirectionalLight>(null);
  const hemisferio = useRef<THREE.HemisphereLight>(null);
  const preenchimento = useRef<THREE.DirectionalLight>(null);
  const pontos = useRef<THREE.PointLight[]>([]);
  const escala = Math.max(cena.larguraM, cena.alturaM, 0.2);
  const fundo = useMemo(() => new THREE.Color(FUNDO_DIA), []);

  // Uma luz pontual por GRUPO de face (agrega a emissão da peça), no máximo 6.
  const grupos = useMemo(() => cena.grupos.slice(0, 6), [cena.grupos]);

  useEffect(() => {
    scene.background = fundo;
    invalidate();
    return () => { scene.background = null; };
  }, [scene, fundo, invalidate]);

  useFrame(() => {
    const noite = estado.current.noite;
    fundo.copy(FUNDO_DIA).lerp(FUNDO_NOITE, noite);
    scene.environmentIntensity = interpolar(0.5, 0.05, noite);
    if (principal.current) principal.current.intensity = interpolar(1.5, 0.08, noite);
    if (preenchimento.current) preenchimento.current.intensity = interpolar(0.25, 0.02, noite);
    if (hemisferio.current) hemisferio.current.intensity = interpolar(0.25, 0.03, noite);
    pontos.current.forEach((luz, indice) => {
      if (luz) luz.intensity = iluminada ? noite * Math.min(1.5, 0.35 + (grupos[indice]?.areaM2 ?? 0) * 6) : 0;
    });
  });

  return (
    <>
      <hemisphereLight ref={hemisferio} args={["#ffffff", "#8a8f99", 0.5]} />
      <directionalLight
        ref={principal}
        position={[escala * 0.9, escala * 1.1, escala * 1.4]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-escala * 1.6}
        shadow-camera-right={escala * 1.6}
        shadow-camera-top={escala * 1.6}
        shadow-camera-bottom={-escala * 1.6}
        shadow-camera-near={0.05}
        shadow-camera-far={escala * 6}
      />
      <directionalLight ref={preenchimento} position={[-escala, escala * 0.3, escala]} intensity={0.6} />
      {grupos.map((grupo, indice) => (
        <pointLight
          key={grupo.chave}
          ref={luz => { if (luz) pontos.current[indice] = luz; }}
          position={[0, 0, cena.profundidadeM + Math.max(cena.alturaM, cena.larguraM) * 0.25]}
          color={grupo.colorHex ?? "#fff4e0"}
          intensity={0}
          distance={escala * 3}
          decay={2}
        />
      ))}
    </>
  );
}
