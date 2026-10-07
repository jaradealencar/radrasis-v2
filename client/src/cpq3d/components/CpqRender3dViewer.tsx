import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode, type BloomEffect } from "postprocessing";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { construirCena, ProfundidadeAusenteError, type CenaDados, type DesenhoSpec, type Qualidade } from "../cena";
import { SvgInvalidoError } from "../svgToShapes";
import { AmbienteEstudio } from "./AmbienteEstudio";
import { useEstadoCena } from "./estadoCena";
import { LetterBoxAssembly } from "./LetterBoxAssembly";
import { LightingRig } from "./LightingRig";

export function webglDisponivel(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class LimiteDeErro extends Component<{ fallback: (erro: Error) => ReactNode; children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  render() { return this.state.erro ? this.props.fallback(this.state.erro) : this.props.children; }
}

const FOV = 35;

/**
 * Distância da câmera para enquadrar o conjunto: o retângulo visto pela câmera (largura e altura do letreiro, mais o que a rotação
 * do ponto de vista projeta da profundidade; na explosão a profundidade total cresce) cabe no campo de visão vertical e horizontal.
 */
export function distanciaDeEnquadramento(cena: Pick<CenaDados, "larguraM" | "alturaM" | "profundidadeM">, aspecto: number, exploded: boolean, pose: PoseCamera = POSE_PADRAO): number {
  const profundidade = cena.profundidadeM * (exploded ? 4.4 : 1);
  const larguraVista = cena.larguraM * Math.cos(pose.azimute) + profundidade * Math.sin(pose.azimute);
  const alturaVista = cena.alturaM * Math.cos(pose.elevacao) + profundidade * Math.sin(pose.elevacao);
  const meioVertical = (FOV * Math.PI) / 360;
  const meioHorizontal = Math.atan(Math.tan(meioVertical) * Math.max(aspecto, 0.2));
  const dist = Math.max(larguraVista / (2 * Math.tan(meioHorizontal)), alturaVista / (2 * Math.tan(meioVertical)));
  // Com o ponto de vista girado, a ponta mais próxima do letreiro fica mais perto da câmera (perspectiva): afasta o equivalente.
  return dist * 1.12 + profundidade / 2 + (cena.larguraM / 2) * Math.sin(Math.abs(pose.azimute));
}

export interface PoseCamera {
  azimute: number;
  elevacao: number;
}
export const POSE_PADRAO: PoseCamera = { azimute: 0.3, elevacao: 0.17 };

function Controles({ cena, exploded, reenquadrar, pose, travado }: { cena: CenaDados; exploded: boolean; reenquadrar: number; pose: PoseCamera; travado: boolean }) {
  const { camera, size, invalidate } = useThree();
  const aspecto = size.width / Math.max(size.height, 1);
  const distancia = distanciaDeEnquadramento(cena, aspecto, exploded, pose);
  const alvoZ = cena.profundidadeM * (exploded ? 0.55 : 0.5);
  const controles = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  useEffect(() => {
    const perspectiva = camera as THREE.PerspectiveCamera;
    perspectiva.fov = FOV;
    perspectiva.near = Math.max(distancia / 200, 0.005);
    perspectiva.far = distancia * 40;
    perspectiva.position.set(
      distancia * Math.sin(pose.azimute) * Math.cos(pose.elevacao),
      distancia * Math.sin(pose.elevacao),
      alvoZ + distancia * Math.cos(pose.azimute) * Math.cos(pose.elevacao),
    );
    perspectiva.updateProjectionMatrix();
    controles.current?.target.set(0, 0, alvoZ);
    controles.current?.update();
    invalidate();
  }, [camera, distancia, alvoZ, pose.azimute, pose.elevacao, reenquadrar, invalidate]);
  return (
    <OrbitControls
      ref={controles as never}
      makeDefault
      enabled={!travado}
      enableDamping
      dampingFactor={0.09}
      target={[0, 0, alvoZ]}
      minDistance={distancia * 0.12}
      maxDistance={distancia * 3}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.82}
      minAzimuthAngle={-Math.PI * 0.46}
      maxAzimuthAngle={Math.PI * 0.46}
      zoomToCursor={false}
    />
  );
}

/** Bloom só atua em pixels acima do limiar (emissão): de dia a intensidade é zero. Tone mapping no próprio composer. */
function Efeitos({ estado, iluminada }: { estado: ReturnType<typeof useEstadoCena>; iluminada: boolean }) {
  const bloom = useRef<BloomEffect>(null);
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = iluminada ? estado.current.noite * 1.1 : 0;
  });
  return (
    <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
      <Bloom ref={bloom} intensity={0} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur radius={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export interface PropsCena {
  spec: DesenhoSpec;
  cena: CenaDados;
  night: boolean;
  exploded: boolean;
  publico: boolean;
  /** Captura de preview: valores de dia/noite/explosão já no alvo e câmera sem interação. */
  imediato?: boolean;
  pose?: PoseCamera;
  reenquadrar?: number;
  onCarregandoTexturas?: (carregando: boolean) => void;
}

/** Tudo o que vive dentro do Canvas (também usado, com `imediato`, pela captura dos previews). */
export function CenaRender3d({ spec, cena, night, exploded, publico, imediato = false, pose = POSE_PADRAO, reenquadrar = 0, onCarregandoTexturas }: PropsCena) {
  const estado = useEstadoCena(night, exploded, imediato);
  const iluminada = spec.construction.kind !== "non_illuminated";
  return (
    <>
      <AmbienteEstudio />
      <LightingRig estado={estado} cena={cena} iluminada={iluminada} />
      <Suspense fallback={null}>
        <LetterBoxAssembly spec={spec} cena={cena} estado={estado} publico={publico} onCarregandoTexturas={onCarregandoTexturas} />
      </Suspense>
      <Controles cena={cena} exploded={exploded} reenquadrar={reenquadrar} pose={pose} travado={imediato} />
      <Efeitos estado={estado} iluminada={iluminada} />
    </>
  );
}

export interface PropsViewer {
  spec: DesenhoSpec;
  publico?: boolean;
  /** Previews estáticos para quando o WebGL não existe ou falha. */
  imagens?: { dia: string | null; noite: string | null; explodido: string | null };
  altura?: number | string;
  onAvisos?: (avisos: string[]) => void;
}

type ResultadoCena = { cena: CenaDados } | { erro: string; pendencia: boolean };

/** Cache por specHash (mais a qualidade): o mesmo desenho aprovado não é triangulado de novo a cada visita. */
const cacheDeCenas = new Map<string, CenaDados>();
const MAXIMO_CENAS_EM_CACHE = 3;

function calcularCena(spec: DesenhoSpec, qualidade: Qualidade): ResultadoCena {
  const chave = `${spec.specHash}:${qualidade}`;
  const guardada = cacheDeCenas.get(chave);
  if (guardada) return { cena: guardada };
  try {
    const cena = construirCena(spec, qualidade);
    cacheDeCenas.set(chave, cena);
    if (cacheDeCenas.size > MAXIMO_CENAS_EM_CACHE) cacheDeCenas.delete(cacheDeCenas.keys().next().value as string);
    return { cena };
  } catch (falha) {
    if (falha instanceof ProfundidadeAusenteError) return { erro: falha.message, pendencia: true };
    if (falha instanceof SvgInvalidoError) return { erro: falha.message, pendencia: true };
    console.error("[CPQ 3D] Falha ao montar a cena:", falha);
    return { erro: "Não foi possível montar o desenho 3D.", pendencia: false };
  }
}

const estiloBotao = (ativo: boolean) => ({ ...(ativo ? { background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "var(--accent)" } : {}) });

export function CpqRender3dViewer({ spec, publico = false, imagens, altura = 520, onAvisos }: PropsViewer) {
  const [night, setNight] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [qualidade, setQualidade] = useState<Qualidade>("alta");
  const [reenquadrar, setReenquadrar] = useState(0);
  const [carregandoTexturas, setCarregandoTexturas] = useState(false);
  const [contextoPerdido, setContextoPerdido] = useState(false);
  const [semWebgl] = useState(() => !webglDisponivel());
  const resultado = useMemo(() => calcularCena(spec, qualidade), [spec, qualidade]);
  useEffect(() => { if ("cena" in resultado) onAvisos?.(resultado.cena.avisos); }, [resultado, onAvisos]);

  const imagemEstatica = imagens && (exploded ? imagens.explodido : night ? imagens.noite : imagens.dia);
  const fallback = (mensagem: string) => (
    <div role="img" aria-label="Visualização estática do letreiro" style={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center", padding: 16, gap: 10, background: "var(--surface-2)", borderRadius: 12 }}>
      {imagemEstatica ? <img src={imagemEstatica} alt="Visualização do letreiro" style={{ maxWidth: "100%", maxHeight: altura, borderRadius: 8 }} /> : null}
      <div className="role-note" style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{mensagem}</div>
    </div>
  );

  if ("erro" in resultado) return fallback(resultado.erro);
  if (semWebgl) return fallback("Este navegador não permite o 3D interativo (WebGL indisponível). Mostrando as imagens da proposta.");
  if (contextoPerdido) return fallback("A placa de vídeo interrompeu o 3D. Recarregue a página para tentar de novo.");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div role="toolbar" aria-label="Controles da visualização 3D" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={night} style={estiloBotao(night)} onClick={() => setNight(valor => !valor)}>
          {night ? "☾ Noite" : "☀ Dia"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={exploded} style={estiloBotao(exploded)} onClick={() => setExploded(valor => !valor)}>
          Visão explodida
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReenquadrar(valor => valor + 1)}>Recentralizar</button>
        {!publico && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
            Qualidade
            <select value={qualidade} onChange={evento => setQualidade(evento.target.value as Qualidade)} aria-label="Qualidade da malha">
              <option value="alta">Alta</option>
              <option value="baixa">Baixa (vetor complexo)</option>
            </select>
          </label>
        )}
        {carregandoTexturas && <span className="badge b-neutral">Carregando texturas…</span>}
      </div>
      <div style={{ height: altura, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface-2)", touchAction: "none" }}>
        <LimiteDeErro fallback={() => fallback("O 3D interativo não pôde ser iniciado neste navegador.")}>
          <Canvas
            frameloop="demand"
            shadows
            dpr={[1, 1.75]}
            camera={{ fov: FOV, near: 0.01, far: 100, position: [0, 0, 2] }}
            gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", evento => { evento.preventDefault(); setContextoPerdido(true); });
            }}
          >
            <CenaRender3d spec={spec} cena={resultado.cena} night={night} exploded={exploded} publico={publico} reenquadrar={reenquadrar} onCarregandoTexturas={setCarregandoTexturas} />
          </Canvas>
        </LimiteDeErro>
      </div>
      <div className="role-note" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
        Arraste para girar, role para aproximar. As cores e a luz na tela são aproximações: a amostra física aprovada é a referência final de fabricação.
      </div>
    </div>
  );
}
