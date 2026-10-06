import { createRequire } from "node:module";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { RotacaoPermitida } from "../../shared/politica-corte";

const require = createRequire(import.meta.url);
const polygonClipping = require("polygon-clipping") as typeof import("polygon-clipping");
type SVGCommand =
  | { type: 2; x: number; y: number }
  | { type: 16; x: number; y: number }
  | { type: 32; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 1 };
type SVGPath = {
  commands: SVGCommand[];
  toAbs(): SVGPath;
  normalizeHVZ(normalizeZ?: boolean): SVGPath;
  normalizeST(): SVGPath;
  qtToC(): SVGPath;
  aToC(): SVGPath;
};
const SVGPathData = require("svg-pathdata").SVGPathData as {
  new (data: string): SVGPath;
  MOVE_TO: 2;
  LINE_TO: 16;
  CURVE_TO: 32;
  CLOSE_PATH: 1;
};

const MARGEM_CORTE_MM = 20;
const ESCALA_MINIMA_AUTOMATICA = 1 / 1.03;
const AREA_MINIMA_FRAGMENTO_MM2 = 0.01;
const MAX_CAMINHOS = 500;
const MAX_PONTOS = 250_000;
const MAX_PECAS_POR_MATERIAL = 100;
const MAX_PECAS_NO_SVG = MAX_PECAS_POR_MATERIAL * 3;
const MAX_LINHAS_DE_CORTE = 2_000;

export const OPCOES_FACTIBILIDADE = [
  {
    acao: "APROVAR_EMENDA_TECNICA",
    descricao:
      "Aprovar o corte da peça com a linha de emenda indicada para manter o tamanho original do letreiro.",
  },
  {
    acao: "REDIMENSIONAR_PARA_CABER",
    descricao:
      "Redimensionar todo o projeto proporcionalmente para que nenhuma peça precise de emenda.",
  },
  {
    acao: "SOLICITAR_ANALISE_HUMANA",
    descricao:
      "Encaminhar o projeto para avaliação do setor de engenharia/vendas.",
  },
] as const;

export type CpqFactibilidadeAcao =
  (typeof OPCOES_FACTIBILIDADE)[number]["acao"];

export type CpqFactibilidadeChapa = {
  id: number;
  nome: string;
  larguraMm: number;
  alturaMm: number;
  bobina?: boolean;
  principal?: boolean;
};

export function idFormatoTemporarioNesting(materiaPrimaId: number): number {
  return 1_000_000_000 + (materiaPrimaId % 1_000_000_000);
}

export function calcularHashFormatosNesting(chapas: CpqFactibilidadeChapa[]): string {
  const dados = chapas.map(chapa => ({
    id: chapa.id,
    nome: chapa.nome,
    larguraMm: chapa.larguraMm,
    alturaMm: chapa.alturaMm,
    bobina: !!chapa.bobina,
    principal: !!chapa.principal,
  })).sort((a, b) => a.id - b.id || a.larguraMm - b.larguraMm || a.alturaMm - b.alturaMm);
  return sha256(JSON.stringify(dados));
}

export type CpqNestingCamada = "face" | "aro" | "fundo";

export type CpqFactibilidadeLoteMaterial = {
  camada: CpqNestingCamada;
  /** Restringe uma camada a caminhos aprovados, como regiões cromáticas da face. */
  pathIndexes?: number[];
};

export type CpqFactibilidadeMaterial = {
  id: number;
  nome: string;
  chapas: CpqFactibilidadeChapa[];
  /** Ausente em fluxos antigos: mantém o comportamento de nesting da arte inteira. */
  lotes?: CpqFactibilidadeLoteMaterial[];
  /** Margem de borda própria deste material (cadastro/processo de corte); ausente = a margem do orçamento. */
  margemBordaMm?: number;
  /** Escovado ("veio"): a peça só gira 0°/180° em relação ao veio; ausente/"livre" = pode girar 90°. */
  rotacao?: RotacaoPermitida;
};

export type CpqLinhaCorte = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  materiaPrimaId: number;
  materiaPrima: string;
  pecaId: string;
  /** Quanto material (mm) a linha atravessa: quanto menor, melhor o ponto da emenda (vão entre letras = 0). */
  materialCortadoMm?: number;
};

export type CpqFragmentoFatiado = {
  id: string;
  pecaId: string;
  larguraMm: number;
  alturaMm: number;
};

export type CpqPecaParaNesting = {
  id: string;
  svg: string;
  larguraMm: number;
  alturaMm: number;
};

export type CpqFactibilidadeMaterialResult = {
  id_materia_prima: number;
  materia_prima: string;
  id_maior_chapa: number;
  nome_maior_chapa: string;
  largura_chapa_mm: number;
  altura_chapa_mm: number;
  svg_para_nesting: string;
  svg_visualizacao: string;
  hash_svg_para_nesting: string;
  hash_pecas_para_nesting: string;
  hash_pecas_redimensionadas_opcao: string | null;
  fragmentos: CpqFragmentoFatiado[];
  pecas_para_nesting: CpqPecaParaNesting[];
  pecas_redimensionadas_opcao?: CpqPecaParaNesting[];
};

export type CpqFactibilidadeResult = {
  status_factibilidade: "APTO_NESTING" | "REQUER_APROVACAO_EMENDA";
  projeto_fatiado: boolean;
  projeto_redimensionado: boolean;
  fator_escala_aplicado: number;
  fator_escala_minimo_para_caber: number;
  largura_projeto_mm: number;
  altura_projeto_mm: number;
  svg_ajustado: string | null;
  svg_redimensionado_opcao: string | null;
  hash_svg_redimensionado_opcao: string | null;
  detalhes_corte: {
    pecas_afetadas: string[];
    quantidade_emendas: number;
    coordenadas_linha_corte: CpqLinhaCorte[];
  };
  opcoes_disponiveis: typeof OPCOES_FACTIBILIDADE | [];
  materiais: CpqFactibilidadeMaterialResult[];
  avisos: string[];
};

export class CpqFactibilidadeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_geometry"
      | "missing_board"
      | "unsupported_geometry"
      | "boolean_failure"
      | "configuration"
  ) {
    super(message);
    this.name = "CpqFactibilidadeError";
  }
}

type Pair = [number, number];
type Ring = Pair[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
type ViewBox = { x: number; y: number; width: number; height: number };
type ParsedPiece = {
  id: string;
  geometry: MultiPolygon;
  bounds: Bounds;
  pathIndex: number;
  camada: CpqNestingCamada | null;
};
type ParsedSvg = {
  viewBox: ViewBox;
  paths: Array<{ id: string; d: string; camada: CpqNestingCamada | null }>;
  pieces: ParsedPiece[];
  mmPerUnitX: number;
  mmPerUnitY: number;
};
type OutputFragment = {
  id: string;
  pecaId: string;
  geometry: MultiPolygon;
  bounds: Bounds;
};

function attrs(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([\w:-]+)\s*=\s*(["'])(.*?)\2/g;
  for (const match of text.matchAll(pattern)) result[match[1].toLowerCase()] = match[3];
  return result;
}

function camadaSvg(value: string | undefined): CpqNestingCamada | null {
  if (!value) return null;
  const tokens = new Set(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const face = ["face", "frente", "visual", "translucida"].some(alias => tokens.has(alias));
  const aro = ["aro", "lateral", "laterais", "contorno", "perfil"].some(alias => tokens.has(alias));
  const fundo = ["fundo", "base", "costas", "verso", "back"].some(alias => tokens.has(alias));
  const matches = [face ? "face" : null, aro ? "aro" : null, fundo ? "fundo" : null].filter(Boolean);
  return matches.length === 1 ? matches[0] as CpqNestingCamada : null;
}

/** Associa cada path à camada sem interpretar ou transformar a geometria SVG. */
function camadasPorCaminho(svg: string): Array<CpqNestingCamada | null> {
  const stack: Array<CpqNestingCamada | null> = [];
  const result: Array<CpqNestingCamada | null> = [];
  const tags = /<\s*\/\s*g\b[^>]*>|<\s*g\b[^>]*>|<\s*path\b[^>]*\/?\s*>/gi;
  for (const match of svg.matchAll(tags)) {
    const tag = match[0];
    if (/^<\s*\//.test(tag)) {
      if (/^<\s*\/\s*g\b/i.test(tag)) stack.pop();
      continue;
    }
    if (/^<\s*g\b/i.test(tag)) {
      const attributes = attrs(tag.replace(/^<\s*g\b/i, "").replace(/\/?\s*>$/, ""));
      const namespaceLabel = Object.entries(attributes).find(([key]) => key.endsWith(":label"))?.[1];
      const ownLayer = camadaSvg(attributes["inkscape:label"] ?? namespaceLabel ?? attributes["data-layer-name"] ?? attributes["aria-label"] ?? attributes.label ?? attributes.id);
      if (!/\/\s*>$/.test(tag)) stack.push(ownLayer ?? stack[stack.length - 1] ?? null);
      continue;
    }
    result.push(stack[stack.length - 1] ?? null);
  }
  return result;
}

function attrEscape(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return escaped[character];
  });
}

function boundsOf(rings: Ring[]): Bounds {
  const points = rings.flat();
  if (!points.length)
    throw new CpqFactibilidadeError(
      "Um contorno vetorial ficou vazio durante a análise.",
      "invalid_geometry"
    );
  return {
    minX: points.reduce((minimum, point) => Math.min(minimum, point[0]), Infinity),
    maxX: points.reduce((maximum, point) => Math.max(maximum, point[0]), -Infinity),
    minY: points.reduce((minimum, point) => Math.min(minimum, point[1]), Infinity),
    maxY: points.reduce((maximum, point) => Math.max(maximum, point[1]), -Infinity),
  };
}

function signedArea(ring: Ring): number {
  let twiceArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  return twiceArea / 2;
}

function pointOnSegment(point: Pair, a: Pair, b: Pair): boolean {
  const cross =
    (point[1] - a[1]) * (b[0] - a[0]) -
    (point[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(cross) > 1e-7) return false;
  return (
    point[0] >= Math.min(a[0], b[0]) - 1e-7 &&
    point[0] <= Math.max(a[0], b[0]) + 1e-7 &&
    point[1] >= Math.min(a[1], b[1]) - 1e-7 &&
    point[1] <= Math.max(a[1], b[1]) + 1e-7
  );
}

function pointInRing(point: Pair, ring: Ring): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const a = ring[index];
    const b = ring[previous];
    if (pointOnSegment(point, a, b)) return false;
    const crosses =
      (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] <
        ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToLine(point: Pair, start: Pair, end: Pair): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
}

function splitCubic(
  p0: Pair,
  p1: Pair,
  p2: Pair,
  p3: Pair
): [Pair[], Pair[]] {
  const midpoint = (a: Pair, b: Pair): Pair => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const p01 = midpoint(p0, p1);
  const p12 = midpoint(p1, p2);
  const p23 = midpoint(p2, p3);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const p0123 = midpoint(p012, p123);
  return [
    [p0, p01, p012, p0123],
    [p0123, p123, p23, p3],
  ];
}

function flattenCubic(
  p0: Pair,
  p1: Pair,
  p2: Pair,
  p3: Pair,
  tolerance: number,
  depth = 0
): Pair[] {
  if (
    depth >= 14 ||
    Math.max(distanceToLine(p1, p0, p3), distanceToLine(p2, p0, p3)) <= tolerance
  ) {
    return [p3];
  }
  const [left, right] = splitCubic(p0, p1, p2, p3);
  return [
    ...flattenCubic(left[0], left[1], left[2], left[3], tolerance, depth + 1),
    ...flattenCubic(right[0], right[1], right[2], right[3], tolerance, depth + 1),
  ];
}

function commandPoint(x: number, y: number): Pair {
  return [x, y];
}

function pathContours(
  d: string,
  origin: ViewBox,
  scaleX: number,
  scaleY: number,
  tolerance: number
): Ring[] {
  let commands: SVGCommand[];
  try {
    commands = new SVGPathData(d)
      .toAbs()
      .normalizeHVZ(false)
      .normalizeST()
      .qtToC()
      .aToC().commands;
  } catch {
    throw new CpqFactibilidadeError(
      "Um caminho SVG contém comandos que não puderam ser interpretados.",
      "invalid_geometry"
    );
  }

  const rings: Ring[] = [];
  let points: Ring | null = null;
  let current: Pair = [0, 0];
  let start: Pair = [0, 0];
  let totalPoints = 0;
  const convert = (point: Pair): Pair => [
    (point[0] - origin.x) * scaleX,
    (point[1] - origin.y) * scaleY,
  ];
  const finish = (closed: boolean) => {
    if (!points) return;
    if (!closed)
      throw new CpqFactibilidadeError(
        "Todos os contornos precisam estar fechados antes do corte CNC.",
        "invalid_geometry"
      );
    const deduped = points.filter(
      (point, index) =>
        index === 0 ||
        Math.hypot(
          point[0] - points![index - 1][0],
          point[1] - points![index - 1][1]
        ) > 1e-8
    );
    if (deduped.length > 1 && Math.hypot(deduped[0][0] - deduped.at(-1)![0], deduped[0][1] - deduped.at(-1)![1]) > 1e-8) {
      deduped.push(deduped[0]);
    }
    if (deduped.length >= 4 && Math.abs(signedArea(deduped)) > AREA_MINIMA_FRAGMENTO_MM2) rings.push(deduped);
    points = null;
  };

  for (const command of commands) {
    if (command.type === SVGPathData.MOVE_TO) {
      finish(false);
      current = commandPoint(command.x, command.y);
      start = current;
      points = [convert(current)];
      totalPoints += 1;
      continue;
    }
    if (!points)
      throw new CpqFactibilidadeError(
        "O caminho SVG precisa iniciar cada contorno com M.",
        "invalid_geometry"
      );
    if (command.type === SVGPathData.LINE_TO) {
      current = commandPoint(command.x, command.y);
      points.push(convert(current));
      totalPoints += 1;
    } else if (command.type === SVGPathData.CURVE_TO) {
      const p0 = current;
      const p1 = commandPoint(command.x1, command.y1);
      const p2 = commandPoint(command.x2, command.y2);
      const p3 = commandPoint(command.x, command.y);
      const flattened = flattenCubic(p0, p1, p2, p3, tolerance / Math.max(scaleX, scaleY));
      for (const point of flattened) points.push(convert(point));
      totalPoints += flattened.length;
      current = p3;
    } else if (command.type === SVGPathData.CLOSE_PATH) {
      current = start;
      const startPhysical = convert(start);
      if (Math.hypot(points[0][0] - startPhysical[0], points[0][1] - startPhysical[1]) > 1e-8) points.push(startPhysical);
      finish(true);
    } else {
      throw new CpqFactibilidadeError(
        "O SVG possui um comando de caminho que não foi normalizado.",
        "unsupported_geometry"
      );
    }
    if (totalPoints > MAX_PONTOS)
      throw new CpqFactibilidadeError(
        "O SVG ultrapassou o limite de pontos permitido para fatiamento.",
        "invalid_geometry"
      );
  }
  finish(false);
  return rings;
}

function areaBounds(rings: Ring[]): number {
  return Math.abs(signedArea(rings[0]));
}

function parseSvg(
  svg: string,
  larguraSvgMm: number,
  alturaSvgMm: number
): ParsedSvg {
  if (
    svg.length > 1_500_000 ||
    /<!doctype|<!entity|<\s*(script|foreignObject|image|use)\b|\son[a-z]+\s*=|(?:href|xlink:href|transform)\s*=/i.test(svg)
  ) {
    throw new CpqFactibilidadeError(
      "O SVG excede o limite ou contém conteúdo não permitido para fabricação.",
      "invalid_geometry"
    );
  }
  const tags = [...svg.matchAll(/<\s*\/?\s*([a-zA-Z][\w:-]*)\b[^>]*>/g)].map(match => match[1].toLowerCase());
  const allowedTags = new Set(["svg", "g", "path", "defs", "title", "desc", "metadata"]);
  const unsupportedTag = tags.find(tag => !allowedTags.has(tag));
  if (unsupportedTag)
    throw new CpqFactibilidadeError(
      `O elemento SVG <${unsupportedTag}> precisa ser convertido em caminho antes da fabricação.`,
      "unsupported_geometry"
    );
  const root = svg.match(/<svg\b([^>]*)>/i)?.[1];
  const viewBoxText = root ? attrs(root).viewbox : undefined;
  const viewBoxValues = viewBoxText?.trim().split(/[\s,]+/).map(Number);
  if (
    !viewBoxValues ||
    viewBoxValues.length !== 4 ||
    !viewBoxValues.every(Number.isFinite) ||
    viewBoxValues[2] <= 0 ||
    viewBoxValues[3] <= 0
  ) {
    throw new CpqFactibilidadeError(
      "O SVG precisa ter um viewBox válido para calcular cortes físicos.",
      "invalid_geometry"
    );
  }
  const viewBox = {
    x: viewBoxValues[0],
    y: viewBoxValues[1],
    width: viewBoxValues[2],
    height: viewBoxValues[3],
  };
  const mmPerUnitX = larguraSvgMm / viewBox.width;
  const mmPerUnitY = alturaSvgMm / viewBox.height;
  if (
    Math.abs(mmPerUnitX - mmPerUnitY) / Math.max(mmPerUnitX, mmPerUnitY) > 0.002
  ) {
    throw new CpqFactibilidadeError(
      "Largura e altura físicas precisam manter a proporção do viewBox.",
      "invalid_geometry"
    );
  }
  const pathTags = [...svg.matchAll(/<path\b([^>]*)\/?\s*>/gi)];
  const pathLayers = camadasPorCaminho(svg);
  if (!pathTags.length || pathTags.length > MAX_CAMINHOS)
    throw new CpqFactibilidadeError(
      "O SVG precisa conter entre 1 e 500 caminhos vetoriais.",
      "invalid_geometry"
    );

  const paths: ParsedSvg["paths"] = [];
  const pieces: ParsedPiece[] = [];
  let pointCount = 0;
  pathTags.forEach((match, pathIndex) => {
    const attributes = attrs(match[1]);
    const d = attributes.d;
    if (!d)
      throw new CpqFactibilidadeError(
        "Um caminho SVG não possui dados geométricos.",
        "invalid_geometry"
      );
    if (d.length > 250_000)
      throw new CpqFactibilidadeError(
        "Um caminho SVG excede o limite de complexidade permitido.",
        "invalid_geometry"
      );
    const id = (attributes.id || `Peca_${pathIndex + 1}`).slice(0, 120);
    const camada = pathLayers[pathIndex] ?? null;
    paths.push({ id, d, camada });
    const rings = pathContours(d, viewBox, mmPerUnitX, mmPerUnitY, 0.1);
    pointCount += rings.reduce((sum, ring) => sum + ring.length, 0);
    if (pointCount > MAX_PONTOS)
      throw new CpqFactibilidadeError(
        "O SVG ultrapassou o limite de pontos permitido para fatiamento.",
        "invalid_geometry"
      );
    const parents = rings.map((ring, index) => {
      let parent = -1;
      let parentArea = Infinity;
      for (let other = 0; other < rings.length; other += 1) {
        if (other === index || areaBounds([rings[other]]) <= areaBounds([ring])) continue;
        if (
          pointInRing(ring[0], rings[other]) &&
          areaBounds([rings[other]]) < parentArea
        ) {
          parent = other;
          parentArea = areaBounds([rings[other]]);
        }
      }
      return parent;
    });
    const depth = (index: number): number => {
      let level = 0;
      let parent = parents[index];
      const visited = new Set([index]);
      while (parent >= 0) {
        if (visited.has(parent))
          throw new CpqFactibilidadeError(
            "A geometria possui contornos vetoriais recursivos inválidos.",
            "invalid_geometry"
          );
        visited.add(parent);
        level += 1;
        parent = parents[parent];
      }
      return level;
    };
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      if (depth(ringIndex) % 2 !== 0) continue;
      const shell = rings[ringIndex];
      const holes = rings.filter((_, index) => parents[index] === ringIndex && depth(index) % 2 === 1);
      const polygon: Polygon = [shell, ...holes];
      const polygonBounds = boundsOf(polygon);
      const externalId =
        rings.filter((_, index) => depth(index) % 2 === 0).length > 1
          ? `${id}_${pieces.length + 1}`
          : id;
      pieces.push({
        id: externalId,
        geometry: [polygon],
        bounds: polygonBounds,
        pathIndex,
        camada,
      });
      if (pieces.length > MAX_PECAS_NO_SVG)
        throw new CpqFactibilidadeError("O SVG excede o limite de 300 contornos independentes das três camadas.", "invalid_geometry");
    }
  });
  if (!pieces.length)
    throw new CpqFactibilidadeError(
      "O SVG não contém contornos fechados com área para fabricar.",
      "invalid_geometry"
    );
  return { viewBox, paths, pieces, mmPerUnitX, mmPerUnitY };
}

function canonicalBoard(chapa: CpqFactibilidadeChapa, margemBordaMm = 0) {
  const larguraMm = chapa.bobina ? chapa.larguraMm : Math.max(chapa.larguraMm, chapa.alturaMm);
  const alturaMm = chapa.bobina ? chapa.alturaMm : Math.min(chapa.larguraMm, chapa.alturaMm);
  return {
    id: chapa.id,
    nome: chapa.nome,
    larguraMm,
    alturaMm,
    larguraUtilMm: larguraMm - 2 * margemBordaMm,
    alturaUtilMm: alturaMm - 2 * margemBordaMm,
    bobina: !!chapa.bobina,
    areaMm2: chapa.larguraMm * chapa.alturaMm,
  };
}

function maiorChapa(material: CpqFactibilidadeMaterial, margemBordaMm = 0) {
  return [...material.chapas]
    .filter(
      chapa =>
        Number.isInteger(chapa.larguraMm) &&
        Number.isInteger(chapa.alturaMm) &&
        chapa.larguraMm > 0 &&
        chapa.alturaMm > 0
    )
    .map(chapa => canonicalBoard(chapa, margemBordaMm))
    .filter(board => board.larguraUtilMm > 0 && board.alturaUtilMm > 0)
    .sort(
      (a, b) =>
        b.areaMm2 - a.areaMm2 ||
        b.larguraMm - a.larguraMm ||
        a.id - b.id
    )[0];
}

/**
 * Quanto a peça precisa encolher (1 = já cabe) para caber na área útil. A peça pode girar 90° (inclusive na bobina: só o rolo
 * não gira, a peça sim, e é assim que uma peça mais alta que a largura do rolo cabe deitada), exceto no escovado, em que o
 * veio só admite 0°/180°.
 */
function melhorFatorDeEncaixe(bounds: Bounds, board: ReturnType<typeof canonicalBoard>, rotacao: RotacaoPermitida = "livre"): number {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const podeGirar = rotacao !== "veio";
  const normalFits = width <= board.larguraUtilMm && height <= board.alturaUtilMm;
  const rotatedFits = podeGirar && height <= board.larguraUtilMm && width <= board.alturaUtilMm;
  if (normalFits || rotatedFits) return 1;
  return Math.max(
    Math.min(board.larguraUtilMm / width, board.alturaUtilMm / height),
    podeGirar ? Math.min(board.larguraUtilMm / height, board.alturaUtilMm / width) : 0
  );
}

function rect(x1: number, y1: number, x2: number, y2: number): MultiPolygon {
  return [[[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]];
}

function rotateGeometry(geometry: MultiPolygon, bounds: Bounds): MultiPolygon {
  return geometry.map(polygon =>
    polygon.map(ring =>
      ring.map(([x, y]) => [y - bounds.minY, bounds.maxX - x] as Pair)
    )
  );
}

function unrotateGeometry(geometry: MultiPolygon, bounds: Bounds): MultiPolygon {
  return geometry.map(polygon =>
    polygon.map(ring =>
      ring.map(([x, y]) => [bounds.maxX - y, bounds.minY + x] as Pair)
    )
  );
}

function geometryArea(geometry: MultiPolygon): number {
  let area = 0;
  for (const polygon of geometry) {
    for (let index = 0; index < polygon.length; index += 1) {
      const ringArea = Math.abs(signedArea(polygon[index]));
      area += index === 0 ? ringArea : -ringArea;
    }
  }
  return Math.max(0, area);
}

/**
 * Área visível de cada caminho, em m², na ordem de pintura SVG (último caminho
 * por cima). As curvas usam a mesma aproximação geométrica de 0,1 mm do
 * nesting; strokes não entram na área de face.
 */
export type CpqMetricaCaminhoSvg = {
  areaM2: number;
  boundsMm: Bounds | null;
  contornosBoundsMm: Bounds[];
  camada: CpqNestingCamada | null;
};

export function calcularMetricasVisiveisSvgPorCaminho(
  svg: string,
  larguraSvgMm: number,
  alturaSvgMm: number,
): CpqMetricaCaminhoSvg[] {
  const parsed = parseSvg(svg, larguraSvgMm, alturaSvgMm);
  const geometriaPorCaminho = new Map<number, MultiPolygon>();
  const pecasPorCaminho = new Map<number, ParsedPiece[]>();
  for (const piece of parsed.pieces) {
    const pecas = pecasPorCaminho.get(piece.pathIndex) ?? [];
    pecas.push(piece);
    pecasPorCaminho.set(piece.pathIndex, pecas);
    const atual = geometriaPorCaminho.get(piece.pathIndex);
    if (!atual) {
      geometriaPorCaminho.set(piece.pathIndex, piece.geometry);
      continue;
    }
    try {
      geometriaPorCaminho.set(piece.pathIndex, polygonClipping.union(atual, piece.geometry) as MultiPolygon);
    } catch {
      throw new CpqFactibilidadeError(
        "Não foi possível calcular a área visível de um caminho SVG.",
        "boolean_failure",
      );
    }
  }

  const metricasMm = Array.from({ length: parsed.paths.length }, () => ({
    areaMm2: 0,
    boundsMm: null as Bounds | null,
    contornosBoundsMm: [] as Bounds[],
  }));
  const coberturaPorCamada = new Map<string, MultiPolygon>();
  for (let pathIndex = parsed.paths.length - 1; pathIndex >= 0; pathIndex -= 1) {
    const geometria = geometriaPorCaminho.get(pathIndex);
    if (!geometria?.length) continue;
    try {
      const chaveCamada = parsed.paths[pathIndex].camada ?? "geometria-sem-camada";
      const coberturaAnterior = coberturaPorCamada.get(chaveCamada) ?? null;
      const temCobertura = coberturaAnterior !== null && coberturaAnterior.length > 0;
      const visivel = temCobertura
        ? polygonClipping.difference(geometria, coberturaAnterior) as MultiPolygon
        : geometria;
      const contornosBoundsMm = (pecasPorCaminho.get(pathIndex) ?? []).flatMap(piece => {
        if (!visivel.length) return [];
        const parcelaVisivel = polygonClipping.intersection(piece.geometry, visivel) as MultiPolygon;
        return geometryArea(parcelaVisivel) > 0 ? [piece.bounds] : [];
      });
      metricasMm[pathIndex] = {
        areaMm2: geometryArea(visivel),
        boundsMm: visivel.length ? boundsOf(visivel.flatMap(polygon => polygon)) : null,
        contornosBoundsMm,
      };
      const coberturaAtual = temCobertura
        ? polygonClipping.union(coberturaAnterior, geometria) as MultiPolygon
        : geometria;
      coberturaPorCamada.set(chaveCamada, coberturaAtual);
    } catch {
      throw new CpqFactibilidadeError(
        "Não foi possível descontar sobreposições entre regiões de cor.",
        "boolean_failure",
      );
    }
  }
  return metricasMm.map(({ areaMm2, boundsMm, contornosBoundsMm }, pathIndex) => ({
    areaM2: Number((areaMm2 / 1_000_000).toFixed(8)),
    boundsMm,
    contornosBoundsMm,
    camada: parsed.paths[pathIndex]?.camada ?? null,
  }));
}

/** Compatibilidade para consumidores que precisam somente das áreas vetoriais. */
export function calcularAreasVisiveisSvgPorCaminho(
  svg: string,
  larguraSvgMm: number,
  alturaSvgMm: number,
): number[] {
  return calcularMetricasVisiveisSvgPorCaminho(svg, larguraSvgMm, alturaSvgMm).map(metrica => metrica.areaM2);
}

/** Material (mm) que uma linha de corte em `pos` atravessa: soma dos trechos da linha que caem dentro do desenho (par-ímpar). */
function materialNaLinhaDeCorte(geometry: MultiPolygon, eixo: "x" | "y", pos: number): number {
  const cruzamentos: number[] = [];
  for (const polygon of geometry) {
    for (const ring of polygon) {
      for (let i = 0; i < ring.length; i += 1) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[(i + 1) % ring.length];
        const au = eixo === "x" ? ax : ay, bu = eixo === "x" ? bx : by;
        if ((au <= pos && bu > pos) || (bu <= pos && au > pos)) {
          const av = eixo === "x" ? ay : ax, bv = eixo === "x" ? by : bx;
          cruzamentos.push(av + ((pos - au) / (bu - au)) * (bv - av));
        }
      }
    }
  }
  cruzamentos.sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i + 1 < cruzamentos.length; i += 2) total += cruzamentos[i + 1] - cruzamentos[i];
  return total;
}

/** A emenda pode recuar até 30% do tamanho útil da chapa para achar um ponto com menos material (vão entre letras, haste fina). */
const JANELA_MINIMA_CORTE = 0.7;
const PASSOS_BUSCA_CORTE = 160;

/**
 * Posições das linhas de emenda ao longo de um eixo (coordenadas locais, 0..comprimento). Cada trecho cabe no tamanho útil
 * da chapa e a linha vai para o ponto de MENOR material dentro da janela [70%, 100%] do trecho; empate vale a posição mais
 * distante (menos emendas). Em desenho uniforme (um retângulo) isto reproduz o corte em intervalos iguais.
 */
function limitesDeCorte(geometry: MultiPolygon, eixo: "x" | "y", comprimento: number, usavel: number): number[] {
  const limites = [0];
  let inicio = 0;
  while (comprimento - inicio > usavel + 1e-7) {
    const alvo = inicio + usavel;
    const minimo = inicio + usavel * JANELA_MINIMA_CORTE;
    let melhor = alvo;
    let melhorValor = Infinity;
    for (let i = 0; i <= PASSOS_BUSCA_CORTE; i += 1) {
      const pos = minimo + ((alvo - minimo) * i) / PASSOS_BUSCA_CORTE;
      const valor = materialNaLinhaDeCorte(geometry, eixo, pos);
      if (valor < melhorValor - 1e-6 || (Math.abs(valor - melhorValor) <= 1e-6 && pos > melhor)) {
        melhorValor = valor;
        melhor = pos;
      }
    }
    limites.push(melhor);
    inicio = melhor;
  }
  limites.push(comprimento);
  return limites;
}

function translateGeometry(geometry: MultiPolygon, dx: number, dy: number): MultiPolygon {
  return geometry.map(polygon => polygon.map(ring => ring.map(([x, y]) => [x + dx, y + dy] as Pair)));
}

function clipToSheets(
  piece: ParsedPiece,
  board: ReturnType<typeof canonicalBoard>,
  material: CpqFactibilidadeMaterial
): { fragments: OutputFragment[]; lines: CpqLinhaCorte[] } {
  const usableWidth = board.larguraUtilMm - 2 * MARGEM_CORTE_MM;
  const usableHeight = board.alturaUtilMm - 2 * MARGEM_CORTE_MM;
  if (usableWidth <= 0 || usableHeight <= 0)
    throw new CpqFactibilidadeError(
      `A chapa ${board.nome} é menor que a margem técnica de 20 mm por borda.`,
      "missing_board"
    );
  const width = piece.bounds.maxX - piece.bounds.minX;
  const height = piece.bounds.maxY - piece.bounds.minY;
  const plan = (w: number, h: number) => ({
    cols: Math.max(1, Math.ceil((w - 1e-7) / usableWidth)),
    rows: Math.max(1, Math.ceil((h - 1e-7) / usableHeight)),
  });
  const normalPlan = plan(width, height);
  const rotatedPlan = plan(height, width);
  const useRotation = material.rotacao !== "veio" && rotatedPlan.cols * rotatedPlan.rows < normalPlan.cols * normalPlan.rows;
  // Coordenadas locais da peça (0..largura, 0..altura), girada ou não: os cortes são sempre medidos a partir do canto da peça.
  const oriented = useRotation
    ? rotateGeometry(piece.geometry, piece.bounds)
    : translateGeometry(piece.geometry, -piece.bounds.minX, -piece.bounds.minY);
  const orientedWidth = useRotation ? height : width;
  const orientedHeight = useRotation ? width : height;
  const colLimites = limitesDeCorte(oriented, "x", orientedWidth, usableWidth);
  const rowLimites = limitesDeCorte(oriented, "y", orientedHeight, usableHeight);
  const fragments: OutputFragment[] = [];
  let fragmentNumber = 0;
  try {
    for (let row = 0; row + 1 < rowLimites.length; row += 1) {
      const y1 = rowLimites[row];
      const y2 = rowLimites[row + 1];
      for (let col = 0; col + 1 < colLimites.length; col += 1) {
        const x1 = colLimites[col];
        const x2 = colLimites[col + 1];
        const clipped = polygonClipping.intersection(
          oriented,
          rect(x1, y1, x2, y2)
        );
        for (const polygon of clipped) {
          if (geometryArea([polygon]) < AREA_MINIMA_FRAGMENTO_MM2) continue;
          const geometry: MultiPolygon = useRotation
            ? unrotateGeometry([polygon], piece.bounds)
            : translateGeometry([polygon], piece.bounds.minX, piece.bounds.minY);
          const bounds = boundsOf(geometry.flat());
          fragments.push({
            id: `${piece.id}_parte_${++fragmentNumber}`,
            pecaId: piece.id,
            geometry,
            bounds,
          });
        }
      }
    }
  } catch (error) {
    if (error instanceof CpqFactibilidadeError) throw error;
    throw new CpqFactibilidadeError(
      `Falha booleana ao dividir a peça ${piece.id}. Revise a geometria antes de fabricar.`,
      "boolean_failure"
    );
  }
  if (fragments.length < 2)
    throw new CpqFactibilidadeError(
      `O corte não gerou duas ou mais partes válidas para ${piece.id}.`,
      "boolean_failure"
    );

  const lines: CpqLinhaCorte[] = [];
  const linha = (x1: number, y1: number, x2: number, y2: number, materialCortadoMm: number): CpqLinhaCorte => ({
    x1, y1, x2, y2, materiaPrimaId: material.id, materiaPrima: material.nome, pecaId: piece.id,
    materialCortadoMm: Number(materialCortadoMm.toFixed(2)),
  });
  if (!useRotation) {
    for (const x of colLimites.slice(1, -1))
      lines.push(linha(piece.bounds.minX + x, piece.bounds.minY, piece.bounds.minX + x, piece.bounds.maxY, materialNaLinhaDeCorte(oriented, "x", x)));
    for (const y of rowLimites.slice(1, -1))
      lines.push(linha(piece.bounds.minX, piece.bounds.minY + y, piece.bounds.maxX, piece.bounds.minY + y, materialNaLinhaDeCorte(oriented, "y", y)));
  } else {
    for (const c of colLimites.slice(1, -1))
      lines.push(linha(piece.bounds.minX, piece.bounds.minY + c, piece.bounds.maxX, piece.bounds.minY + c, materialNaLinhaDeCorte(oriented, "x", c)));
    for (const r of rowLimites.slice(1, -1))
      lines.push(linha(piece.bounds.maxX - r, piece.bounds.minY, piece.bounds.maxX - r, piece.bounds.maxY, materialNaLinhaDeCorte(oriented, "y", r)));
  }
  return { fragments, lines };
}

function formatNum(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function pathD(geometry: MultiPolygon, parsed: ParsedSvg): string {
  const commands: string[] = [];
  for (const polygon of geometry) {
    for (const ring of polygon) {
      if (ring.length < 4) continue;
      const asViewBox = ring.map(([x, y]) => [
        x / parsed.mmPerUnitX + parsed.viewBox.x,
        y / parsed.mmPerUnitY + parsed.viewBox.y,
      ] as Pair);
      commands.push(
        `M ${formatNum(asViewBox[0][0])} ${formatNum(asViewBox[0][1])} ` +
          asViewBox
            .slice(1, -1)
            .map(point => `L ${formatNum(point[0])} ${formatNum(point[1])}`)
            .join(" ") +
          " Z"
      );
    }
  }
  return commands.join(" ");
}

function fragmentSvg(fragment: OutputFragment): CpqPecaParaNesting {
  const larguraMm = fragment.bounds.maxX - fragment.bounds.minX;
  const alturaMm = fragment.bounds.maxY - fragment.bounds.minY;
  const commands = fragment.geometry.flatMap(polygon => polygon).map(ring => {
    if (ring.length < 4) return "";
    const points = ring.map(([x, y]) => [x - fragment.bounds.minX, y - fragment.bounds.minY] as Pair);
    return `M ${formatNum(points[0][0])} ${formatNum(points[0][1])} ` +
      points.slice(1, -1).map(point => `L ${formatNum(point[0])} ${formatNum(point[1])}`).join(" ") + " Z";
  }).filter(Boolean).join(" ");
  const svg = svgRoot(
    { x: 0, y: 0, width: larguraMm, height: alturaMm },
    larguraMm,
    alturaMm,
    `<path id="${attrEscape(fragment.id)}" d="${commands}" fill="#000000" fill-rule="evenodd"/>`
  );
  return { id: fragment.id, svg, larguraMm, alturaMm };
}

function nestingPieces(fragments: OutputFragment[], materialName: string): CpqPecaParaNesting[] {
  if (fragments.length > MAX_PECAS_POR_MATERIAL)
    throw new CpqFactibilidadeError(`O fatiamento de ${materialName} gerou mais de 100 peças para o Deepnest.`, "invalid_geometry");
  const pieces = fragments.map(fragment => fragmentSvg(fragment));
  if (pieces.reduce((sum, piece) => sum + piece.svg.length, 0) > 1_500_000)
    throw new CpqFactibilidadeError(`Os SVGs de corte de ${materialName} excedem 1,5 MB para o Deepnest.`, "invalid_geometry");
  return pieces;
}

export function calcularHashPecasParaNesting(pecas: CpqPecaParaNesting[]): string {
  return sha256(JSON.stringify(pecas.map(peca => ({
    id: peca.id,
    larguraMm: peca.larguraMm,
    alturaMm: peca.alturaMm,
    hashSvg: sha256(peca.svg),
  }))));
}

function scaleGeometry(geometry: MultiPolygon, factor: number): MultiPolygon {
  return geometry.map(polygon => polygon.map(ring => ring.map(([x, y]) => [x * factor, y * factor])));
}

function xmlLength(value: number): string {
  return `${formatNum(value)}mm`;
}

function svgRoot(
  viewBox: ViewBox,
  widthMm: number,
  heightMm: number,
  content: string
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ` +
    `width="${xmlLength(widthMm)}" height="${xmlLength(heightMm)}" ` +
    `viewBox="${formatNum(viewBox.x)} ${formatNum(viewBox.y)} ${formatNum(viewBox.width)} ${formatNum(viewBox.height)}">` +
    content +
    "</svg>"
  );
}

function outputSvg(
  parsed: ParsedSvg,
  widthMm: number,
  heightMm: number,
  fragments: OutputFragment[],
  cutLines: CpqLinhaCorte[],
  withCutLayer: boolean
): string {
  const paths = fragments
    .map(
      fragment =>
        `<path id="${attrEscape(fragment.id)}" data-peca-origem="${attrEscape(fragment.pecaId)}" ` +
        `d="${pathD(fragment.geometry, parsed)}" fill="#000000" fill-rule="evenodd"/>`
    )
    .join("");
  const layer = withCutLayer
    ? `<g id="linha_emenda_tecnica" inkscape:groupmode="layer" inkscape:label="linha_emenda_tecnica" ` +
      `data-layer-name="linha_emenda_tecnica" fill="none" stroke="#f43f5e" stroke-width="1.5" ` +
      `stroke-dasharray="12 8" vector-effect="non-scaling-stroke">${cutLines
        .map(line => {
          const x1 = line.x1 / parsed.mmPerUnitX + parsed.viewBox.x;
          const y1 = line.y1 / parsed.mmPerUnitY + parsed.viewBox.y;
          const x2 = line.x2 / parsed.mmPerUnitX + parsed.viewBox.x;
          const y2 = line.y2 / parsed.mmPerUnitY + parsed.viewBox.y;
          return `<path data-peca="${attrEscape(line.pecaId)}" d="M ${formatNum(x1)} ${formatNum(y1)} L ${formatNum(x2)} ${formatNum(y2)}"/>`;
        })
        .join("")}</g>`
    : "";
  return svgRoot(
    parsed.viewBox,
    widthMm,
    heightMm,
    `<g id="pecas_de_corte" fill="#000000" fill-rule="evenodd">${paths}</g>${layer}`
  );
}

function updateSvgPhysicalSize(svg: string, widthMm: number, heightMm: number): string {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return svg;
  const nextRoot = root
    .replace(/\s(width|height)\s*=\s*(["']).*?\2/gi, "")
    .replace(/\s*\/?\s*>$/, ` width="${xmlLength(widthMm)}" height="${xmlLength(heightMm)}">`);
  return svg.replace(root, nextRoot);
}

/** O SVG não tem camada Fundo, mas tem Face: o fundo é derivado da silhueta da face. */
function fundoSegueSilhuetaDaFace(parsed: ParsedSvg): boolean {
  return !parsed.pieces.some(piece => piece.camada === "fundo") && parsed.pieces.some(piece => piece.camada === "face");
}

function pecasDaMateriaPrima(parsed: ParsedSvg, material: CpqFactibilidadeMaterial): ParsedPiece[] {
  if (!material.lotes?.length) return parsed.pieces.map(piece => ({ ...piece, id: idPecaNesting(piece) }));
  const selecionadas = new Map<string, ParsedPiece>();
  for (const lote of material.lotes) {
    const indexes = lote.pathIndexes == null ? null : new Set(lote.pathIndexes);
    for (const pathIndex of indexes ?? []) {
      if (parsed.paths[pathIndex]?.camada !== lote.camada) {
        throw new CpqFactibilidadeError(
          `O caminho ${pathIndex + 1} não pertence à camada ${lote.camada} do material ${material.nome}.`,
          "invalid_geometry"
        );
      }
    }
    for (const piece of parsed.pieces) {
      if (piece.camada !== lote.camada || (indexes && !indexes.has(piece.pathIndex))) continue;
      selecionadas.set(`${piece.pathIndex}:${piece.id}`, piece);
    }
    if (lote.camada === "fundo" && fundoSegueSilhuetaDaFace(parsed)) {
      // SVG vetorizado a partir de imagem só tem a camada Face: a placa do fundo segue a mesma silhueta (com os vazados).
      for (const piece of parsed.pieces) {
        if (piece.camada === "face") selecionadas.set(`fundo:${piece.pathIndex}:${piece.id}`, { ...piece, camada: "fundo" });
      }
    }
  }
  const pieces = [...selecionadas.values()];
  if (!pieces.length) {
    const camadas = [...new Set(material.lotes.map(lote => lote.camada))].join(", ");
    throw new CpqFactibilidadeError(
      `Não há contornos fechados nas camadas ${camadas} para o material ${material.nome}. Revise os nomes das camadas e a composição.`,
      "invalid_geometry"
    );
  }
  return pieces.map(piece => ({ ...piece, id: idPecaNesting(piece) }));
}

function idPecaNesting(piece: ParsedPiece): string {
  return `${piece.camada ?? "contorno"}-${piece.pathIndex + 1}-${sha256(piece.id).slice(0, 10)}`;
}

function allOriginalPieces(parsed: ParsedSvg, pieces: ParsedPiece[] = parsed.pieces): OutputFragment[] {
  return pieces.map(piece => ({
    id: piece.id,
    pecaId: piece.id,
    geometry: piece.geometry,
    bounds: piece.bounds,
  }));
}

function noCutMaterial(
  material: CpqFactibilidadeMaterial,
  board: ReturnType<typeof canonicalBoard>,
  svg: string,
  fragments: OutputFragment[]
): CpqFactibilidadeMaterialResult {
  const pecasParaNesting = nestingPieces(fragments, material.nome);
  return {
    id_materia_prima: material.id,
    materia_prima: material.nome,
    id_maior_chapa: board.id,
    nome_maior_chapa: board.nome,
    largura_chapa_mm: board.larguraMm,
    altura_chapa_mm: board.alturaMm,
    svg_para_nesting: svg,
    svg_visualizacao: svg,
    hash_svg_para_nesting: sha256(svg),
    hash_pecas_para_nesting: calcularHashPecasParaNesting(pecasParaNesting),
    hash_pecas_redimensionadas_opcao: null,
    fragmentos: fragments.map(fragment => ({
      id: fragment.id,
      pecaId: fragment.pecaId,
      larguraMm: fragment.bounds.maxX - fragment.bounds.minX,
      alturaMm: fragment.bounds.maxY - fragment.bounds.minY,
    })),
    pecas_para_nesting: pecasParaNesting,
  };
}

/**
 * Confere cada contorno contra a maior chapa de cada material. Redimensiona o
 * SVG completo somente quando todos os excessos ficam dentro de 3%; caso
 * contrário, recorta cada contorno por interseção booleana em painéis seguros.
 */
export function calcularFactibilidadeFabricacao(input: {
  svg: string;
  larguraSvgMm: number;
  alturaSvgMm: number;
  materiais: CpqFactibilidadeMaterial[];
  margemBordaMm?: number;
}): CpqFactibilidadeResult {
  const margemBordaMm = input.margemBordaMm ?? 0;
  if (!Number.isFinite(margemBordaMm) || margemBordaMm < 0 || margemBordaMm > 50)
    throw new CpqFactibilidadeError("A margem da borda precisa ficar entre 0 e 50 mm.", "invalid_geometry");
  if (
    !Number.isFinite(input.larguraSvgMm) ||
    !Number.isFinite(input.alturaSvgMm) ||
    input.larguraSvgMm <= 0 ||
    input.alturaSvgMm <= 0 ||
    input.larguraSvgMm > 50_000 ||
    input.alturaSvgMm > 50_000
  ) {
    throw new CpqFactibilidadeError(
      "As dimensões físicas do projeto precisam ser válidas em milímetros.",
      "invalid_geometry"
    );
  }
  if (!input.materiais.length)
    throw new CpqFactibilidadeError(
      "Selecione ao menos um material de chapa com formatos cadastrados.",
      "missing_board"
    );
  const parsed = parseSvg(input.svg, input.larguraSvgMm, input.alturaSvgMm);
  const boards = new Map<number, ReturnType<typeof canonicalBoard>>();
  const pecasPorMaterial = new Map<number, ParsedPiece[]>();
  const avisosDeFundo: string[] = [];
  for (const material of input.materiais) {
    const margemMaterialMm = material.margemBordaMm ?? margemBordaMm;
    if (!Number.isFinite(margemMaterialMm) || margemMaterialMm < 0 || margemMaterialMm > 50)
      throw new CpqFactibilidadeError(`A margem de borda de ${material.nome} precisa ficar entre 0 e 50 mm.`, "invalid_geometry");
    const board = maiorChapa(material, margemMaterialMm);
    if (!board)
      throw new CpqFactibilidadeError(
        `Não há chapa ativa cadastrada para ${material.nome} (${material.id}).`,
        "missing_board"
      );
    boards.set(material.id, board);
    pecasPorMaterial.set(material.id, pecasDaMateriaPrima(parsed, material));
    if (material.lotes?.some(lote => lote.camada === "fundo") && fundoSegueSilhuetaDaFace(parsed))
      avisosDeFundo.push(`O fundo de ${material.nome} usa a mesma silhueta da face (o SVG não tem camada Fundo).`);
  }

  let fatorEscalaNecessario = 1;
  const needsByMaterial = new Map<number, Map<string, number>>();
  for (const material of input.materiais) {
    const board = boards.get(material.id)!;
    const pieceFits = new Map<string, number>();
    for (const piece of pecasPorMaterial.get(material.id)!) {
      const fitScale = melhorFatorDeEncaixe(piece.bounds, board, material.rotacao);
      pieceFits.set(piece.id, fitScale);
      fatorEscalaNecessario = Math.min(fatorEscalaNecessario, fitScale);
    }
    needsByMaterial.set(material.id, pieceFits);
  }

  const fatorEscala = Math.max(0, Math.min(1, fatorEscalaNecessario));
  const redimensionarAutomatico = fatorEscala < 1 && fatorEscala >= ESCALA_MINIMA_AUTOMATICA;
  if (fatorEscala < 1 && redimensionarAutomatico) {
    const larguraFinal = input.larguraSvgMm * fatorEscala;
    const alturaFinal = input.alturaSvgMm * fatorEscala;
    const svgAjustado = updateSvgPhysicalSize(input.svg, larguraFinal, alturaFinal);
    const materiais = input.materiais.map(material => {
      const fragments = allOriginalPieces(parsed, pecasPorMaterial.get(material.id)!);
      return noCutMaterial(
        material,
        boards.get(material.id)!,
        svgAjustado,
        fragments.map(fragment => ({
          ...fragment,
          geometry: scaleGeometry(fragment.geometry, fatorEscala),
          bounds: {
            minX: fragment.bounds.minX * fatorEscala,
            maxX: fragment.bounds.maxX * fatorEscala,
            minY: fragment.bounds.minY * fatorEscala,
            maxY: fragment.bounds.maxY * fatorEscala,
          },
        }))
      );
    });
    return {
      status_factibilidade: "APTO_NESTING",
      projeto_fatiado: false,
      projeto_redimensionado: true,
      fator_escala_aplicado: fatorEscala,
      fator_escala_minimo_para_caber: fatorEscala,
      largura_projeto_mm: larguraFinal,
      altura_projeto_mm: alturaFinal,
      svg_ajustado: svgAjustado,
      svg_redimensionado_opcao: null,
      hash_svg_redimensionado_opcao: null,
      detalhes_corte: { pecas_afetadas: [], quantidade_emendas: 0, coordenadas_linha_corte: [] },
      opcoes_disponiveis: [],
      materiais,
      avisos: [
        ...avisosDeFundo,
        `Projeto reduzido proporcionalmente em ${((1 - fatorEscala) * 100).toFixed(2)}% para caber nas chapas.`,
      ],
    };
  }

  if (fatorEscala >= 1) {
    const materiais = input.materiais.map(material =>
      noCutMaterial(material, boards.get(material.id)!, input.svg, allOriginalPieces(parsed, pecasPorMaterial.get(material.id)!))
    );
    return {
      status_factibilidade: "APTO_NESTING",
      projeto_fatiado: false,
      projeto_redimensionado: false,
      fator_escala_aplicado: 1,
      fator_escala_minimo_para_caber: 1,
      largura_projeto_mm: input.larguraSvgMm,
      altura_projeto_mm: input.alturaSvgMm,
      svg_ajustado: null,
      svg_redimensionado_opcao: null,
      hash_svg_redimensionado_opcao: null,
      detalhes_corte: { pecas_afetadas: [], quantidade_emendas: 0, coordenadas_linha_corte: [] },
      opcoes_disponiveis: [],
      materiais,
      avisos: [...avisosDeFundo],
    };
  }

  const redimensionarFragmentos = (pieces: ParsedPiece[]) => allOriginalPieces(parsed, pieces).map(fragment => ({
      ...fragment,
      geometry: scaleGeometry(fragment.geometry, fatorEscala),
      bounds: {
        minX: fragment.bounds.minX * fatorEscala,
        maxX: fragment.bounds.maxX * fatorEscala,
        minY: fragment.bounds.minY * fatorEscala,
        maxY: fragment.bounds.maxY * fatorEscala,
      },
    }));
  const lines: CpqLinhaCorte[] = [];
  const affected = new Set<string>();
  const materialResults: CpqFactibilidadeMaterialResult[] = [];
  for (const material of input.materiais) {
    const board = boards.get(material.id)!;
    const fragments: OutputFragment[] = [];
    const materialLines: CpqLinhaCorte[] = [];
    for (const piece of pecasPorMaterial.get(material.id)!) {
      const requiredScale = needsByMaterial.get(material.id)!.get(piece.id) ?? 1;
      if (requiredScale >= 1) {
        fragments.push({
          id: piece.id,
          pecaId: piece.id,
          geometry: piece.geometry,
          bounds: piece.bounds,
        });
        continue;
      }
      const cut = clipToSheets(piece, board, material);
      fragments.push(...cut.fragments);
      materialLines.push(...cut.lines);
      affected.add(piece.id);
    }
    lines.push(...materialLines);
    if (lines.length > MAX_LINHAS_DE_CORTE)
      throw new CpqFactibilidadeError("O projeto excede o limite de 2.000 linhas de emenda para revisão CNC.", "invalid_geometry");
    if (fragments.length > MAX_PECAS_POR_MATERIAL)
      throw new CpqFactibilidadeError(`O fatiamento de ${material.nome} gerou mais de 100 peças para o Deepnest.`, "invalid_geometry");
    const svgParaNesting = outputSvg(
      parsed,
      input.larguraSvgMm,
      input.alturaSvgMm,
      fragments,
      [],
      false
    );
    const svgVisualizacao = outputSvg(
      parsed,
      input.larguraSvgMm,
      input.alturaSvgMm,
      fragments,
      materialLines,
      true
    );
    const pecasParaNesting = nestingPieces(fragments, material.nome);
    const pecasRedimensionadas = nestingPieces(redimensionarFragmentos(pecasPorMaterial.get(material.id)!), material.nome);
    materialResults.push({
      id_materia_prima: material.id,
      materia_prima: material.nome,
      id_maior_chapa: board.id,
      nome_maior_chapa: board.nome,
      largura_chapa_mm: board.larguraMm,
      altura_chapa_mm: board.alturaMm,
      svg_para_nesting: svgParaNesting,
      svg_visualizacao: svgVisualizacao,
      hash_svg_para_nesting: sha256(svgParaNesting),
      hash_pecas_para_nesting: calcularHashPecasParaNesting(pecasParaNesting),
      hash_pecas_redimensionadas_opcao: calcularHashPecasParaNesting(pecasRedimensionadas),
      fragmentos: fragments.map(fragment => ({
        id: fragment.id,
        pecaId: fragment.pecaId,
        larguraMm: fragment.bounds.maxX - fragment.bounds.minX,
        alturaMm: fragment.bounds.maxY - fragment.bounds.minY,
      })),
      pecas_para_nesting: pecasParaNesting,
      pecas_redimensionadas_opcao: pecasRedimensionadas,
    });
  }
  if (!lines.length)
    throw new CpqFactibilidadeError(
      "O projeto excede a faixa automática, mas o fatiamento não gerou linhas de emenda.",
      "boolean_failure"
    );
  const svgRedimensionadoOpcao = updateSvgPhysicalSize(
    input.svg,
    input.larguraSvgMm * fatorEscala,
    input.alturaSvgMm * fatorEscala
  );
  const uniqueSeams = new Set(
    lines.map(line =>
      [line.pecaId, line.x1, line.y1, line.x2, line.y2]
        .map(value => typeof value === "number" ? value.toFixed(3) : value)
        .join(":")
    )
  );
  return {
    status_factibilidade: "REQUER_APROVACAO_EMENDA",
    projeto_fatiado: true,
    projeto_redimensionado: false,
    fator_escala_aplicado: 1,
    fator_escala_minimo_para_caber: fatorEscala,
    largura_projeto_mm: input.larguraSvgMm,
    altura_projeto_mm: input.alturaSvgMm,
    svg_ajustado: null,
    svg_redimensionado_opcao: svgRedimensionadoOpcao,
    hash_svg_redimensionado_opcao: sha256(svgRedimensionadoOpcao),
    detalhes_corte: {
      pecas_afetadas: [...affected],
      quantidade_emendas: uniqueSeams.size,
      coordenadas_linha_corte: lines.map(line => ({
        ...line,
        x1: Number(line.x1.toFixed(3)),
        y1: Number(line.y1.toFixed(3)),
        x2: Number(line.x2.toFixed(3)),
        y2: Number(line.y2.toFixed(3)),
      })),
    },
    opcoes_disponiveis: OPCOES_FACTIBILIDADE,
    materiais: materialResults,
    avisos: [
      ...avisosDeFundo,
      ...(lines.length ? ["As linhas de emenda foram sugeridas nos pontos de menor material perto do limite de cada chapa (vãos entre letras, hastes finas); confira a prévia e aprove antes do corte."] : []),
      `Cada fragmento deixa margem de segurança de ${MARGEM_CORTE_MM} mm em cada borda da chapa.`,
      "Curvas SVG são aproximadas por segmentos com tolerância física de 0,1 mm antes das operações booleanas.",
    ],
  };
}

export function validarAcaoFactibilidade(value: unknown): value is CpqFactibilidadeAcao {
  return OPCOES_FACTIBILIDADE.some(option => option.acao === value);
}

export type CpqFactibilidadeResumoAssinavel = Pick<
  CpqFactibilidadeResult,
  | "status_factibilidade"
  | "projeto_fatiado"
  | "projeto_redimensionado"
  | "fator_escala_aplicado"
  | "fator_escala_minimo_para_caber"
  | "hash_svg_redimensionado_opcao"
  | "largura_projeto_mm"
  | "altura_projeto_mm"
  | "detalhes_corte"
> & {
  materiais: Array<Pick<
    CpqFactibilidadeMaterialResult,
    "id_materia_prima" | "id_maior_chapa" | "hash_svg_para_nesting" |
    "hash_pecas_para_nesting" | "hash_pecas_redimensionadas_opcao"
  >>;
};

export function calcularHashFactibilidade(
  sourceId: string,
  resumo: CpqFactibilidadeResumoAssinavel
): string {
  const base = {
    sourceId,
    status_factibilidade: resumo.status_factibilidade,
    projeto_fatiado: resumo.projeto_fatiado,
    projeto_redimensionado: resumo.projeto_redimensionado,
    fator_escala_aplicado: Number(resumo.fator_escala_aplicado.toFixed(8)),
    fator_escala_minimo_para_caber: Number(resumo.fator_escala_minimo_para_caber.toFixed(8)),
    hash_svg_redimensionado_opcao: resumo.hash_svg_redimensionado_opcao,
    largura_projeto_mm: Number(resumo.largura_projeto_mm.toFixed(4)),
    altura_projeto_mm: Number(resumo.altura_projeto_mm.toFixed(4)),
    detalhes_corte: resumo.detalhes_corte,
    materiais: [...resumo.materiais]
      .map(material => ({
        id_materia_prima: material.id_materia_prima,
        id_maior_chapa: material.id_maior_chapa,
        hash_svg_para_nesting: material.hash_svg_para_nesting,
        hash_pecas_para_nesting: material.hash_pecas_para_nesting,
        hash_pecas_redimensionadas_opcao: material.hash_pecas_redimensionadas_opcao,
      }))
      .sort((a, b) => a.id_materia_prima - b.id_materia_prima),
  };
  return sha256(JSON.stringify(base));
}

export type CpqFactibilidadeAtor = { id: string; nome: string; role: string };
export type CpqFactibilidadeDecisionClaims = {
  sourceId: string;
  resultadoHash: string;
  acao: Exclude<CpqFactibilidadeAcao, "SOLICITAR_ANALISE_HUMANA">;
  aprovadoPor: CpqFactibilidadeAtor;
  aprovadoEm: string;
  fatorEscalaAprovada?: number;
};

/** Contornos físicos (mm) de um SVG de peça: cada polígono é [casca, ...furos]. Usado pelo motor de nesting interno. */
export function contornosFisicosDoSvg(
  svg: string,
  larguraMm: number,
  alturaMm: number,
): Array<Array<Array<[number, number]>>> {
  return parseSvg(svg, larguraMm, alturaMm).pieces.flatMap(piece => piece.geometry);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new CpqFactibilidadeError(
      "JWT_SECRET precisa ter pelo menos 32 caracteres para assinar as decisões de factibilidade.",
      "configuration"
    );
  return value;
}

function assinarClaims(claims: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function lerClaims<T extends { kind: string; exp: number }>(ticket: string): T {
  const [encoded, suppliedSignature, extra] = ticket.split(".");
  if (!encoded || !suppliedSignature || extra)
    throw new CpqFactibilidadeError("O recibo de factibilidade é inválido.", "invalid_geometry");
  const expectedSignature = createHmac("sha256", secret()).update(encoded).digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    throw new CpqFactibilidadeError("O recibo de factibilidade é inválido.", "invalid_geometry");
  }
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new CpqFactibilidadeError("O recibo de factibilidade não corresponde à assinatura do servidor.", "invalid_geometry");
  }
  let parsed: T;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    throw new CpqFactibilidadeError("O recibo de factibilidade é inválido.", "invalid_geometry");
  }
  if (parsed.exp <= Date.now())
    throw new CpqFactibilidadeError("O recibo de factibilidade expirou. Recalcule a factibilidade.", "invalid_geometry");
  return parsed;
}

export function emitirTicketAnaliseFactibilidade(input: {
  sourceId: string;
  resultadoHash: string;
  hashSvgEntrada: string;
  detalhesCorteHash: string;
  statusFactibilidade: CpqFactibilidadeResult["status_factibilidade"];
  fatorEscalaAplicado: number;
  fatorEscalaMinimoParaCaber: number;
  hashSvgRedimensionadoOpcao: string | null;
  margemBordaMm?: number;
  materiais: Array<{
    idMateriaPrima: number;
    idChapa: number;
    hashFormatos?: string;
    hashSvgParaNesting: string;
    hashPecasParaNesting: string;
    hashPecasRedimensionadasOpcao: string | null;
  }>;
  validadeMs?: number;
}): string {
  return assinarClaims({
    kind: "analysis",
    sourceId: input.sourceId,
    resultadoHash: input.resultadoHash,
    hashSvgEntrada: input.hashSvgEntrada,
    detalhesCorteHash: input.detalhesCorteHash,
    statusFactibilidade: input.statusFactibilidade,
    fatorEscalaAplicado: input.fatorEscalaAplicado,
    fatorEscalaMinimoParaCaber: input.fatorEscalaMinimoParaCaber,
    hashSvgRedimensionadoOpcao: input.hashSvgRedimensionadoOpcao,
    margemBordaMm: input.margemBordaMm,
    materiais: input.materiais,
    exp: Date.now() + (input.validadeMs ?? 7 * 24 * 60 * 60 * 1000),
  });
}

export function verificarTicketAnaliseFactibilidade(
  ticket: string,
  sourceId: string,
  resultadoHash: string
): {
  statusFactibilidade: CpqFactibilidadeResult["status_factibilidade"];
  hashSvgEntrada: string;
  detalhesCorteHash: string;
  fatorEscalaAplicado: number;
  fatorEscalaMinimoParaCaber: number;
  hashSvgRedimensionadoOpcao: string | null;
  margemBordaMm?: number;
  materiais: Array<{
    idMateriaPrima: number;
    idChapa: number;
    hashFormatos?: string;
    hashSvgParaNesting: string;
    hashPecasParaNesting: string;
    hashPecasRedimensionadasOpcao: string | null;
  }>;
} {
  const claims = lerClaims<{
    kind: string;
    sourceId: string;
    resultadoHash: string;
    statusFactibilidade: CpqFactibilidadeResult["status_factibilidade"];
    hashSvgEntrada: string;
    detalhesCorteHash: string;
    fatorEscalaAplicado: number;
    fatorEscalaMinimoParaCaber: number;
    hashSvgRedimensionadoOpcao: string | null;
    margemBordaMm?: number;
    materiais: Array<{
      idMateriaPrima: number;
      idChapa: number;
      hashFormatos?: string;
      hashSvgParaNesting: string;
      hashPecasParaNesting: string;
      hashPecasRedimensionadasOpcao: string | null;
    }>;
    exp: number;
  }>(ticket);
  if (claims.kind !== "analysis" || claims.sourceId !== sourceId || claims.resultadoHash !== resultadoHash)
    throw new CpqFactibilidadeError("O ticket não pertence a esta análise de factibilidade.", "invalid_geometry");
  return {
    statusFactibilidade: claims.statusFactibilidade,
    hashSvgEntrada: claims.hashSvgEntrada,
    detalhesCorteHash: claims.detalhesCorteHash,
    fatorEscalaAplicado: claims.fatorEscalaAplicado,
    fatorEscalaMinimoParaCaber: claims.fatorEscalaMinimoParaCaber,
    hashSvgRedimensionadoOpcao: claims.hashSvgRedimensionadoOpcao,
    margemBordaMm: claims.margemBordaMm,
    materiais: claims.materiais,
  };
}

export function emitirReciboDecisaoFactibilidade(
  input: CpqFactibilidadeDecisionClaims & { validadeMs?: number }
): string {
  return assinarClaims({
    kind: "decision",
    sourceId: input.sourceId,
    resultadoHash: input.resultadoHash,
    acao: input.acao,
    aprovadoPor: input.aprovadoPor,
    aprovadoEm: input.aprovadoEm,
    fatorEscalaAprovada: input.fatorEscalaAprovada,
    exp: Date.now() + (input.validadeMs ?? 7 * 24 * 60 * 60 * 1000),
  });
}

export function verificarReciboDecisaoFactibilidade(
  ticket: string,
  sourceId: string,
  resultadoHash: string,
  acao: string
): CpqFactibilidadeDecisionClaims {
  const claims = lerClaims<CpqFactibilidadeDecisionClaims & { kind: string; exp: number }>(ticket);
  if (
    claims.kind !== "decision" ||
    claims.sourceId !== sourceId ||
    claims.resultadoHash !== resultadoHash ||
    claims.acao !== acao
  ) {
    throw new CpqFactibilidadeError("A decisão não corresponde ao resultado calculado.", "invalid_geometry");
  }
  return claims;
}
