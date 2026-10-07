import { duracaoDaAnimacao } from "./animacaoMontagem";

export const GIF_LARGURA = 800;
export const GIF_ALTURA = 500;
/** Intervalo entre quadros (ms): ~16,7 quadros por segundo, suave o bastante para o encaixe e leve para enviar por mensagem. */
export const GIF_INTERVALO_MS = 60;

/** Teto do GIF que vai para o servidor (o servidor aceita até 4 MB, `GIF_3D_MAX_BYTES`): sobra para o cabeçalho da requisição. */
export const GIF_ENVIO_MAX_BYTES = 3_800_000;
/** Ajustes sucessivos para o GIF caber no teto de envio: o padrão e, se passar, uma versão menor e com menos quadros. */
export const AJUSTES_GIF_ENVIO = [
  { largura: GIF_LARGURA, altura: GIF_ALTURA, intervaloMs: GIF_INTERVALO_MS, cores: 256 },
  { largura: 640, altura: 400, intervaloMs: 80, cores: 256 },
  { largura: 480, altura: 300, intervaloMs: 100, cores: 128 },
  { largura: 400, altura: 250, intervaloMs: 120, cores: 64 },
] as const;

/** Instante de cada quadro do GIF, em segundos: passos fixos, o último cai exatamente no fim da animação. */
export function instantesDoGif(iluminada: boolean, intervaloMs = GIF_INTERVALO_MS): number[] {
  const duracao = duracaoDaAnimacao(iluminada);
  const passos = Math.max(1, Math.ceil((duracao * 1000) / intervaloMs));
  return Array.from({ length: passos + 1 }, (_, indice) => Math.min(duracao, (indice * intervaloMs) / 1000));
}
