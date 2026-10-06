/**
 * Router de matérias-primas contra o banco real de teste (o `.env` local nunca aponta para produção). O catálogo do MubiSys é
 * simulado com ids fictícios (987_654_5xx), e tudo o que o teste grava é apagado no final.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { materiaPrimaCadastros } from "../../drizzle/schema";

const ID_SOLDA = 987_654_501;
const ID_GERAL = 987_654_502;
const ID_CHAPA = 987_654_503;
const IDS = [ID_SOLDA, ID_GERAL, ID_CHAPA];

vi.mock("../integrations/mubisys-client", () => ({
  listarMateriasPrimas: async () => [
    { id: 987_654_501, nome: "Produtividade Solda 99º [R$10,00] [Teste]", categoria: "Mão de obra", tipo: "Serviço", unidade_custo: "Unidade/Gl/Lt/Kg", unidade_movimentacao: "Unidade/Gl/Lt/Kg", valor_custo: 10, data_referencia: null, status: "Ativo" },
    { id: 987_654_502, nome: "Produtividade Geral - Hora", categoria: "Mão de obra", tipo: "Serviço", unidade_custo: "Unidade/Gl/Lt/Kg", unidade_movimentacao: "Unidade/Gl/Lt/Kg", valor_custo: 18.5, data_referencia: null, status: "Ativo" },
    { id: 987_654_503, nome: "Chapa de teste", categoria: "Chapas", tipo: "Insumo", unidade_custo: "Metro quadrado", unidade_movimentacao: "Metro quadrado", valor_custo: 100, data_referencia: null, status: "Ativo" },
  ],
}));

const { getDb } = await import("../db/db");
const { materiasPrimasRouter } = await import("../routers/materiasPrimas");

const ctxGestor: any = { user: { id: "t1", name: "Teste Gestor", email: "g@x.com", role: "gestor" }, req: {}, res: {} };
const ctxVendas: any = { user: { id: "t2", name: "Teste Vendas", email: "v@x.com", role: "vendas" }, req: {}, res: {} };
const gestor = () => materiasPrimasRouter.createCaller(ctxGestor);

/** Campos que `salvar` exige, sem categoria nem dados técnicos. */
const base = (id: number) => ({ mubisysMateriaPrimaId: id, categoriaId: null, espessuraMm: null, densidadeKgM3: null, chapas: [] });

const limpar = async () => {
  const db = await getDb();
  if (db) await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, IDS));
};

const linha = async (id: number) => {
  const itens = await gestor().listar();
  const item = itens.find(material => material.id === id);
  if (!item) throw new Error(`matéria-prima ${id} fora da listagem`);
  return item;
};

describe("subclassificação das matérias-primas de produtividade (router + banco)", () => {
  beforeAll(limpar);
  afterAll(limpar);

  it("só marca como produtividade as linhas certas e nasce sem classificação", async () => {
    const solda = await linha(ID_SOLDA);
    expect(solda).toMatchObject({ ehProdutividade: true, produtividadeTiposSolda: [], produtividadeTamanhos: [], produtividadeMateriais: [] });
    expect((await linha(ID_GERAL)).ehProdutividade).toBe(false);
    expect((await linha(ID_CHAPA)).ehProdutividade).toBe(false);
  });

  it("grava até 3 tipos de solda, o tamanho e os materiais, e devolve na listagem", async () => {
    await gestor().salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["orelhinha", "barra_roscada", "patinha_led"], produtividadeTamanhos: ["acima_11cm", "ate_11cm"], produtividadeMateriais: ["latao", "inox"] });
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeTiposSolda: ["barra_roscada", "patinha_led", "orelhinha"], produtividadeTamanhos: ["ate_11cm", "acima_11cm"], produtividadeMateriais: ["inox", "latao"] });
  });

  it("salvar de novo troca a classificação (e limpar zera)", async () => {
    // os materiais não têm limite: dá para marcar os cinco
    await gestor().salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["sem_fixacao"], produtividadeTamanhos: ["acima_11cm"], produtividadeMateriais: ["aluminio", "acrilico", "latao", "galvanizado", "inox"] });
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeTiposSolda: ["sem_fixacao"], produtividadeTamanhos: ["acima_11cm"], produtividadeMateriais: ["inox", "galvanizado", "latao", "acrilico", "aluminio"] });
    await gestor().salvar({ ...base(ID_SOLDA) });
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeTiposSolda: [], produtividadeTamanhos: [], produtividadeMateriais: [] });
  });

  it("recusa mais de 3 tipos, repetidos, 'sem fixação' misturado e valores fora da lista", async () => {
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["barra_roscada", "patinha_led", "chapinha_dupla_face", "orelhinha"] })).rejects.toThrow(/no máximo 3/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["orelhinha", "orelhinha"] })).rejects.toThrow(/repetidos/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["sem_fixacao", "orelhinha"] })).rejects.toThrow(/Sem fixação/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["solda_a_ponto" as any] })).rejects.toThrow();
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeTamanhos: ["12cm" as any] })).rejects.toThrow();
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeTamanhos: ["ate_11cm", "ate_11cm"] })).rejects.toThrow(/tamanhos repetidos/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeMateriais: ["inox", "inox"] })).rejects.toThrow(/materiais repetidos/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeMateriais: ["cobre" as any] })).rejects.toThrow();
  });

  it("'Produtividade Geral - Hora' e matérias-primas comuns ignoram a classificação enviada", async () => {
    for (const id of [ID_GERAL, ID_CHAPA]) {
      await gestor().salvar({ ...base(id), produtividadeTiposSolda: ["orelhinha"], produtividadeTamanhos: ["ate_11cm"], produtividadeMateriais: ["inox"] });
      expect(await linha(id)).toMatchObject({ produtividadeTiposSolda: [], produtividadeTamanhos: [], produtividadeMateriais: [] });
    }
  });

  it("só gestor, admin e master podem salvar", async () => {
    await expect(materiasPrimasRouter.createCaller(ctxVendas).salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["orelhinha"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
