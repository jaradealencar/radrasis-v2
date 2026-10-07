import { duracaoDaAnimacao } from "./animacaoMontagem";

export const GIF_LARGURA = 800;
export const GIF_ALTURA = 500;
/** Intervalo entre quadros (ms): ~16,7 quadros por segundo, suave o bastante para o encaixe e leve para enviar por mensagem. */
export const GIF_INTERVALO_MS = 60;

/** Instante de cada quadro do GIF, em segundos: passos fixos, o último cai exatamente no fim da animação. */
export function instantesDoGif(iluminada: boolean, intervaloMs = GIF_INTERVALO_MS): number[] {
  const duracao = duracaoDaAnimacao(iluminada);
  const passos = Math.max(1, Math.ceil((duracao * 1000) / intervaloMs));
  return Array.from({ length: passos + 1 }, (_, indice) => Math.min(duracao, (indice * intervaloMs) / 1000));
}
