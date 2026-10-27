// svg-pathdata 6.0.3 publica types, mas seu mapa exports não expõe os .d.ts ao resolver bundler.
// Superfície usada pela normalização do editor; métodos confirmados no pacote instalado.
declare module "svg-pathdata" {
  export class SVGPathData {
    constructor(content: string);
    toAbs(): this;
    normalizeHVZ(normalizeZ?: boolean): this;
    normalizeST(): this;
    qtToC(): this;
    aToC(): this;
    matrix(
      a: number,
      b: number,
      c: number,
      d: number,
      e: number,
      f: number
    ): this;
    round(multiplier: number): this;
    encode(): string;
  }
}
