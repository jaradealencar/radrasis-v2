import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";
import { extrairRegioesCorSvg } from "../services/cpqCoresMateriais";
import { contornosFisicosDoSvg } from "../services/cpqFactibilidadeFabricacao";

type Pixels = { data: Uint8ClampedArray; width: number; height: number };
type Vetorizador = {
  vetorizarPixels: (imagem: Pixels, opcoes?: { maxCores?: number; minAreaPx?: number; modo?: "completo" | "corte" }) =>
    { svg: string; info: { cores: number; caminhos: number; aneis: number } };
};

let local: Vetorizador;
beforeAll(() => {
  runInThisContext(readFileSync(resolve(process.cwd(), "client/public/cpq-vetorizador-local.js"), "utf8"));
  local = (globalThis as unknown as { CpqVetorizadorLocal: Vetorizador }).CpqVetorizadorLocal;
});

const AMARELO: [number, number, number] = [254, 203, 1];
const AZUL: [number, number, number] = [28, 63, 148];

/** Arte 200×100: anel amarelo (raio 40/20) e retângulo azul 60×40, com antialias por supersampling 4×. */
function arte(fundo: [number, number, number, number]): Pixels {
  const w = 200, h = 100, data = new Uint8ClampedArray(w * h * 4);
  const cobertura = (x: number, y: number, dentro: (px: number, py: number) => boolean) => {
    let n = 0;
    for (let sy = 0; sy < 4; sy += 1) for (let sx = 0; sx < 4; sx += 1) if (dentro(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n += 1;
    return n / 16;
  };
  const anel = (px: number, py: number) => { const r = Math.hypot(px - 50, py - 50); return r <= 40 && r >= 20; };
  const retangulo = (px: number, py: number) => px >= 120 && px < 180 && py >= 30 && py < 70;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const ca = cobertura(x, y, anel), cr = cobertura(x, y, retangulo), i = (y * w + x) * 4;
    const cf = 1 - ca - cr;
    const transparente = fundo[3] === 0;
    const alfa = transparente ? ca + cr : 1;
    for (let c = 0; c < 3; c += 1) {
      const soma = AMARELO[c] * ca + AZUL[c] * cr + (transparente ? 0 : fundo[c] * cf);
      data[i + c] = alfa > 0 ? soma / alfa : 0;
    }
    data[i + 3] = alfa * 255;
  }
  return { data, width: w, height: h };
}

const areaPoligono = (poligono: Array<Array<[number, number]>>) => {
  const anel = (a: Array<[number, number]>) => Math.abs(a.reduce((s, p, i) => { const q = a[(i + 1) % a.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const [casca, ...furos] = poligono;
  return anel(casca) - furos.reduce((s, f) => s + anel(f), 0);
};

const hexParaRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

describe("vetorizador local (plano B do Vectorizer.AI)", () => {
  it.each([
    ["fundo branco", [255, 255, 255, 255] as [number, number, number, number]],
    ["fundo transparente", [0, 0, 0, 0] as [number, number, number, number]],
  ])("separa as duas cores e mantém o vazado do anel (%s)", (_nome, fundo) => {
    const { svg, info } = local.vetorizarPixels(arte(fundo));
    expect(info.cores).toBe(2);
    const caminhos = [...svg.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]+)"\/>/g)];
    expect(caminhos).toHaveLength(2);
    const cores = caminhos.map(c => hexParaRgb(c[1]));
    const proximo = (rgb: number[], alvo: number[]) => rgb.every((v, i) => Math.abs(v - alvo[i]) <= 12);
    expect(cores.some(c => proximo(c, AMARELO))).toBe(true);
    expect(cores.some(c => proximo(c, AZUL))).toBe(true);

    // Cada cor vira um caminho; o anel tem casca + furo, o retângulo só a casca.
    const [primeiro, segundo] = caminhos.map(c => contornosFisicosDoSvg(`<svg viewBox="0 0 200 100"><path d="${c[2]}"/></svg>`, 200, 100));
    const amarelo = proximo(cores[0], AMARELO) ? primeiro : segundo;
    const azul = proximo(cores[0], AMARELO) ? segundo : primeiro;
    expect(amarelo).toHaveLength(1);
    expect(amarelo[0]).toHaveLength(2);
    expect(areaPoligono(amarelo[0])).toBeGreaterThan(Math.PI * (40 ** 2 - 20 ** 2) * 0.96);
    expect(areaPoligono(amarelo[0])).toBeLessThan(Math.PI * (40 ** 2 - 20 ** 2) * 1.04);
    expect(azul).toHaveLength(1);
    expect(azul[0]).toHaveLength(1);
    expect(areaPoligono(azul[0])).toBeGreaterThan(2400 * 0.96);
    expect(areaPoligono(azul[0])).toBeLessThan(2400 * 1.04);
  });

  it("gera um SVG que o leitor de cores do CPQ aceita", () => {
    const { svg } = local.vetorizarPixels(arte([255, 255, 255, 255]));
    const regioes = extrairRegioesCorSvg(svg);
    expect(regioes).toHaveLength(2);
    expect(regioes.every(r => r.tipoCor === "solida" && /^#[0-9a-f]{6}$/.test(r.corHex ?? ""))).toBe(true);
  });

  it("no modo corte devolve uma silhueta só, com o vazado", () => {
    const { svg, info } = local.vetorizarPixels(arte([255, 255, 255, 255]), { modo: "corte" });
    expect(info.caminhos).toBe(1);
    const poligonos = contornosFisicosDoSvg(svg, 200, 100);
    expect(poligonos).toHaveLength(2); // anel (com furo) + retângulo
    const total = poligonos.reduce((s, p) => s + areaPoligono(p), 0);
    const esperado = Math.PI * (40 ** 2 - 20 ** 2) + 2400;
    expect(total).toBeGreaterThan(esperado * 0.96);
    expect(total).toBeLessThan(esperado * 1.04);
  });

  it("recusa imagem sem arte (só fundo)", () => {
    const branca = { width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4).fill(255) };
    expect(() => local.vetorizarPixels(branca)).toThrow(/só fundo/);
  });

  it("respeita o limite de cores pedido", () => {
    const { info } = local.vetorizarPixels(arte([255, 255, 255, 255]), { maxCores: 1 });
    expect(info.cores).toBe(1);
  });
});
