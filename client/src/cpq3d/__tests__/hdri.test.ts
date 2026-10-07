import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HalfFloatType } from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

describe("HDRI de estúdio local", () => {
  it("é um Radiance RGBE válido, 1024×512, com luzes bem acima de 1 (softboxes) e fundo neutro", () => {
    const arquivo = readFileSync(resolve(import.meta.dirname, "../../../public/render3d/environments/studio-1k.hdr"));
    const dados = new RGBELoader().setDataType(HalfFloatType).parse(arquivo.buffer.slice(arquivo.byteOffset, arquivo.byteOffset + arquivo.byteLength) as ArrayBuffer);
    expect(dados.width).toBe(1024);
    expect(dados.height).toBe(512);
    // Half float 0x3c00 = 1.0; procura um pixel claramente maior que 1 (softbox) e um valor médio baixo (ambiente).
    const meio = (dados.data as Uint16Array);
    const paraFloat = (h: number) => {
      const exp = (h >> 10) & 0x1f, mant = h & 0x3ff;
      return exp === 0 ? mant * 2 ** -24 : exp === 31 ? Infinity : (1 + mant / 1024) * 2 ** (exp - 15);
    };
    let maximo = 0, soma = 0;
    for (let i = 0; i < meio.length; i += 4) { const v = paraFloat(meio[i]); maximo = Math.max(maximo, v); soma += v; }
    expect(maximo).toBeGreaterThan(8);
    const media = soma / (meio.length / 4);
    expect(media).toBeGreaterThan(0.2);
    expect(media).toBeLessThan(4);
  });
});
