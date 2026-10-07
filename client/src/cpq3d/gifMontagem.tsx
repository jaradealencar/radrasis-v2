/**
 * Exporta a animação de montagem como GIF.
 *
 * Como `capture.tsx`, usa um root R3F temporário e fora da tela (câmera, tamanho e fundo fixos, `preserveDrawingBuffer` só neste
 * canvas descartável). A diferença é que o tempo da animação (`ControleAnimacao.t`) avança em passos fixos, um por quadro do GIF,
 * então o resultado não depende da velocidade do computador. Cada quadro é lido do canvas, reduzido a 256 cores (paleta própria por
 * quadro, porque o fundo vai do claro ao escuro) e gravado com o `gifenc`. O módulo é carregado sob demanda pelo viewer.
 */
import { createRoot, type RootState } from "@react-three/fiber";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import * as THREE from "three";
import type { ControleAnimacao } from "./animacaoMontagem";
import { cenaIluminada, type DesenhoSpec } from "./cena";
import { CenaRender3d, obterCenaEmCache, POSE_PADRAO } from "./components/CpqRender3dViewer";
import { GIF_ALTURA, GIF_INTERVALO_MS, GIF_LARGURA, instantesDoGif } from "./gifQuadros";

const PAUSA_INICIAL_MS = 700;
const PAUSA_FINAL_MS = 1800;

export class GifCanceladoError extends Error {
  constructor() {
    super("Geração do GIF cancelada.");
    this.name = "GifCanceladoError";
  }
}

export interface OpcoesGif {
  largura?: number;
  altura?: number;
  /** Fração concluída (0..1), chamada a cada quadro. */
  aoProgredir?: (fracao: number) => void;
  /** Devolve verdadeiro para interromper (a promessa rejeita com `GifCanceladoError`). */
  cancelado?: () => boolean;
}

const esperar = (ms: number) => new Promise<void>(resolver => setTimeout(resolver, ms));

export async function gerarGifMontagem(spec: DesenhoSpec, opcoes: OpcoesGif = {}): Promise<Blob> {
  const largura = opcoes.largura ?? GIF_LARGURA;
  const altura = opcoes.altura ?? GIF_ALTURA;
  const iluminada = cenaIluminada(spec);
  const instantes = instantesDoGif(iluminada);
  const cena = obterCenaEmCache(spec, "alta");

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const copia = document.createElement("canvas");
  copia.width = largura;
  copia.height = altura;
  const contexto = copia.getContext("2d", { willReadFrequently: true });
  if (!contexto) throw new Error("Este navegador não permite gerar o GIF (canvas 2D indisponível).");

  const controle: ControleAnimacao = { ativa: true, t: 0, avanca: false };
  const raiz = createRoot(canvas);
  const criado: { estado: RootState | null } = { estado: null };
  const temMapas = spec.materials.some(material => material.assets.some(asset => asset.kind !== "reference"));
  let viuCarregando = false;
  let texturasProntas = !temMapas;
  try {
    await raiz.configure({
      frameloop: "never",
      dpr: 1,
      shadows: true,
      size: { width: largura, height: altura, top: 0, left: 0 },
      gl: { antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping },
      camera: { fov: 35, near: 0.01, far: 100, position: [0, 0, 2] },
      onCreated: estadoR3f => { criado.estado = estadoR3f; },
    });
    raiz.render(
      <CenaRender3d
        spec={spec}
        cena={cena}
        night={false}
        exploded
        publico
        imediato
        pose={POSE_PADRAO}
        animacao={{ current: controle }}
        animando
        onCarregandoTexturas={carregando => {
          if (carregando) viuCarregando = true;
          else if (viuCarregando) texturasProntas = true;
        }}
      />,
    );
    // Espera o ambiente (HDRI) e as texturas chegarem; cada volta renderiza um quadro.
    const limite = Date.now() + 15_000;
    while (Date.now() < limite) {
      await esperar(120);
      criado.estado?.advance(performance.now());
      if (criado.estado?.scene.environment && texturasProntas) break;
    }

    const gif = GIFEncoder();
    let relogio = performance.now();
    for (let indice = 0; indice < instantes.length; indice += 1) {
      if (opcoes.cancelado?.()) throw new GifCanceladoError();
      controle.t = instantes[indice];
      relogio += GIF_INTERVALO_MS;
      criado.estado?.advance(relogio);
      contexto.drawImage(canvas, 0, 0);
      const { data } = contexto.getImageData(0, 0, largura, altura);
      const paleta = quantize(data, 256);
      const indices = applyPalette(data, paleta);
      const ultimo = indice === instantes.length - 1;
      gif.writeFrame(indices, largura, altura, { palette: paleta, delay: indice === 0 ? PAUSA_INICIAL_MS : ultimo ? PAUSA_FINAL_MS : GIF_INTERVALO_MS, repeat: 0 });
      opcoes.aoProgredir?.((indice + 1) / instantes.length);
      await esperar(0); // devolve o controle ao navegador (barra de progresso, cancelamento)
    }
    gif.finish();
    return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" });
  } finally {
    raiz.unmount();
    const contextoGl = criado.estado?.gl;
    contextoGl?.dispose();
    contextoGl?.forceContextLoss();
  }
}
