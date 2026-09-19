import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Banco falso: só o que o router usa (select→limit, insert→onConflictDoUpdate, delete→where)
let linhas: any[] = [];
const inseridos: any[] = [];
const atualizacoes: any[] = [];
const delecoes: number[] = [];
function cadeia(rows: any[]) {
  const c: any = { from: () => c, where: () => c, limit: async () => rows };
  return c;
}
const dbFalso = {
  select: vi.fn(() => cadeia(linhas)),
  insert: vi.fn(() => ({
    values: (v: any) => { inseridos.push(v); return { onConflictDoUpdate: async (o: any) => { atualizacoes.push(o.set); } }; },
  })),
  delete: vi.fn(() => ({ where: async () => { delecoes.push(1); } })),
};
vi.mock("../db/db", () => ({ getDb: async () => dbFalso }));

import { validarPngBase64, whatsappImagemRouter, LIMITE_BASE64_CHARS } from "../routers/whatsappImagem";

/** A imagem padrão do sistema: PNG real, 1024x1536 */
const pngBase64 = readFileSync(path.join(__dirname, "../../client/public/whatsapp/3-motivos-letreiros-express.png")).toString("base64");

const ctx: any = { user: { id: "u1", name: "Daniel Jara", email: "d@e.com", role: "admin" }, req: {}, res: {} };
const caller = () => whatsappImagemRouter.createCaller(ctx);

beforeEach(() => {
  linhas = [];
  inseridos.length = 0;
  atualizacoes.length = 0;
  delecoes.length = 0;
});

describe("validarPngBase64", () => {
  it("aceita um PNG real e lê largura, altura e tamanho do próprio cabeçalho", () => {
    const r = validarPngBase64(pngBase64);
    expect(r).toEqual({ ok: true, tamanhoBytes: 1632446, largura: 1024, altura: 1536 });
  });

  it("recusa JPEG (a área de transferência só aceita PNG)", () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString("base64");
    const r = validarPngBase64(jpeg);
    expect(r.ok).toBe(false);
  });

  it("recusa texto qualquer e base64 inválido", () => {
    expect(validarPngBase64("isso não é base64!!").ok).toBe(false);
    expect(validarPngBase64(Buffer.from("<html>oi</html>".repeat(20)).toString("base64")).ok).toBe(false);
  });

  it("recusa PNG truncado (cabeçalho incompleto)", () => {
    expect(validarPngBase64(pngBase64.slice(0, 20)).ok).toBe(false);
  });

  it("recusa acima do limite de tamanho", () => {
    const r = validarPngBase64("A".repeat(LIMITE_BASE64_CHARS + 4));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/grande demais/i);
  });
});

describe("whatsappImagemRouter", () => {
  it("get: sem imagem salva usa a padrão (personalizada = false)", async () => {
    expect(await caller().get()).toEqual({ personalizada: false });
  });

  it("get: com imagem salva devolve data URL, metadados e quem trocou", async () => {
    const quando = new Date("2026-09-19T15:00:00Z");
    linhas = [{ nomeArquivo: "nova.png", base64: pngBase64, largura: 1024, altura: 1536, tamanhoBytes: 1632446, updatedAt: quando, usuarioNome: "Daniel Jara" }];
    const r: any = await caller().get();
    expect(r.personalizada).toBe(true);
    expect(r.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(r).toMatchObject({ nomeArquivo: "nova.png", largura: 1024, altura: 1536, atualizadoPor: "Daniel Jara", atualizadoEm: quando });
  });

  it("set: grava com dimensões lidas do PNG (não confia no navegador) e registra quem trocou", async () => {
    const r = await caller().set({ nomeArquivo: "infografico.png", base64: pngBase64 });
    expect(r).toEqual({ ok: true, tamanhoBytes: 1632446, largura: 1024, altura: 1536 });
    expect(inseridos[0]).toMatchObject({ chave: "propostas_alto_valor", nomeArquivo: "infografico.png", largura: 1024, altura: 1536, usuarioNome: "Daniel Jara", usuarioId: "u1" });
    expect(atualizacoes[0]).toMatchObject({ nomeArquivo: "infografico.png", usuarioNome: "Daniel Jara" });
  });

  it("set: recusa arquivo que não é PNG e não grava nada", async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString("base64");
    await expect(caller().set({ nomeArquivo: "foto.jpg", base64: jpeg })).rejects.toThrow(/PNG/);
    expect(inseridos).toHaveLength(0);
  });

  it("restaurarPadrao: apaga a imagem personalizada", async () => {
    expect(await caller().restaurarPadrao()).toEqual({ ok: true });
    expect(delecoes).toHaveLength(1);
  });

  it("exige usuário logado", async () => {
    const semLogin = whatsappImagemRouter.createCaller({ user: null, req: {}, res: {} } as any);
    await expect(semLogin.get()).rejects.toThrow();
    await expect(semLogin.set({ nomeArquivo: "x.png", base64: pngBase64 })).rejects.toThrow();
  });
});
