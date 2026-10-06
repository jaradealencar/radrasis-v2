import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { estudioKits, materiaPrimaCadastros } from "../../drizzle/schema";

/**
 * Produtividades de solda ligadas ao produto (cadastro de kit do CPQ): só na categoria Letreiros, sem repetidas, só
 * matérias-primas que são produtividade no catálogo do MubiSys, e o catálogo só é consultado para IDs novos. Usa o banco de
 * testes do .env (ids fictícios, apagados no final); a sessão e o catálogo do MubiSys são simulados.
 */
const catalogo = vi.hoisted(() => ({ listar: vi.fn() }));
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => ({ user: { id: "teste" } }) } } }));
vi.mock("../integrations/mubisys-client", async importOriginal => ({
  ...(await importOriginal<typeof import("../integrations/mubisys-client")>()),
  listarMateriasPrimas: catalogo.listar,
}));

const { getDb } = await import("../db/db");
const { registrarRotasEstudioKits } = await import("../routes/estudio-kits");
const { registrarRotasEstudioNesting } = await import("../routes/estudio-nesting");

const CHAVE = "987654601_1";
const SOLDA_A = 987_654_621;
const SOLDA_B = 987_654_622;
const GERAL = 987_654_623;
const CHAPA = 987_654_624;
const MATERIA_CLASSIFICADA = 987_654_631;

let servidor: Server;
let base = "";

const salvarKit = (kit: Record<string, unknown>) =>
  fetch(`${base}/api/letra-caixa/kits/${CHAVE}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kit: { linhas: [], ...kit } }) });

const kitSalvo = async () => {
  const { kits } = (await (await fetch(`${base}/api/letra-caixa/kits`)).json()) as { kits: { chave: string; kit: Record<string, unknown> }[] };
  return kits.find(item => item.chave === CHAVE)?.kit;
};

const limpar = async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(estudioKits).where(eq(estudioKits.chave, CHAVE));
  await db.delete(materiaPrimaCadastros).where(eq(materiaPrimaCadastros.mubisysMateriaPrimaId, MATERIA_CLASSIFICADA));
};

beforeAll(async () => {
  await limpar();
  const app = express();
  app.use(express.json());
  registrarRotasEstudioKits(app);
  registrarRotasEstudioNesting(app);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  servidor?.close();
  await limpar();
});

beforeEach(async () => {
  const db = await getDb();
  await db!.delete(estudioKits).where(eq(estudioKits.chave, CHAVE));
  catalogo.listar.mockReset();
  catalogo.listar.mockResolvedValue([
    { id: SOLDA_A, nome: "Produtividade Solda 98º [R$10,00] [Teste]" },
    { id: SOLDA_B, nome: "Produtividade Solda 99º [R$12,00] [Teste]" },
    { id: GERAL, nome: "Produtividade Geral - Hora" },
    { id: CHAPA, nome: "Chapa de teste" },
  ]);
});

describe("produtividades relacionadas no cadastro do produto", () => {
  it("grava e devolve várias produtividades para um produto da categoria Letreiros", async () => {
    const resposta = await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A, SOLDA_B] });
    expect(resposta.status).toBe(200);
    expect((await kitSalvo())?.produtividadesRelacionadas).toEqual([SOLDA_A, SOLDA_B]);
  });

  it("recusa ID que não é produtividade (chapa, 'Produtividade Geral' ou inexistente) e não grava nada", async () => {
    for (const id of [CHAPA, GERAL, 987_654_699]) {
      const resposta = await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A, id] });
      expect(resposta.status).toBe(400);
      expect(((await resposta.json()) as { error: string }).error).toContain(String(id));
    }
    expect(await kitSalvo()).toBeUndefined();
  });

  it("só vale para a categoria Letreiros (lista vazia ou ausente passa em qualquer categoria)", async () => {
    for (const categoria of ["Acessórios", null]) {
      const resposta = await salvarKit({ categoria, produtividadesRelacionadas: [SOLDA_A] });
      expect(resposta.status).toBe(400);
      expect(((await resposta.json()) as { error: string }).error).toMatch(/Letreiros/);
    }
    expect((await salvarKit({ categoria: "Acessórios", produtividadesRelacionadas: [] })).status).toBe(200);
    expect((await salvarKit({ categoria: "Acessórios" })).status).toBe(200);
  });

  it("recusa repetidas, valores que não são IDs e listas gigantes", async () => {
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A, SOLDA_A] })).status).toBe(400);
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: ["x"] })).status).toBe(400);
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [-3] })).status).toBe(400);
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: Array.from({ length: 101 }, (_, i) => i + 1) })).status).toBe(400);
  });

  it("só consulta o MubiSys para IDs novos (a gravação do kit é automática e frequente)", async () => {
    await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A] });
    expect(catalogo.listar).toHaveBeenCalledTimes(1);
    // mesma lista de novo (ex.: outro campo do kit mudou): nenhuma consulta
    await salvarKit({ categoria: "Letreiros", descricaoProduto: "mudou", produtividadesRelacionadas: [SOLDA_A] });
    expect(catalogo.listar).toHaveBeenCalledTimes(1);
    // acrescentar uma nova: consulta
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A, SOLDA_B] })).status).toBe(200);
    expect(catalogo.listar).toHaveBeenCalledTimes(2);
    // só remover uma: nenhuma consulta
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_B] })).status).toBe(200);
    expect(catalogo.listar).toHaveBeenCalledTimes(2);
    expect((await kitSalvo())?.produtividadesRelacionadas).toEqual([SOLDA_B]);
  });

  it("sem conseguir confirmar no MubiSys, responde 503 e mantém o que já estava salvo", async () => {
    await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A] });
    catalogo.listar.mockRejectedValue(new Error("MubiSys fora do ar"));
    const resposta = await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A, SOLDA_B] });
    expect(resposta.status).toBe(503);
    expect((await kitSalvo())?.produtividadesRelacionadas).toEqual([SOLDA_A]);
  });
});

describe("classificação das produtividades na rota de situação do cadastro (usada pelo HTML do CPQ)", () => {
  it("devolve tipos de solda, tamanho e materiais gravados", async () => {
    const db = await getDb();
    await db!.insert(materiaPrimaCadastros).values({
      mubisysMateriaPrimaId: MATERIA_CLASSIFICADA,
      produtividadeTiposSolda: ["orelhinha", "barra_roscada"],
      produtividadeTamanhos: ["acima_11cm", "ate_11cm"],
      produtividadeMateriais: ["latao", "inox"],
    });
    const { materias } = (await (await fetch(`${base}/api/letra-caixa/materias-cadastro`)).json()) as { materias: { id: number; produtividade: unknown }[] };
    expect(materias.find(item => item.id === MATERIA_CLASSIFICADA)?.produtividade).toEqual({
      tiposSolda: ["barra_roscada", "orelhinha"],
      tamanhos: ["ate_11cm", "acima_11cm"],
      materiais: ["inox", "latao"],
    });
  });
});
