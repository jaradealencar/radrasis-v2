import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { CpqPbrParameters, CpqMaterialFamily } from "@shared/cpq-render3d";
import { createPhysicalMaterial } from "../materialLibrary";
import { carregarMapasDoMaterial, type AssetDeTextura, type MapasCarregados } from "../textureLoader";
import { AmbienteEstudio } from "./AmbienteEstudio";
import { webglDisponivel } from "./CpqRender3dViewer";

class Seguro extends Component<{ children: ReactNode; fallback: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  render() { return this.state.erro ? this.props.fallback : this.props.children; }
}

function Amostra({ pbr, familia, espessuraMm, mapas, noite }: { pbr: CpqPbrParameters; familia: CpqMaterialFamily; espessuraMm: number | null; mapas: MapasCarregados; noite: boolean }) {
  const material = useMemo(() => createPhysicalMaterial({ pbr, family: familia, thicknessMm: espessuraMm }, mapas, noite, { iluminada: true }), [pbr, familia, espessuraMm, mapas, noite]);
  useEffect(() => () => material.dispose(), [material]);
  // Placa de 20 × 12 cm (a textura repete pelo tamanho real do tile); o UV do BoxGeometry é por face, em unidades 0..1 → escala ao tamanho.
  const geometria = useMemo(() => {
    const caixa = new THREE.BoxGeometry(0.2, 0.12, Math.max((espessuraMm ?? 6) / 1000, 0.003));
    const uv = caixa.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 0.2, uv.getY(i) * 0.12);
    return caixa;
  }, [espessuraMm]);
  useEffect(() => () => geometria.dispose(), [geometria]);
  return <mesh geometry={geometria} material={material} rotation={[-0.25, 0.45, 0]} />;
}

/** Amostra viva do perfil (placa com o shader atual) para comparar com a foto da amostra física, de dia e à noite. */
export function PreviewMaterial({ pbr, familia, espessuraMm, assets }: { pbr: CpqPbrParameters; familia: CpqMaterialFamily; espessuraMm: number | null; assets: AssetDeTextura[] }) {
  const [noite, setNoite] = useState(false);
  const [mapas, setMapas] = useState<MapasCarregados>({});
  const [semWebgl] = useState(() => !webglDisponivel());
  useEffect(() => {
    let cancelado = false;
    void carregarMapasDoMaterial(assets, 8).then(carregados => { if (!cancelado) setMapas(carregados); });
    return () => { cancelado = true; };
  }, [assets]);
  if (semWebgl) return <div className="role-note">Este navegador não permite o 3D (WebGL indisponível).</div>;
  return (
    <div>
      <button type="button" className="btn btn-ghost btn-sm" aria-pressed={noite} onClick={() => setNoite(valor => !valor)} style={{ marginBottom: 6 }}>{noite ? "☾ Noite" : "☀ Dia"}</button>
      <div style={{ height: 240, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: noite ? "#0a0d14" : "#e8ecf2" }}>
        <Seguro fallback={<div className="role-note" style={{ padding: 12 }}>Não foi possível iniciar a amostra 3D.</div>}>
          <Canvas dpr={[1, 1.5]} camera={{ fov: 35, position: [0, 0, 0.6], near: 0.01, far: 10 }} gl={{ antialias: true }}>
            <AmbienteEstudio intensidade={noite ? 0.15 : 1} />
            <directionalLight position={[0.5, 0.8, 1]} intensity={noite ? 0.1 : 2} />
            <Amostra pbr={pbr} familia={familia} espessuraMm={espessuraMm} mapas={mapas} noite={noite} />
            <OrbitControls enablePan={false} minDistance={0.25} maxDistance={1.2} />
          </Canvas>
        </Seguro>
      </div>
    </div>
  );
}
