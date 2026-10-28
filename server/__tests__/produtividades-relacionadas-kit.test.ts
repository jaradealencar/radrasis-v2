import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { estudioKits, materiaPrimaCadastros, materiasPrimas } from "../../drizzle/schema";

/**
 * Tests the related productivity kit routes against PostgreSQL's local
 * materias_primas mirror, using disposable fake IDs cleaned up at the end.
 * Session and MubiSys calls are stubbed so the test stays local.
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
const IDS_MATERIAS = [SOLDA_A, SOLDA_B, GERAL, CHAPA, MATERIA_CLASSIFICADA];
const espelho = (id: number, nome: string, categoriaErp: string, tipoErp: string) => ({
  skuErp: `TESTE-KIT-MP-${id}`, mubisysMateriaPrimaId: id, nome, unidadeMedida: "Unidade/Gl/Lt/Kg",
  categoriaErp, tipoErp, statusErp: "Ativo", ativa: true,
});

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
  await db.delete(materiasPrimas).where(inArray(materiasPrimas.mubisysMateriaPrimaId, IDS_MATERIAS));
};

beforeAll(async () => {
  await limpar();
  const db = await getDb();
  if (!db) throw new Error("test database unavailable");
  await db.insert(materiasPrimas).values([
    espelho(SOLDA_A, "Produtividade Solda 98\u00ba [R$10,00] [Teste]", "M\u00e3o de obra", "Servi\u00e7o"),
    espelho(SOLDA_B, "Produtividade Solda 99\u00ba [R$12,00] [Teste]", "M\u00e3o de obra", "Servi\u00e7o"),
    espelho(GERAL, "Produtividade Geral - Hora", "M\u00e3o de obra", "Servi\u00e7o"),
    espelho(CHAPA, "Chapa de teste", "Chapas", "Insumo"),
    espelho(MATERIA_CLASSIFICADA, "Material classificado", "Chapas", "Insumo"),
  ]);
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
  catalogo.listar.mockRejectedValue(new Error("This test uses the local PostgreSQL mirror."));
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

  it("validates new IDs against the local mirror without querying MubiSys", async () => {
    await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A] });
    expect(catalogo.listar).not.toHaveBeenCalled();
    await salvarKit({ categoria: "Letreiros", descricaoProduto: "changed", produtividadesRelacionadas: [SOLDA_A] });
    expect(catalogo.listar).not.toHaveBeenCalled();
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A, SOLDA_B] })).status).toBe(200);
    expect(catalogo.listar).not.toHaveBeenCalled();
    expect((await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_B] })).status).toBe(200);
    expect((await kitSalvo())?.produtividadesRelacionadas).toEqual([SOLDA_B]);
  });

  it("rejects an unknown ID without changing the saved kit", async () => {
    await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A] });
    const resposta = await salvarKit({ categoria: "Letreiros", produtividadesRelacionadas: [SOLDA_A, 987_654_699] });
    expect(resposta.status).toBe(400);
    expect(((await resposta.json()) as { error: string }).error).toContain("987654699");
    expect((await kitSalvo())?.produtividadesRelacionadas).toEqual([SOLDA_A]);
    expect(catalogo.listar).not.toHaveBeenCalled();
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
      tamanhos: ["abaixo_8cm", "entre_8_11cm", "acima_11cm"],
      materiais: ["inox", "latao"],
    });
  });
});
