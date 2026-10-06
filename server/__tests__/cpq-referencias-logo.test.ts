import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodificarImagem,
  instrucaoReferenciasLogo,
  MAX_BYTES_REFERENCIA,
  prepararReferencias,
} from "../services/cpqReferenciasLogo";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 2)]);
const b64 = (b: Buffer) => b.toString("base64");

describe("referências adicionais da mesma logo", () => {
  it("decodifica foto principal e até 2 referências, conferindo os bytes do formato", () => {
    const entrada = prepararReferencias({
      escopo: "somente_logo",
      principal: { mimeType: "image/png", dataBase64: b64(PNG) },
      referencias: [
        { mimeType: "image/jpeg", dataBase64: b64(JPEG), tipo: "site" },
        { mimeType: "image/png", dataBase64: b64(PNG), tipo: "redes" },
      ],
    });
    expect(entrada.principal.imageBuffer.equals(PNG)).toBe(true);
    expect(entrada.referencias.map(r => r.tipo)).toEqual(["site", "redes"]);
    expect(entrada.referencias[0].mimeType).toBe("image/jpeg");
  });

  it("aceita entrada sem referências extras", () => {
    const entrada = prepararReferencias({ escopo: "letreiro_completo", principal: { mimeType: "image/jpeg", dataBase64: b64(JPEG) } });
    expect(entrada.referencias).toEqual([]);
  });

  it("recusa a terceira referência, tipo desconhecido e campos extras", () => {
    const ref = { mimeType: "image/png" as const, dataBase64: b64(PNG), tipo: "site" as const };
    const base = { escopo: "somente_logo", principal: { mimeType: "image/png", dataBase64: b64(PNG) } };
    expect(() => prepararReferencias({ ...base, referencias: [ref, ref, ref] })).toThrow();
    expect(() => prepararReferencias({ ...base, referencias: [{ ...ref, tipo: "buscar_na_internet" }] })).toThrow();
    expect(() => prepararReferencias({ ...base, referencias: [], url: "https://exemplo.com/logo.png" })).toThrow();
  });

  it("recusa imagem cujo conteúdo não é do tipo declarado", () => {
    expect(() => decodificarImagem({ mimeType: "image/png", dataBase64: b64(JPEG) }, 1_000_000, "foto")).toThrow(/não é um PNG/);
    expect(() => decodificarImagem({ mimeType: "image/jpeg", dataBase64: b64(PNG) }, 1_000_000, "foto")).toThrow(/não é um JPG/);
    expect(() => decodificarImagem({ mimeType: "image/png", dataBase64: "isso não é base64!!" }, 1_000_000, "foto")).toThrow(/não é uma imagem válida/);
  });

  it("recusa referência acima do limite de bytes e aceita o prefixo data:", () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(MAX_BYTES_REFERENCIA + 10, 3)]);
    expect(() => decodificarImagem({ mimeType: "image/png", dataBase64: b64(grande) }, MAX_BYTES_REFERENCIA, "referência")).toThrow(/grande demais/);
    expect(decodificarImagem({ mimeType: "image/png", dataBase64: `data:image/png;base64,${b64(PNG)}` }, 1_000_000, "foto").imageBuffer.equals(PNG)).toBe(true);
  });

  it("a instrução numera as imagens, manda a principal prevalecer e proíbe misturar versões", () => {
    const texto = instrucaoReferenciasLogo([{ tipo: "site" }, { tipo: "papelaria" }]);
    expect(texto).toContain("IMAGEM 1: a FOTO PRINCIPAL");
    expect(texto).toContain("IMAGEM 2: logotipo no site oficial do cliente");
    expect(texto).toContain("IMAGEM 3: cartão, papelaria ou material impresso");
    expect(texto).toMatch(/não misture as duas/);
    expect(texto).toMatch(/Não invente/);
  });

  it("sem referências a instrução é vazia (o prompt não muda)", () => {
    expect(instrucaoReferenciasLogo([])).toBe("");
  });
});

describe("generateImageEdit com imagens extras", () => {
  const chaveOriginal = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "sk-teste-sem-rede";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (chaveOriginal === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = chaveOriginal;
  });

  it("envia a principal primeiro e as referências depois, todas em image[]", async () => {
    let corpo: FormData | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      corpo = init.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: b64(PNG) }] }), { status: 200 });
    }));
    const { generateImageEdit } = await import("../_core/llm");
    const resultado = await generateImageEdit({
      imageBuffer: PNG,
      imageFilename: "principal.png",
      imageMimeType: "image/png",
      prompt: "teste",
      imagensExtras: [
        { buffer: JPEG, mimeType: "image/jpeg", filename: "referencia-2.jpg" },
        { buffer: PNG, mimeType: "image/png", filename: "referencia-3.png" },
      ],
    });
    expect(resultado.mimeType).toBe("image/png");
    const imagens = corpo!.getAll("image[]") as File[];
    expect(imagens.map(i => i.name)).toEqual(["principal.png", "referencia-2.jpg", "referencia-3.png"]);
    expect(imagens[1].type).toBe("image/jpeg");
  });

  it("sem extras envia só a imagem principal", async () => {
    let corpo: FormData | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      corpo = init.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: b64(PNG) }] }), { status: 200 });
    }));
    const { generateImageEdit } = await import("../_core/llm");
    await generateImageEdit({ imageBuffer: PNG, imageFilename: "principal.png", imageMimeType: "image/png", prompt: "teste" });
    expect(corpo!.getAll("image[]")).toHaveLength(1);
  });
});
