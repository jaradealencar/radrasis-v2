import { describe, expect, it } from "vitest";
import { detectarImagem3d, GIF_3D_MAX_BYTES, validarGif3d, validarImagem3d } from "../services/cpqRender3dImagem";

function png(largura: number, altura: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(largura, 16);
  b.writeUInt32BE(altura, 20);
  return b;
}

function jpeg(largura: number, altura: number): Buffer {
  // SOI + APP0 (16 bytes) + SOF0 com as dimensões
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.alloc(19);
  sof[0] = 0xff; sof[1] = 0xc0; sof.writeUInt16BE(17, 2); sof[4] = 8;
  sof.writeUInt16BE(altura, 5); sof.writeUInt16BE(largura, 7); sof[9] = 3;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

function webpLossy(largura: number, altura: number): Buffer {
  const b = Buffer.alloc(40);
  b.write("RIFF", 0, "ascii"); b.writeUInt32LE(32, 4); b.write("WEBP", 8, "ascii"); b.write("VP8 ", 12, "ascii");
  b[23] = 0x9d; b[24] = 0x01; b[25] = 0x2a; b.writeUInt16LE(largura, 26); b.writeUInt16LE(altura, 28);
  return b;
}

function webpExtendido(largura: number, altura: number): Buffer {
  const b = Buffer.alloc(40);
  b.write("RIFF", 0, "ascii"); b.writeUInt32LE(32, 4); b.write("WEBP", 8, "ascii"); b.write("VP8X", 12, "ascii");
  const w = largura - 1, h = altura - 1;
  b[24] = w & 255; b[25] = (w >> 8) & 255; b[26] = (w >> 16) & 255;
  b[27] = h & 255; b[28] = (h >> 8) & 255; b[29] = (h >> 16) & 255;
  return b;
}

describe("validação de imagens do 3D (tipo real pelos bytes)", () => {
  it("reconhece PNG, JPEG e WebP e lê as dimensões do cabeçalho", () => {
    expect(detectarImagem3d(png(512, 256))).toEqual({ mime: "image/png", largura: 512, altura: 256 });
    expect(detectarImagem3d(jpeg(1024, 768))).toEqual({ mime: "image/jpeg", largura: 1024, altura: 768 });
    expect(detectarImagem3d(webpLossy(640, 480))).toEqual({ mime: "image/webp", largura: 640, altura: 480 });
    expect(detectarImagem3d(webpExtendido(2048, 1024))).toEqual({ mime: "image/webp", largura: 2048, altura: 1024 });
  });

  it("não confia em extensão nem Content-Type: texto, SVG e executáveis não passam", () => {
    expect(detectarImagem3d(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(detectarImagem3d(Buffer.from("MZ\x90\x00\x03\x00\x00\x00"))).toBeNull();
    expect(detectarImagem3d(Buffer.alloc(0))).toBeNull();
    expect(validarImagem3d(Buffer.from("GIF89a....................................."))).toEqual({ erro: expect.stringContaining("PNG, JPEG ou WebP") });
  });

  it("aplica limites de tamanho e de dimensão", () => {
    expect(validarImagem3d(png(512, 512))).toEqual({ info: { mime: "image/png", largura: 512, altura: 512 } });
    expect(validarImagem3d(png(8, 512))).toEqual({ erro: expect.stringContaining("pequena demais") });
    expect(validarImagem3d(png(8192, 512))).toEqual({ erro: expect.stringContaining("4096") });
    expect(validarImagem3d(Buffer.concat([png(512, 512), Buffer.alloc(5 * 1024 * 1024)]))).toEqual({ erro: expect.stringContaining("4 MB") });
    expect(validarImagem3d(Buffer.concat([png(512, 512), Buffer.alloc(4000)]), { maxBytes: 1000 })).toEqual({ erro: expect.stringContaining("MB") });
  });
});

describe("validação do GIF da animação de montagem (pelos bytes)", () => {
  const gif = (largura: number, altura: number, opcoes: { assinatura?: string; termina?: boolean; extra?: number } = {}): Buffer => {
    const b = Buffer.alloc(14 + (opcoes.extra ?? 0));
    b.write(opcoes.assinatura ?? "GIF89a", 0, "ascii");
    b.writeUInt16LE(largura, 6);
    b.writeUInt16LE(altura, 8);
    if (opcoes.termina !== false) b[b.length - 1] = 0x3b;
    return b;
  };

  it("aceita GIF89a/GIF87a terminado, com dimensões sãs", () => {
    expect(validarGif3d(gif(800, 500))).toEqual({ largura: 800, altura: 500 });
    expect(validarGif3d(gif(640, 400, { assinatura: "GIF87a" }))).toEqual({ largura: 640, altura: 400 });
  });

  it("recusa vazio, outra assinatura, GIF cortado, dimensões fora do limite e arquivo grande demais", () => {
    expect(validarGif3d(Buffer.alloc(0))).toHaveProperty("erro");
    expect(validarGif3d(png(800, 500))).toHaveProperty("erro");
    expect(validarGif3d(gif(800, 500, { termina: false }))).toHaveProperty("erro");
    expect(validarGif3d(gif(100, 100))).toHaveProperty("erro");
    expect(validarGif3d(gif(4000, 500))).toHaveProperty("erro");
    expect(validarGif3d(gif(800, 500, { extra: GIF_3D_MAX_BYTES }))).toMatchObject({ erro: expect.stringContaining("passa de") });
    expect(GIF_3D_MAX_BYTES).toBeLessThan(4.5 * 1024 * 1024); // cabe no corpo de 4,5 MB da Vercel
  });
});
