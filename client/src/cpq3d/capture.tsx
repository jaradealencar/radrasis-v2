/**
 * Previews determinísticos para a proposta/PDF: vista montada de dia, montada à noite e explodida.
 *
 * Cada captura usa um root R3F temporário e fora da tela, com câmera, alvo, resolução, fundo e exposição FIXOS (nada da órbita que
 * o vendedor escolheu), tudo já no estado final (sem animação). `preserveDrawingBuffer` só existe nesse canvas descartável — o
 * viewer interativo nunca o liga. O PDF usa as imagens do snapshot e nunca executa WebGL.
 */
import { createRoot, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { construirCena, type DesenhoSpec } from "./cena";
import { CenaRender3d, POSE_PADRAO, type PoseCamera } from "./components/CpqRender3dViewer";

export const PREVIEW_LARGURA = 1600;
export const PREVIEW_ALTURA = 1000;

export type TipoPreview = "dia" | "noite" | "explodido";

const POSES: Record<TipoPreview, PoseCamera> = {
  dia: POSE_PADRAO,
  noite: POSE_PADRAO,
  explodido: { azimute: 0.62, elevacao: 0.21 },
};

const esperar = (ms: number) => new Promise<void>(resolver => setTimeout(resolver, ms));

export async function capturarPreview(spec: DesenhoSpec, tipo: TipoPreview): Promise<Blob> {
  const cena = construirCena(spec, "alta");
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_LARGURA;
  canvas.height = PREVIEW_ALTURA;
  const raiz = createRoot(canvas);
  // Objeto em vez de `let`: o TypeScript não enxerga a atribuição feita dentro do callback onCreated.
  const criado: { estado: RootState | null } = { estado: null };
  const temMapas = spec.materials.some(material => material.assets.some(asset => asset.kind !== "reference"));
  let viuCarregando = false;
  let texturasProntas = !temMapas;
  try {
    await raiz.configure({
      frameloop: "never",
      dpr: 1,
      shadows: true,
      size: { width: PREVIEW_LARGURA, height: PREVIEW_ALTURA, top: 0, left: 0 },
      gl: { antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping },
      camera: { fov: 35, near: 0.01, far: 100, position: [0, 0, 2] },
      onCreated: estadoR3f => { criado.estado = estadoR3f; },
    });
    raiz.render(
      <CenaRender3d
        spec={spec}
        cena={cena}
        night={tipo === "noite"}
        exploded={tipo === "explodido"}
        publico={false}
        imediato
        pose={POSES[tipo]}
        onCarregandoTexturas={carregando => {
          if (carregando) viuCarregando = true;
          else if (viuCarregando) texturasProntas = true;
        }}
      />,
    );
    // Espera o ambiente (HDRI) e as texturas chegarem; cada volta renderiza um frame.
    const limite = Date.now() + 12_000;
    let ambientePronto = false;
    while (Date.now() < limite) {
      await esperar(120);
      criado.estado?.advance(performance.now());
      ambientePronto = !!criado.estado?.scene.environment;
      if (ambientePronto && texturasProntas) break;
    }
    // Frames extras para assentar sombras, câmera e o composer (bloom/tone mapping).
    for (let i = 0; i < 4; i += 1) {
      await esperar(60);
      criado.estado?.advance(performance.now());
    }
    return await new Promise<Blob>((resolver, rejeitar) => {
      canvas.toBlob(blob => (blob ? resolver(blob) : rejeitar(new Error("Não foi possível gerar a imagem do preview."))), "image/png");
    });
  } finally {
    raiz.unmount();
    const contexto = criado.estado?.gl;
    contexto?.dispose();
    contexto?.forceContextLoss();
    cena.parede?.dispose();
    cena.fundo?.geometrias.forEach(geometria => geometria.dispose());
  }
}

/** As três imagens da aprovação, uma de cada vez (um contexto WebGL por vez). */
export async function capturarPreviews(spec: DesenhoSpec, aoProgredir?: (tipo: TipoPreview) => void): Promise<Record<TipoPreview, Blob>> {
  const resultado = {} as Record<TipoPreview, Blob>;
  for (const tipo of ["dia", "noite", "explodido"] as const) {
    aoProgredir?.(tipo);
    resultado[tipo] = await capturarPreview(spec, tipo);
  }
  return resultado;
}
