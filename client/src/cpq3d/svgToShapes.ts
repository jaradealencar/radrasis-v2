/**
 * SVG técnico aprovado -> formas com vazados, em escala física (metros), centradas na origem, Y para cima.
 *
 * O SVG vem da factibilidade/nesting (não da foto). Antes do parse ele é inspecionado (sem script, imagem, href externo...),
 * e o `SVGLoader` só lê geometria: nada do conteúdo é executado. `ShapePath.toShapes()` resolve vazados e ilhas pelo fill-rule do
 * próprio caminho (nonzero/evenodd), que é o que preserva o miolo de letras como A, B, O e R.
 */
import { Shape } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { inspecionarSvgRender3d } from "@shared/cpq-render3d-svg";
import { areaDaRegiao, mmToWorld, normalizarRegiao, regiaoParaShape, shapeParaRegiao, type Regiao } from "./geometry/geometryUtils";

/** Diferença máxima aceita entre a proporção do desenho e a das medidas físicas (mesma do servidor). */
export const TOLERANCIA_PROPORCAO = 0.03;

export interface FormaSvg {
  /** Índice do `<path>` no documento (o mesmo `pathIndexes` da análise de cores). */
  pathIndex: number;
  shapeIndex: number;
  shape: Shape;
  regiao: Regiao;
  sourceColor: string | null;
}

export interface ResultadoSvg {
  formas: FormaSvg[];
  /** Quantidade de caminhos que o SVGLoader leu (deve bater com a do documento para os índices de cor valerem). */
  caminhosLidos: number;
  /** Caixa do desenho em mm, já na escala aplicada. */
  larguraMm: number;
  alturaMm: number;
  avisos: string[];
}

export class SvgInvalidoError extends Error {
  constructor(message: string, readonly motivos: string[] = []) {
    super(message);
    this.name = "SvgInvalidoError";
  }
}

function corDoPreenchimento(estilo: unknown): string | null {
  const preenchimento = (estilo as { fill?: string } | undefined)?.fill;
  return preenchimento && preenchimento !== "none" ? preenchimento : null;
}

/** Regiões brutas (unidades do SVG, Y para baixo) por caminho. Exportada para testes. */
export function lerFormasBrutas(svg: string, divisoes: number): { formas: Array<{ pathIndex: number; shapeIndex: number; regiao: Regiao; cor: string | null }>; caminhosLidos: number } {
  const lido = new SVGLoader().parse(svg);
  const formas: Array<{ pathIndex: number; shapeIndex: number; regiao: Regiao; cor: string | null }> = [];
  lido.paths.forEach((caminho, pathIndex) => {
    const estilo = (caminho.userData as { style?: unknown } | undefined)?.style;
    const cor = corDoPreenchimento(estilo);
    if (!cor) return; // só contorno (stroke): não tem face
    caminho.toShapes().forEach((shape, shapeIndex) => {
      const regiao = shapeParaRegiao(shape, divisoes);
      if (regiao) formas.push({ pathIndex, shapeIndex, regiao, cor });
    });
  });
  return { formas, caminhosLidos: lido.paths.length };
}

/**
 * Converte o SVG em formas físicas. `larguraMm`/`alturaMm` são as medidas aprovadas do desenho (caixa envolvente dos contornos).
 * Lança `SvgInvalidoError` para SVG inseguro ou proporção incompatível (acima de `TOLERANCIA_PROPORCAO`).
 */
export function svgParaFormas(svg: string, opcoes: { larguraMm: number; alturaMm: number; divisoes?: number }): ResultadoSvg {
  const inspecao = inspecionarSvgRender3d(svg);
  if (!inspecao.ok) throw new SvgInvalidoError(`SVG recusado: ${inspecao.motivos.join(" ")}`, inspecao.motivos);
  if (!(opcoes.larguraMm > 0 && opcoes.alturaMm > 0)) throw new SvgInvalidoError("As medidas físicas do desenho são inválidas.");

  const { formas: brutas, caminhosLidos } = lerFormasBrutas(svg, opcoes.divisoes ?? 12);
  if (!brutas.length) throw new SvgInvalidoError("O SVG não tem formas preenchidas para desenhar.");

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const forma of brutas)
    for (const ponto of forma.regiao.outer) {
      if (ponto.x < minX) minX = ponto.x;
      if (ponto.x > maxX) maxX = ponto.x;
      if (ponto.y < minY) minY = ponto.y;
      if (ponto.y > maxY) maxY = ponto.y;
    }
  const larguraSvg = maxX - minX, alturaSvg = maxY - minY;
  if (!(larguraSvg > 0 && alturaSvg > 0)) throw new SvgInvalidoError("O desenho não tem área visível.");

  const escalaX = opcoes.larguraMm / larguraSvg, escalaY = opcoes.alturaMm / alturaSvg;
  const diferenca = Math.abs(escalaX - escalaY) / Math.max(escalaX, escalaY);
  if (diferenca > TOLERANCIA_PROPORCAO)
    throw new SvgInvalidoError(`A proporção do desenho não bate com as medidas físicas (diferença de ${(diferenca * 100).toFixed(1)}%).`);

  const avisos: string[] = [];
  if (caminhosLidos !== inspecao.pathCount)
    avisos.push(`O SVG tem ${inspecao.pathCount} caminhos, mas ${caminhosLidos} foram lidos: as cores por região podem não corresponder.`);

  // Escala uniforme (a da largura), centro na origem, Y para cima, metros.
  const fator = mmToWorld(escalaX);
  const centroX = (minX + maxX) / 2, centroY = (minY + maxY) / 2;
  const mover = (anel: Array<{ x: number; y: number }>) => anel.map(ponto => ({ x: (ponto.x - centroX) * fator, y: -(ponto.y - centroY) * fator }));

  const formas: FormaSvg[] = [];
  for (const bruta of brutas) {
    const regiao = shapeParaRegiaoMovida(bruta.regiao, mover);
    if (!regiao || areaDaRegiao(regiao) < 1e-10) continue;
    formas.push({ pathIndex: bruta.pathIndex, shapeIndex: bruta.shapeIndex, shape: regiaoParaShape(regiao), regiao, sourceColor: bruta.cor });
  }
  return { formas, caminhosLidos, larguraMm: larguraSvg * escalaX, alturaMm: alturaSvg * escalaX, avisos };
}

function shapeParaRegiaoMovida(regiao: Regiao, mover: (anel: Array<{ x: number; y: number }>) => Array<{ x: number; y: number }>): Regiao | null {
  // O flip de Y inverte a orientação dos anéis: `normalizarRegiao` devolve externo anti-horário e vazados horários de novo.
  return normalizarRegiao({ outer: mover(regiao.outer), holes: regiao.holes.map(mover) });
}
