import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Banco falso "thenable": qualquer cadeia select().from().where().orderBy().limit() resolve para `linhas`
let linhas: any[] = [];
let uso: { n: number; total: number } = { n: 0, total: 0 };
let selectChamadas = 0;
const inseridos: any[] = [];
const atualizados: any[] = [];
const removidos: number[] = [];
function cadeia(rows: any[]) {
  const c: any = {
    from: () => c, where: () => c, orderBy: () => c, limit: () => c,
    then: (ok: any, err: any) => Promise.resolve(rows).then(ok, err),
  };
  return c;
}
const dbFalso = {
  // 1º select da mutation `add` é a contagem de uso; os demais devolvem `linhas`
  select: vi.fn((campos?: any) => {
    selectChamadas++;
    return campos && "n" in campos ? cadeia([uso]) : cadeia(linhas);
  }),
  insert: vi.fn(() => ({
    values: (v: any) => { inseridos.push(v); return { returning: async () => [{ id: 42 }] }; },
  })),
  update: vi.fn(() => ({ set: (s: any) => ({ where: async () => { atualizados.push(s); } }) })),
  delete: vi.fn(() => ({ where: async () => { removidos.push(1); } })),
};
vi.mock("../db/db", () => ({ getDb: async () => dbFalso }));

import {
  midiasBibliotecaRouter, validarMiniatura, MAX_ITENS_BIBLIOTECA, MAX_BYTES_BIBLIOTECA, LIMITE_MINIATURA_CHARS,
} from "../routers/midiasBiblioteca";

const pngBase64 = readFileSync(path.join(__dirname, "../../client/public/whatsapp/3-motivos-letreiros-express.png")).toString("base64");
// Miniatura mínima válida: cabeçalho JPEG (FF D8 FF) + bytes quaisquer
const miniJpeg = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 1)]).toString("base64");

const ctx: any = { user: { id: "u1", name: "Daniel Jara", email: "d@e.com", role: "admin" }, req: {}, res: {} };
const caller = () => midiasBibliotecaRouter.createCaller(ctx);
const entradaValida = { titulo: "  3 motivos  ", categoria: " Institucional ", nomeArquivo: "3-motivos.png", base64: pngBase64, miniatura: miniJpeg };

beforeEach(() => {
  linhas = [];
  uso = { n: 0, total: 0 };
  selectChamadas = 0;
  inseridos.length = 0;
  atualizados.length = 0;
  removidos.length = 0;
});

describe("validarMiniatura", () => {
  it("aceita data URL de JPEG e de PNG pequenos", () => {
    expect(validarMiniatura(miniJpeg).ok).toBe(true);
    const png = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(80)]).toString("base64");
    expect(validarMiniatura(png).ok).toBe(true);
  });

  it("recusa conteúdo que não é imagem, tipo trocado e prefixo estranho", () => {
    expect(validarMiniatura("data:image/jpeg;base64," + Buffer.from("<html>oi</html>".repeat(10)).toString("base64")).ok).toBe(false);
    expect(validarMiniatura(miniJpeg.replace("image/jpeg", "image/png")).ok).toBe(false);
    expect(validarMiniatura("data:text/html;base64,PGh0bWw+").ok).toBe(false);
    expect(validarMiniatura("http://exemplo.com/x.jpg").ok).toBe(false);
  });

  it("recusa miniatura grande demais", () => {
    expect(validarMiniatura("data:image/jpeg;base64," + "A".repeat(LIMITE_MINIATURA_CHARS)).ok).toBe(false);
  });
});

describe("midiasBibliotecaRouter", () => {
  it("list: devolve metadados + miniatura (sem o arquivo inteiro) e o total em bytes", async () => {
    linhas = [
      { id: 2, titulo: "B", categoria: null, nomeArquivo: "b.png", miniatura: miniJpeg, tamanhoBytes: 1000, largura: 10, altura: 20, usos: 3, criadoPor: "Daniel", criadoEm: new Date() },
      { id: 1, titulo: "A", categoria: "Catálogo", nomeArquivo: "a.png", miniatura: miniJpeg, tamanhoBytes: 500, largura: 10, altura: 20, usos: 0, criadoPor: "Daniel", criadoEm: new Date() },
    ];
    const r = await caller().list();
    expect(r.itens).toHaveLength(2);
    expect(r.totalBytes).toBe(1500);
    expect(r.limiteItens).toBe(MAX_ITENS_BIBLIOTECA);
    expect(Object.keys(r.itens[0])).not.toContain("base64");
  });

  it("getImagem: devolve o PNG como data URL; erro claro se não existir", async () => {
    linhas = [{ base64: pngBase64, titulo: "3 motivos" }];
    const r = await caller().getImagem({ id: 1 });
    expect(r.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    linhas = [];
    await expect(caller().getImagem({ id: 99 })).rejects.toThrow(/não encontrada/i);
  });

  it("add: valida o PNG, lê largura/altura do cabeçalho, limpa espaços e registra quem enviou", async () => {
    const r = await caller().add(entradaValida);
    expect(r).toEqual({ ok: true, id: 42 });
    expect(inseridos[0]).toMatchObject({
      titulo: "3 motivos", categoria: "Institucional", nomeArquivo: "3-motivos.png",
      largura: 1024, altura: 1536, tamanhoBytes: 1632446, usuarioNome: "Daniel Jara", usuarioId: "u1",
    });
  });

  it("add: categoria vazia vira null", async () => {
    await caller().add({ ...entradaValida, categoria: "   " });
    expect(inseridos[0].categoria).toBeNull();
  });

  it("add: recusa arquivo que não é PNG, miniatura inválida e título vazio — sem gravar nada", async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString("base64");
    await expect(caller().add({ ...entradaValida, base64: jpeg })).rejects.toThrow(/PNG/);
    await expect(caller().add({ ...entradaValida, miniatura: "data:image/jpeg;base64,AAAA" + "A".repeat(60) })).rejects.toThrow(/Miniatura/);
    await expect(caller().add({ ...entradaValida, titulo: "   " })).rejects.toThrow();
    expect(inseridos).toHaveLength(0);
  });

  it("add: barra quando a biblioteca já tem o máximo de imagens", async () => {
    uso = { n: MAX_ITENS_BIBLIOTECA, total: 1000 };
    await expect(caller().add(entradaValida)).rejects.toThrow(/limite de \d+ imagens/);
    expect(inseridos).toHaveLength(0);
  });

  it("add: barra quando estouraria o espaço total", async () => {
    uso = { n: 3, total: MAX_BYTES_BIBLIOTECA - 100 };
    await expect(caller().add(entradaValida)).rejects.toThrow(/cheia/);
    expect(inseridos).toHaveLength(0);
  });

  it("update: renomeia e troca a categoria", async () => {
    await caller().update({ id: 5, titulo: " Novo nome ", categoria: "Produtos" });
    expect(atualizados[0]).toMatchObject({ titulo: "Novo nome", categoria: "Produtos" });
  });

  it("registrarUso e remover funcionam", async () => {
    expect(await caller().registrarUso({ id: 5 })).toEqual({ ok: true });
    expect(atualizados).toHaveLength(1);
    expect(await caller().remover({ id: 5 })).toEqual({ ok: true });
    expect(removidos).toHaveLength(1);
  });

  it("exige usuário logado", async () => {
    const semLogin = midiasBibliotecaRouter.createCaller({ user: null, req: {}, res: {} } as any);
    await expect(semLogin.list()).rejects.toThrow();
    await expect(semLogin.remover({ id: 1 })).rejects.toThrow();
  });
});
