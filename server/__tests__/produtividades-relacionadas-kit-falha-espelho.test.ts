import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { estudioKits, materiasPrimas } from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn<() => Promise<unknown>>(),
  listarMateriasPrimas: vi.fn<() => Promise<unknown>>(),
  listarProdutos: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("../_core/auth", () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: { id: "teste" } })) } },
}));
vi.mock("../db/db", () => ({ getDb: mocks.getDb }));
vi.mock("../integrations/mubisys-client", () => ({
  listarMateriasPrimas: mocks.listarMateriasPrimas,
  listarProdutos: mocks.listarProdutos,
}));

const { registrarRotasEstudioKits } = await import("../routes/estudio-kits");

const CHAVE = "987654601_1";
const ID_SALVO = 987_654_621;
const ID_NOVO = 987_654_622;
const dadosKitOriginal = {
  linhas: [],
  categoria: "Letreiros",
  produtividadesRelacionadas: [ID_SALVO],
};

let servidor: Server;
let base = "";
let dadosKitPersistidos = structuredClone(dadosKitOriginal);

const dbFalso = {
  select: vi.fn(() => ({
    from: vi.fn((tabela: typeof estudioKits | typeof materiasPrimas) => ({
      where: vi.fn(() => tabela === estudioKits
        ? Promise.resolve([{ dadosJson: dadosKitPersistidos }])
        : { orderBy: vi.fn(async () => { throw new Error("Falha simulada na consulta PostgreSQL do espelho local."); }) }),
      orderBy: vi.fn(async () => [{ chave: CHAVE, dadosJson: dadosKitPersistidos }]),
    })),
  })),
  insert: vi.fn(() => {
    throw new Error("Não deveria gravar o kit se a leitura do espelho falhou.");
  }),
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registrarRotasEstudioKits(app);
  servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => servidor.once("listening", resolve));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => servidor.close(error => error ? reject(error) : resolve()));
});

beforeEach(() => {
  dadosKitPersistidos = structuredClone(dadosKitOriginal);
  mocks.getDb.mockReset().mockResolvedValue(dbFalso);
  mocks.listarMateriasPrimas.mockReset().mockRejectedValue(new Error("A API MubiSys não deve ser chamada neste teste."));
  mocks.listarProdutos.mockReset().mockRejectedValue(new Error("A API MubiSys não deve ser chamada neste teste."));
  dbFalso.select.mockClear();
  dbFalso.insert.mockClear();
});

describe("PUT /api/letra-caixa/kits/:chave quando o espelho local falha", () => {
  it("responde 503 e preserva as produtividades já salvas sem consultar o MubiSys", async () => {
    const resposta = await fetch(`${base}/api/letra-caixa/kits/${CHAVE}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kit: { ...dadosKitOriginal, produtividadesRelacionadas: [ID_SALVO, ID_NOVO] } }),
    });

    expect(resposta.status).toBe(503);
    expect(await resposta.json()).toMatchObject({ error: expect.stringContaining("MubiSys") });
    expect(dbFalso.select).toHaveBeenCalledTimes(2);
    expect(dbFalso.insert).not.toHaveBeenCalled();
    expect(mocks.listarMateriasPrimas).not.toHaveBeenCalled();
    expect(mocks.listarProdutos).not.toHaveBeenCalled();

    const leitura = await fetch(`${base}/api/letra-caixa/kits`);
    expect(leitura.status).toBe(200);
    const corpo = await leitura.json() as { kits: Array<{ chave: string; kit: typeof dadosKitOriginal }> };
    expect(corpo.kits).toEqual([{ chave: CHAVE, kit: dadosKitOriginal }]);
  });
});
