/**
 * Nesting por contorno real (raster): cada peça, em várias rotações, vira uma máscara de células conservadora
 * (qualquer célula tocada pelo contorno conta como ocupada, mais o espaçamento). A chapa é uma grade de bits e cada
 * peça é posicionada na posição mais à esquerda (e depois mais abaixo) em que as máscaras não se sobrepõem — como
 * fatiar um pão: ocupa a largura da chapa e vai avançando no comprimento. Por usar o contorno, peças pequenas entram
 * nos vazados das grandes (miolo do "O", de um hexágono...) e as letras se encaixam girando em todos os lados.
 *
 * A máscara é maior que a peça (conservadora), então o layout nunca sobrepõe peças de verdade; o custo é um espaço
 * extra de até uma célula (c mm) por borda. Sem dependências; roda em qualquer servidor.
 */

export type Par = [number, number];
export type PecaRaster = {
  indice: number;
  /** Todos os anéis (cascas e furos) em mm, na origem do SVG da peça. Preenchimento par-ímpar. */
  aneis: Par[][];
  /** Envoltória convexa da peça, para escolher ângulos de encaixe. */
  casco: Par[];
  area: number;
};

export type PosicaoRaster = { indice: number; xMm: number; yMm: number; larguraMm: number; alturaMm: number; rotacaoGraus: number };

export class TempoEsgotadoRaster extends Error {}

type Variante = {
  graus: number;
  larguraMm: number;
  alturaMm: number;
  minX: number;
  minY: number;
  /** Máscara com a borda do espaçamento: Wb × Hb células, `palavras` palavras de 32 bits por linha. */
  Wb: number;
  Hb: number;
  palavras: number;
  bits: Uint32Array;
  linhasUsadas: Int32Array;
  primeira: Int32Array;
  ultima: Int32Array;
  deslocadas: Map<number, Uint32Array>;
};

function rotacionar(aneis: Par[][], graus: number): { aneis: Par[][]; minX: number; minY: number; larguraMm: number; alturaMm: number } {
  const rad = (graus * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const girados = aneis.map(anel => anel.map(([x, y]): Par => {
    const rx = x * cos - y * sin, ry = x * sin + y * cos;
    if (rx < minX) minX = rx;
    if (ry < minY) minY = ry;
    if (rx > maxX) maxX = rx;
    if (ry > maxY) maxY = ry;
    return [rx, ry];
  }));
  const normalizados = girados.map(anel => anel.map(([x, y]): Par => [x - minX, y - minY]));
  return { aneis: normalizados, minX, minY, larguraMm: Math.round((maxX - minX) * 1e6) / 1e6, alturaMm: Math.round((maxY - minY) * 1e6) / 1e6 };
}

/** Máscara conservadora: toda célula tocada por um trecho interno do contorno (par-ímpar) fica ocupada; depois dilata `d` células. */
function mascara(aneis: Par[][], larguraMm: number, alturaMm: number, c: number, d: number) {
  const wc = Math.ceil(larguraMm / c) + 1, hc = Math.ceil(alturaMm / c) + 1;
  const grade = new Uint8Array(wc * hc);
  const passo = c / 2;
  const cruzamentos: number[][] = Array.from({ length: Math.ceil(alturaMm / passo) + 3 }, () => []);
  for (const anel of aneis) {
    for (let i = 0; i < anel.length; i += 1) {
      const [x1, y1] = anel[i], [x2, y2] = anel[(i + 1) % anel.length];
      if (y1 === y2) continue;
      const ymin = Math.min(y1, y2), ymax = Math.max(y1, y2);
      for (let m = Math.ceil(ymin / passo); m * passo < ymax; m += 1) {
        if (m < 0 || m >= cruzamentos.length) continue;
        cruzamentos[m].push(x1 + ((m * passo - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
  }
  for (let m = 0; m < cruzamentos.length; m += 1) {
    const xs = cruzamentos[m];
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    const linha = Math.min(hc - 1, Math.floor((m * passo) / c));
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const ini = Math.max(0, Math.floor(xs[k] / c)), fim = Math.min(wc - 1, Math.floor(xs[k + 1] / c));
      for (let x = ini; x <= fim; x += 1) grade[linha * wc + x] = 1;
    }
  }
  // dilatação por d células (janela 2d+1 em cada eixo), em grade com d de folga em cada lado
  const Wb = wc + 2 * d, Hb = hc + 2 * d;
  const horizontal = new Uint8Array(Wb * hc);
  for (let y = 0; y < hc; y += 1) {
    let soma = 0;
    // célula X da saída = coluna X-d da original; vale 1 se houver arte em [X-2d, X] da original (janela deslizante)
    for (let x = 0; x < Wb; x += 1) {
      if (x < wc) soma += grade[y * wc + x];
      const sai = x - 2 * d - 1;
      if (sai >= 0 && sai < wc) soma -= grade[y * wc + sai];
      horizontal[y * Wb + x] = soma > 0 ? 1 : 0;
    }
  }
  const palavras = Math.ceil(Wb / 32);
  const bits = new Uint32Array(Hb * palavras);
  for (let x = 0; x < Wb; x += 1) {
    let soma = 0;
    for (let y = 0; y < Hb; y += 1) {
      if (y < hc) soma += horizontal[y * Wb + x];
      const sai = y - 2 * d - 1;
      if (sai >= 0 && sai < hc) soma -= horizontal[sai * Wb + x];
      if (soma > 0) bits[y * palavras + (x >>> 5)] |= 1 << (x & 31);
    }
  }
  return { Wb, Hb, palavras, bits };
}

function prepararVariante(peca: PecaRaster, graus: number, c: number, d: number): Variante {
  const r = rotacionar(peca.aneis, graus);
  const { Wb, Hb, palavras, bits } = mascara(r.aneis, r.larguraMm, r.alturaMm, c, d);
  const usadas: number[] = [], primeira: number[] = [], ultima: number[] = [];
  for (let y = 0; y < Hb; y += 1) {
    let a = -1, b = -1;
    for (let k = 0; k < palavras; k += 1) if (bits[y * palavras + k]) { if (a < 0) a = k; b = k; }
    if (a >= 0) { usadas.push(y); primeira.push(a); ultima.push(b); }
  }
  return {
    graus, larguraMm: r.larguraMm, alturaMm: r.alturaMm, minX: r.minX, minY: r.minY, Wb, Hb, palavras, bits,
    linhasUsadas: Int32Array.from(usadas), primeira: Int32Array.from(primeira), ultima: Int32Array.from(ultima), deslocadas: new Map(),
  };
}

function deslocada(v: Variante, s: number): Uint32Array {
  let saida = v.deslocadas.get(s);
  if (saida) return saida;
  const pw1 = v.palavras + 1;
  saida = new Uint32Array(v.Hb * pw1);
  for (let y = 0; y < v.Hb; y += 1) {
    for (let k = 0; k < v.palavras; k += 1) {
      const valor = v.bits[y * v.palavras + k];
      if (!valor) continue;
      if (s === 0) saida[y * pw1 + k] |= valor;
      else { saida[y * pw1 + k] |= (valor << s) >>> 0; saida[y * pw1 + k + 1] |= valor >>> (32 - s); }
    }
  }
  v.deslocadas.set(s, saida);
  return saida;
}

/** Ângulos de teste: os quatro lados e, se a peça for inclinada, também os que alinham a maior aresta aos eixos. */
export function angulosDaPeca(casco: Par[]): number[] {
  const angulos = new Set<number>([0, 90, 180, 270]);
  let maior = 0, direcao = 0;
  for (let i = 0; i < casco.length; i += 1) {
    const [x1, y1] = casco[i], [x2, y2] = casco[(i + 1) % casco.length];
    const comprimento = Math.hypot(x2 - x1, y2 - y1);
    if (comprimento > maior) { maior = comprimento; direcao = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI; }
  }
  const alinhado = (((-direcao % 90) + 90) % 90);
  if (alinhado > 2 && alinhado < 88) for (let k = 0; k < 4; k += 1) angulos.add(Math.round((alinhado + 90 * k) * 10) / 10);
  return [...angulos];
}

export type OpcoesRaster = { celulaMm?: number; prazoMs?: number };

/**
 * Posiciona todas as peças que couberem na chapa `larguraMm × alturaMm`, avançando pelo eixo X. Devolve as posições
 * (canto da caixa já girada, em mm) e o que ficou de fora. Lança TempoEsgotadoRaster se passar do prazo.
 */
export function empacotarPorContorno(
  pecas: PecaRaster[],
  larguraMm: number,
  alturaMm: number,
  espacamentoMm: number,
  opcoes: OpcoesRaster = {},
): PosicaoRaster[] {
  const prazo = opcoes.prazoMs ? Date.now() + opcoes.prazoMs : Infinity;
  const c = opcoes.celulaMm ?? Math.min(4, Math.max(2, espacamentoMm || 3));
  const d = Math.max(0, Math.ceil(espacamentoMm / (2 * c)));
  const SWc = Math.floor(larguraMm / c) + 2 * d, SHc = Math.floor(alturaMm / c) + 2 * d;
  if (SWc < 2 || SHc < 2) return [];
  const SW = Math.ceil(SWc / 32) + 2;
  const folha = new Uint32Array(SHc * SW);
  const posicoes: PosicaoRaster[] = [];

  for (const peca of [...pecas].sort((a, b) => b.area - a.area || a.indice - b.indice)) {
    if (Date.now() > prazo) throw new TempoEsgotadoRaster("prazo do nesting por contorno esgotado");
    let melhor: { gx: number; gy: number; v: Variante; score: number } | null = null;
    for (const graus of angulosDaPeca(peca.casco)) {
      const v = prepararVariante(peca, graus, c, d);
      if (v.Wb > SWc || v.Hb > SHc) continue;
      const limiteX = melhor ? melhor.score - v.Wb : Infinity; // só interessa quem termina antes do melhor atual
      const gxMax = Math.min(SWc - v.Wb, melhor ? limiteX : Infinity);
      let achada: { gx: number; gy: number } | null = null;
      for (let gx = 0; gx <= gxMax && !achada; gx += 1) {
        if ((gx & 63) === 0 && Date.now() > prazo) throw new TempoEsgotadoRaster("prazo do nesting por contorno esgotado");
        const s = gx & 31, wo = gx >>> 5, sh = deslocada(v, s), pw1 = v.palavras + 1;
        for (let gy = 0; gy <= SHc - v.Hb; gy += 1) {
          let livre = true;
          for (let i = 0; i < v.linhasUsadas.length && livre; i += 1) {
            const r = v.linhasUsadas[i], baseF = (gy + r) * SW + wo, baseP = r * pw1;
            for (let k = v.primeira[i]; k <= v.ultima[i] + 1; k += 1) {
              if (folha[baseF + k] & sh[baseP + k]) { livre = false; break; }
            }
          }
          if (livre) { achada = { gx, gy }; break; }
        }
      }
      if (!achada) continue;
      const score = achada.gx + v.Wb;
      if (!melhor || score < melhor.score || (score === melhor.score && achada.gy < melhor.gy)) melhor = { gx: achada.gx, gy: achada.gy, v, score };
    }
    if (!melhor) continue;
    const { v, gx, gy } = melhor;
    const sh = deslocada(v, gx & 31), wo = gx >>> 5, pw1 = v.palavras + 1;
    for (let i = 0; i < v.linhasUsadas.length; i += 1) {
      const r = v.linhasUsadas[i];
      for (let k = v.primeira[i]; k <= v.ultima[i] + 1; k += 1) folha[(gy + r) * SW + wo + k] |= sh[r * pw1 + k];
    }
    posicoes.push({ indice: peca.indice, xMm: gx * c, yMm: gy * c, larguraMm: v.larguraMm, alturaMm: v.alturaMm, rotacaoGraus: v.graus });
  }
  return posicoes;
}
