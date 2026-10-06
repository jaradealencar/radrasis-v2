import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { materiaPrimaCadastros } from "../../drizzle/schema";
import { carregarPoliticaCorte } from "../db/politicaCorte";
import { getDb } from "../db/db";

/** Usa ids de matéria-prima fictícios (fora do MubiSys) e remove tudo no final. */
const ID_ROUTER = 987_654_301;
const ID_ESCOVADO = 987_654_302;
const ID_ANTIGO = 987_654_303; // valor antigo/desconhecido de rotação gravado antes da simplificação
const ID_SEM_POLITICA = 987_654_304;
const IDS = [ID_ROUTER, ID_ESCOVADO, ID_ANTIGO, ID_SEM_POLITICA];

describe("política de corte gravada no cadastro (banco)", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível para o teste");
    await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, IDS));
    await db.insert(materiaPrimaCadastros).values([
      { mubisysMateriaPrimaId: ID_ROUTER, processoCorte: "router", rotacaoPermitida: "livre", espacamentoMm: "9.50", margemBordaMm: null },
      { mubisysMateriaPrimaId: ID_ESCOVADO, processoCorte: "plasma", rotacaoPermitida: "veio", espacamentoMm: null, margemBordaMm: "25" },
      { mubisysMateriaPrimaId: ID_ANTIGO, processoCorte: "inexistente", rotacaoPermitida: "quadrantes" },
      { mubisysMateriaPrimaId: ID_SEM_POLITICA },
    ]);
  });

  afterAll(async () => {
    const db = await getDb();
    if (db) await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, IDS));
  });

  it("resolve cada matéria-prima: próprio > processo > orçamento, e rotação do escovado", async () => {
    const db = await getDb();
    const politicas = await carregarPoliticaCorte(db!, [...IDS, 987_654_399], { espacamentoMm: 3, margemBordaMm: 5 });

    expect(politicas.get(ID_ROUTER)).toMatchObject({ processo: "router", rotacao: "livre", espacamentoMm: 9.5, origemEspacamento: "material", margemBordaMm: 12, origemMargem: "processo" });
    expect(politicas.get(ID_ESCOVADO)).toMatchObject({ processo: "plasma", rotacao: "veio", espacamentoMm: 10, origemEspacamento: "processo", margemBordaMm: 25, origemMargem: "material" });
    // processo desconhecido e rotação antiga viram "sem política": padrão do orçamento e rotação livre
    expect(politicas.get(ID_ANTIGO)).toMatchObject({ processo: null, rotacao: "livre", espacamentoMm: 3, margemBordaMm: 5 });
    expect(politicas.get(ID_SEM_POLITICA)).toMatchObject({ processo: null, rotacao: "livre", espacamentoMm: 3, margemBordaMm: 5, origemEspacamento: "orcamento" });
    // matéria-prima sem linha no cadastro também usa o orçamento
    expect(politicas.get(987_654_399)).toMatchObject({ rotacao: "livre", espacamentoMm: 3, margemBordaMm: 5 });
  });

  it("a coluna de rotação nasce 'livre' (linhas existentes mantêm o comportamento de sempre)", async () => {
    const db = await getDb();
    const [linha] = await db!.select().from(materiaPrimaCadastros).where(eq(materiaPrimaCadastros.mubisysMateriaPrimaId, ID_SEM_POLITICA));
    expect(linha.rotacaoPermitida).toBe("livre");
    expect(linha.processoCorte).toBeNull();
  });
});
