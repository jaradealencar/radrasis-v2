/** Tipos mínimos do `gifenc` (o pacote não publica declarações): só o que a exportação do GIF da montagem usa. */
declare module "gifenc" {
  export type PaletaGif = number[][];
  export type FormatoCorGif = "rgb565" | "rgb444" | "rgba4444";

  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: FormatoCorGif }): PaletaGif;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: PaletaGif, format?: FormatoCorGif): Uint8Array;

  export interface CodificadorGif {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: PaletaGif; delay?: number; repeat?: number; transparent?: boolean; transparentIndex?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }
  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): CodificadorGif;
}
