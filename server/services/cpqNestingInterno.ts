import { contornosFisicosDoSvg, CpqFactibilidadeError } from "./cpqFactibilidadeFabricacao";
import { empacotarPorContorno, TempoEsgotadoRaster } from "./cpqNestingRaster";
import { angulosPermitidos, type RotacaoPermitida } from "../../shared/politica-corte";

/**
 * Motor de nesting interno (sem addon nativo). Roda dois empacotadores e fica com o melhor:
 *  1. caixas delimitadoras girando de 5 em 5° (MaxRects) — rápido, não aproveita vazios;
 *  2. contorno real (`cpqNestingRaster`): máscara de células conservadora, peça por peça em vários ângulos, na posição
 *     mais à esquerda e mais abaixo, avançando pelo comprimento da chapa; peças pequenas entram nos vazados das grandes.
 * Roda em qualquer servidor, inclusive serverless. O espaçamento é conservador (até 1 célula a mais por borda); por isso
 * o consumo é uma estimativa igual ou maior que a do Deepnest e o resultado vai marcado como `motor: "interno"`.
 */

type Par = [number, number];
type Anel = Par[];

export type PecaMotorInterno = { id: string; svg: string; larguraMm: number; alturaMm: number };

export type ResultadoMotorInterno = {
  completo: boolean;
  quantidadePecas: number;
  quantidadePosicionada: number;
  areaLiquidaMm2: number;
  perimetroTotalMm: number;
  placements: Array<{
    id: number;
    source: number;
    xMm: number;
    yMm: number;
    larguraMm: number;
    alturaMm: number;
    rotacaoGraus: number;
  }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
};

export class GeometriaInvalidaMotorInterno extends Error {}

const PASSO_GRAUS = 5;
// A caixa girada a θ+180° é igual à de θ: 0°–175° cobre todas as caixas possíveis.
const ANGULOS = Array.from({ length: 180 / PASSO_GRAUS }, (_, i) => i * PASSO_GRAUS);
const EPS = 1e-9;
/** Tempo máximo do encaixe por contorno em cada chamada; passou disso vale o resultado por caixas. */
const PRAZO_CONTORNO_MS = 12_000;

function areaAnel(anel: Anel): number {
  let soma = 0;
  for (let i = 0; i < anel.length; i += 1) {
    const [x1, y1] = anel[i];
    const [x2, y2] = anel[(i + 1) % anel.length];
    soma += x1 * y2 - x2 * y1;
  }
  return Math.abs(soma) / 2;
}

function perimetroAnel(anel: Anel): number {
  let soma = 0;
  for (let i = 0; i < anel.length; i += 1) {
    const [x1, y1] = anel[i];
    const [x2, y2] = anel[(i + 1) % anel.length];
    soma += Math.hypot(x2 - x1, y2 - y1);
  }
  return soma;
}

/** Envoltória convexa (monotone chain): basta para achar a caixa de qualquer rotação. */
function envoltoria(pontos: Par[]): Par[] {
  const ordenados = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (ordenados.length < 3) return ordenados;
  const cruz = (o: Par, a: Par, b: Par) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo: Par[] = [];
  for (const p of ordenados) {
    while (baixo.length >= 2 && cruz(baixo[baixo.length - 2], baixo[baixo.length - 1], p) <= 0) baixo.pop();
    baixo.push(p);
  }
  const cima: Par[] = [];
  for (const p of [...ordenados].reverse()) {
    while (cima.length >= 2 && cruz(cima[cima.length - 2], cima[cima.length - 1], p) <= 0) cima.pop();
    cima.push(p);
  }
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)];
}

type PecaPreparada = {
  indice: number;
  area: number;
  perimetro: number;
  caixas: Array<{ graus: number; largura: number; altura: number }>;
  areaMenorCaixa: number;
  aneis: Anel[];
  casco: Par[];
};

function prepararPeca(peca: PecaMotorInterno, indice: number, angulosCaixa: number[] = ANGULOS): PecaPreparada {
  let poligonos: ReturnType<typeof contornosFisicosDoSvg>;
  try {
    poligonos = contornosFisicosDoSvg(peca.svg, peca.larguraMm, peca.alturaMm);
  } catch (error) {
    if (error instanceof CpqFactibilidadeError) throw new GeometriaInvalidaMotorInterno(error.message);
    throw error;
  }
  if (!poligonos.length) throw new GeometriaInvalidaMotorInterno(`A peça ${indice + 1} não tem contorno fechado com área.`);
  let area = 0;
  let perimetro = 0;
  const cascas: Par[] = [];
  for (const [casca, ...furos] of poligonos) {
    area += areaAnel(casca) - furos.reduce((soma, furo) => soma + areaAnel(furo), 0);
    perimetro += perimetroAnel(casca) + furos.reduce((soma, furo) => soma + perimetroAnel(furo), 0);
    cascas.push(...casca);
  }
  const casco = envoltoria(cascas);
  const caixas = angulosCaixa.map(graus => {
    const rad = (graus * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const [x, y] of casco) {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
    // 1e-6 mm: elimina o ruído de ponto flutuante (100,00000000001 viraria 101 mm no arredondamento para cima).
    return { graus, largura: Math.round((maxX - minX) * 1e6) / 1e6, altura: Math.round((maxY - minY) * 1e6) / 1e6 };
  });
  return { indice, area, perimetro, caixas, areaMenorCaixa: Math.min(...caixas.map(c => c.largura * c.altura)), aneis: poligonos.flat(), casco };
}

type Retangulo = { x: number; y: number; w: number; h: number };

function contido(a: Retangulo, b: Retangulo): boolean {
  return a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS;
}

/** Remove de cada retângulo livre a parte coberta pela peça colocada e descarta os livres contidos em outros. */
function cortarLivres(livres: Retangulo[], usado: Retangulo): Retangulo[] {
  const resultado: Retangulo[] = [];
  for (const livre of livres) {
    const separados = usado.x >= livre.x + livre.w - EPS || usado.x + usado.w <= livre.x + EPS
      || usado.y >= livre.y + livre.h - EPS || usado.y + usado.h <= livre.y + EPS;
    if (separados) { resultado.push(livre); continue; }
    if (usado.x > livre.x + EPS) resultado.push({ x: livre.x, y: livre.y, w: usado.x - livre.x, h: livre.h });
    if (usado.x + usado.w < livre.x + livre.w - EPS) resultado.push({ x: usado.x + usado.w, y: livre.y, w: livre.x + livre.w - usado.x - usado.w, h: livre.h });
    if (usado.y > livre.y + EPS) resultado.push({ x: livre.x, y: livre.y, w: livre.w, h: usado.y - livre.y });
    if (usado.y + usado.h < livre.y + livre.h - EPS) resultado.push({ x: livre.x, y: usado.y + usado.h, w: livre.w, h: livre.y + livre.h - usado.y - usado.h });
  }
  return resultado.filter((r, i) => !resultado.some((o, j) => i !== j && contido(r, o) && (!contido(o, r) || j < i)));
}

function menorChave(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i] - EPS) return true;
    if (a[i] > b[i] + EPS) return false;
  }
  return false;
}

type Estrategia = {
  ordem: (a: PecaPreparada, b: PecaPreparada) => number;
  /** Desempate depois do crescimento da caixa ocupada (valores menores vencem). */
  desempate: (livre: Retangulo, w: number, h: number, graus: number, folga: number) => number[];
};

const ESTRATEGIAS: Estrategia[] = [
  // Maior área primeiro; encaixe pelo menor lado sobrando (MaxRects BSSF).
  { ordem: (a, b) => b.areaMenorCaixa - a.areaMenorCaixa || a.indice - b.indice, desempate: (l, w, h, _g, f) => [Math.min(l.w - w - f, l.h - h - f), l.y, l.x] },
  // Maior área primeiro; posição mais baixa e à esquerda, preferindo não girar.
  { ordem: (a, b) => b.areaMenorCaixa - a.areaMenorCaixa || a.indice - b.indice, desempate: (l, _w, _h, g) => [g % 180, l.y, l.x] },
  // Maior lado primeiro; menor sobra de área.
  { ordem: (a, b) => Math.max(...b.caixas.map(c => c.largura)) - Math.max(...a.caixas.map(c => c.largura)) || a.indice - b.indice, desempate: (l, w, h, g) => [l.w * l.h - w * h, g % 180, l.y, l.x] },
  // Maior perímetro primeiro; posição mais à esquerda.
  { ordem: (a, b) => b.perimetro - a.perimetro || a.indice - b.indice, desempate: (l, _w, _h, g) => [l.x, l.y, g % 180] },
];

function tentar(
  preparadas: PecaPreparada[],
  estrategia: Estrategia,
  larguraMm: number,
  alturaMm: number,
  folga: number,
  bobina: boolean,
): { colocadas: ResultadoMotorInterno["placements"]; extensaoX: number; extensaoY: number } {
  // Cada peça ocupa a caixa + o espaçamento; a folha ganha o mesmo espaçamento para a última peça encostar na borda.
  let livres: Retangulo[] = [{ x: 0, y: 0, w: larguraMm + folga, h: alturaMm + folga }];
  const colocadas: ResultadoMotorInterno["placements"] = [];
  let extensaoX = 0;
  let extensaoY = 0;
  for (const peca of [...preparadas].sort(estrategia.ordem)) {
    let melhor: { chave: number[]; livre: Retangulo; graus: number; w: number; h: number } | null = null;
    for (const caixa of peca.caixas) {
      const w = caixa.largura;
      const h = caixa.altura;
      for (const livre of livres) {
        if (w + folga > livre.w + EPS || h + folga > livre.h + EPS) continue;
        const novoX = Math.max(extensaoX, livre.x + w);
        const novoY = Math.max(extensaoY, livre.y + h);
        const chave = [bobina ? novoX : novoX * novoY, ...estrategia.desempate(livre, w, h, caixa.graus, folga)];
        if (!melhor || menorChave(chave, melhor.chave)) melhor = { chave, livre, graus: caixa.graus, w, h };
      }
    }
    if (!melhor) continue;
    livres = cortarLivres(livres, { x: melhor.livre.x, y: melhor.livre.y, w: melhor.w + folga, h: melhor.h + folga });
    extensaoX = Math.max(extensaoX, melhor.livre.x + melhor.w);
    extensaoY = Math.max(extensaoY, melhor.livre.y + melhor.h);
    colocadas.push({
      id: colocadas.length, source: peca.indice,
      xMm: melhor.livre.x, yMm: melhor.livre.y, larguraMm: melhor.w, alturaMm: melhor.h, rotacaoGraus: melhor.graus,
    });
  }
  return { colocadas, extensaoX, extensaoY };
}

/**
 * Testa as estratégias de empacotamento e fica com a melhor: mais peças posicionadas e, depois, menor consumo.
 * `bobina`: a largura do rolo é fixa e só o comprimento (eixo X) é cobrado, então o consumo é a extensão em X;
 * em chapa, é a área da caixa ocupada pelo conjunto.
 */
export function executarMotorInterno(
  pecas: PecaMotorInterno[],
  larguraMm: number,
  alturaMm: number,
  espacamentoMm: number,
  opcoes: { bobina?: boolean; /** Material escovado: só 0° e 180°. */ rotacao?: RotacaoPermitida } = {},
): ResultadoMotorInterno {
  const permitidos = angulosPermitidos(opcoes.rotacao);
  const preparadas = pecas.map((peca, indice) => prepararPeca(peca, indice, permitidos ?? ANGULOS));
  const bobina = !!opcoes.bobina;
  const consumo = (t: { extensaoX: number; extensaoY: number }) => (bobina ? t.extensaoX : t.extensaoX * t.extensaoY);
  let melhor = tentar(preparadas, ESTRATEGIAS[0], larguraMm, alturaMm, espacamentoMm, bobina);
  for (const estrategia of ESTRATEGIAS.slice(1)) {
    const candidato = tentar(preparadas, estrategia, larguraMm, alturaMm, espacamentoMm, bobina);
    if (candidato.colocadas.length > melhor.colocadas.length
      || (candidato.colocadas.length === melhor.colocadas.length && consumo(candidato) < consumo(melhor) - EPS)) melhor = candidato;
  }
  // Contorno real: tenta encaixar de verdade (vazados, rotações) e vence quando posiciona mais peças ou gasta menos.
  try {
    const posicoes = empacotarPorContorno(
      preparadas.map(peca => ({ indice: peca.indice, aneis: peca.aneis, casco: peca.casco, area: peca.area })),
      larguraMm, alturaMm, espacamentoMm, { prazoMs: PRAZO_CONTORNO_MS, angulos: permitidos },
    );
    const colocadasRaster = posicoes.map((posicao, id) => ({
      id, source: posicao.indice, xMm: posicao.xMm, yMm: posicao.yMm, larguraMm: posicao.larguraMm, alturaMm: posicao.alturaMm, rotacaoGraus: posicao.rotacaoGraus,
    }));
    const candidato = {
      colocadas: colocadasRaster,
      extensaoX: colocadasRaster.reduce((m, item) => Math.max(m, item.xMm + item.larguraMm), 0),
      extensaoY: colocadasRaster.reduce((m, item) => Math.max(m, item.yMm + item.alturaMm), 0),
    };
    if (candidato.colocadas.length > melhor.colocadas.length
      || (candidato.colocadas.length === melhor.colocadas.length && consumo(candidato) < consumo(melhor) - EPS)) melhor = candidato;
  } catch (erro) {
    if (!(erro instanceof TempoEsgotadoRaster)) throw erro;
  }
  const { colocadas } = melhor;

  const areaLiquidaMm2 = preparadas.reduce((soma, peca) => soma + peca.area, 0);
  const perimetroTotalMm = preparadas.reduce((soma, peca) => soma + peca.perimetro, 0);
  if (!colocadas.length) {
    return { completo: false, quantidadePecas: preparadas.length, quantidadePosicionada: 0, areaLiquidaMm2, perimetroTotalMm, placements: [], bounds: null };
  }
  const minX = Math.min(...colocadas.map(item => item.xMm));
  return {
    completo: colocadas.length === preparadas.length,
    quantidadePecas: preparadas.length,
    quantidadePosicionada: colocadas.length,
    areaLiquidaMm2,
    perimetroTotalMm,
    // Mesma convenção do worker do Deepnest: o layout é transladado para o X mínimo ficar em zero.
    placements: colocadas.map(item => ({ ...item, xMm: item.xMm - minX })),
    bounds: {
      minX: 0,
      maxX: Math.max(...colocadas.map(item => item.xMm + item.larguraMm)) - minX,
      minY: Math.min(...colocadas.map(item => item.yMm)),
      maxY: Math.max(...colocadas.map(item => item.yMm + item.alturaMm)),
    },
  };
}
