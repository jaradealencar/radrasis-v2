import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Banco falso "thenable": cada select() consome o próximo resultado de `filas`, na ordem em que a
// procedure consulta o banco; o resto é registrado para os testes conferirem.
let filas: any[][] = [];
const inseridos: Array<{ tabela: string; valores: any }> = [];
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
  select: vi.fn(() => cadeia(filas.shift() ?? [])),
  insert: vi.fn((tabela: any) => ({
    values: (v: any) => {
      inseridos.push({ tabela: tabela === undefined ? "?" : String(Object.keys(tabela).includes("nome") ? "galerias" : "imagens"), valores: v });
      return { returning: async () => [{ id: 42 }] };
    },
  })),
  update: vi.fn(() => ({ set: (s: any) => ({ where: async () => { atualizados.push(s); } }) })),
  delete: vi.fn(() => ({ where: async () => { removidos.push(1); } })),
};
vi.mock("../db/db", () => ({ getDb: async () => dbFalso }));

import {
  midiasBibliotecaRouter, validarMiniatura, chaveNomeGaleria,
  MAX_ITENS_BIBLIOTECA, MAX_BYTES_BIBLIOTECA, MAX_GALERIAS, LIMITE_MINIATURA_CHARS,
} from "../routers/midiasBiblioteca";

const pngBase64 = readFileSync(path.join(__dirname, "../../client/public/whatsapp/3-motivos-letreiros-express.png")).toString("base64");
// Miniatura mínima válida: cabeçalho JPEG (FF D8 FF) + bytes quaisquer
const miniJpeg = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 1)]).toString("base64");

const ctx: any = { user: { id: "u1", name: "Daniel Jara", email: "d@e.com", role: "admin" }, req: {}, res: {} };
const caller = () => midiasBibliotecaRouter.createCaller(ctx);
const entradaValida = { titulo: "  3 motivos  ", galeriaId: null, nomeArquivo: "3-motivos.png", base64: pngBase64, miniatura: miniJpeg };
const semUso = { n: 0, total: 0 };

beforeEach(() => {
  filas = [];
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

describe("chaveNomeGaleria", () => {
  it("ignora acento, caixa e espaços nas pontas", () => {
    expect(chaveNomeGaleria("  Promoções ")).toBe(chaveNomeGaleria("promocoes"));
    expect(chaveNomeGaleria("PRODUTOS")).toBe("produtos");
  });
});

describe("imagens", () => {
  it("list: devolve metadados + miniatura (sem o arquivo inteiro), as galerias e o total em bytes", async () => {
    filas = [
      [
        { id: 2, titulo: "B", galeriaId: 7, nomeArquivo: "b.png", miniatura: miniJpeg, tamanhoBytes: 1000, largura: 10, altura: 20, usos: 3, criadoPor: "Daniel", criadoEm: new Date() },
        { id: 1, titulo: "A", galeriaId: null, nomeArquivo: "a.png", miniatura: miniJpeg, tamanhoBytes: 500, largura: 10, altura: 20, usos: 0, criadoPor: "Daniel", criadoEm: new Date() },
      ],
      [{ id: 7, nome: "Institucional" }],
    ];
    const r = await caller().list();
    expect(r.itens).toHaveLength(2);
    expect(r.galerias).toEqual([{ id: 7, nome: "Institucional" }]);
    expect(r.totalBytes).toBe(1500);
    expect(r.limiteItens).toBe(MAX_ITENS_BIBLIOTECA);
    expect(r.limiteGalerias).toBe(MAX_GALERIAS);
    expect(Object.keys(r.itens[0])).not.toContain("base64");
  });

  it("getImagem: devolve o PNG como data URL; erro claro se não existir", async () => {
    filas = [[{ base64: pngBase64, titulo: "3 motivos" }]];
    const r = await caller().getImagem({ id: 1 });
    expect(r.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    await expect(caller().getImagem({ id: 99 })).rejects.toThrow(/não encontrada/i);
  });

  it("add: valida o PNG, lê largura/altura do cabeçalho, limpa espaços e registra quem enviou", async () => {
    filas = [[semUso]];
    const r = await caller().add(entradaValida);
    expect(r).toEqual({ ok: true, id: 42 });
    expect(inseridos[0].valores).toMatchObject({
      titulo: "3 motivos", galeriaId: null, nomeArquivo: "3-motivos.png",
      largura: 1024, altura: 1536, tamanhoBytes: 1632446, usuarioNome: "Daniel Jara", usuarioId: "u1",
    });
  });

  it("add: coloca a imagem na galeria escolhida (conferindo que ela existe)", async () => {
    filas = [[semUso], [{ id: 7 }]];
    await caller().add({ ...entradaValida, galeriaId: 7 });
    expect(inseridos[0].valores.galeriaId).toBe(7);
  });

  it("add: recusa galeria que não existe mais", async () => {
    filas = [[semUso], []];
    await expect(caller().add({ ...entradaValida, galeriaId: 99 })).rejects.toThrow(/galeria não existe/i);
    expect(inseridos).toHaveLength(0);
  });

  it("add: recusa arquivo que não é PNG, miniatura inválida e título vazio — sem gravar nada", async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString("base64");
    await expect(caller().add({ ...entradaValida, base64: jpeg })).rejects.toThrow(/PNG/);
    await expect(caller().add({ ...entradaValida, miniatura: "data:image/jpeg;base64,AAAA" + "A".repeat(60) })).rejects.toThrow(/Miniatura/);
    await expect(caller().add({ ...entradaValida, titulo: "   " })).rejects.toThrow();
    expect(inseridos).toHaveLength(0);
  });

  it("add: barra quando a biblioteca já tem o máximo de imagens", async () => {
    filas = [[{ n: MAX_ITENS_BIBLIOTECA, total: 1000 }]];
    await expect(caller().add(entradaValida)).rejects.toThrow(/limite de \d+ imagens/);
    expect(inseridos).toHaveLength(0);
  });

  it("add: barra quando estouraria o espaço total", async () => {
    filas = [[{ n: 3, total: MAX_BYTES_BIBLIOTECA - 100 }]];
    await expect(caller().add(entradaValida)).rejects.toThrow(/cheia/);
    expect(inseridos).toHaveLength(0);
  });

  it("update: renomeia e move para outra galeria; sem galeriaId não mexe na galeria", async () => {
    await caller().update({ id: 5, titulo: " Novo nome ", galeriaId: 7 });
    expect(atualizados[0]).toMatchObject({ titulo: "Novo nome", galeriaId: 7 });
    await caller().update({ id: 5, titulo: "Só o nome" });
    expect(atualizados[1]).toMatchObject({ titulo: "Só o nome" });
    expect("galeriaId" in atualizados[1]).toBe(false);
    await caller().update({ id: 5, titulo: "Tirar da galeria", galeriaId: null });
    expect(atualizados[2].galeriaId).toBeNull();
  });

  it("registrarUso e remover funcionam", async () => {
    expect(await caller().registrarUso({ id: 5 })).toEqual({ ok: true });
    expect(atualizados).toHaveLength(1);
    expect(await caller().remover({ id: 5 })).toEqual({ ok: true });
    expect(removidos).toHaveLength(1);
  });
});

describe("galerias", () => {
  it("criarGaleria: cria com o nome limpo, no fim da ordem", async () => {
    filas = [[{ id: 1, nome: "Institucional" }, { id: 2, nome: "Produtos" }]];
    expect(await caller().criarGaleria({ nome: "  Promoções  " })).toEqual({ ok: true, id: 42 });
    expect(inseridos[0].valores).toEqual({ nome: "Promoções", ordem: 2 });
  });

  it("criarGaleria: recusa nome repetido, ignorando acento e caixa", async () => {
    filas = [[{ id: 1, nome: "Promoções" }]];
    await expect(caller().criarGaleria({ nome: "PROMOCOES" })).rejects.toThrow(/Já existe uma galeria/);
    expect(inseridos).toHaveLength(0);
  });

  it("criarGaleria: recusa nome vazio, nome enorme e passar do limite de galerias", async () => {
    await expect(caller().criarGaleria({ nome: "   " })).rejects.toThrow();
    await expect(caller().criarGaleria({ nome: "x".repeat(61) })).rejects.toThrow();
    filas = [Array.from({ length: MAX_GALERIAS }, (_, i) => ({ id: i + 1, nome: `G${i}` }))];
    await expect(caller().criarGaleria({ nome: "Mais uma" })).rejects.toThrow(/Limite de \d+ galerias/);
    expect(inseridos).toHaveLength(0);
  });

  it("renomearGaleria: aceita o próprio nome com outra caixa, recusa o nome de OUTRA galeria", async () => {
    filas = [[{ id: 1, nome: "produtos" }, { id: 2, nome: "Promoções" }]];
    await caller().renomearGaleria({ id: 1, nome: "Produtos" });
    expect(atualizados[0]).toEqual({ nome: "Produtos" });
    filas = [[{ id: 1, nome: "produtos" }, { id: 2, nome: "Promoções" }]];
    await expect(caller().renomearGaleria({ id: 1, nome: "promocoes" })).rejects.toThrow(/Já existe/);
  });

  it("excluirGaleria: tira as imagens da galeria (não apaga nenhuma) e depois apaga a galeria", async () => {
    await caller().excluirGaleria({ id: 7 });
    expect(atualizados).toEqual([{ galeriaId: null }]);
    expect(removidos).toHaveLength(1);
  });
});

describe("acesso", () => {
  it("exige usuário logado", async () => {
    const semLogin = midiasBibliotecaRouter.createCaller({ user: null, req: {}, res: {} } as any);
    await expect(semLogin.list()).rejects.toThrow();
    await expect(semLogin.remover({ id: 1 })).rejects.toThrow();
    await expect(semLogin.criarGaleria({ nome: "X" })).rejects.toThrow();
    await expect(semLogin.excluirGaleria({ id: 1 })).rejects.toThrow();
  });
});
