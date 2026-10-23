/**
 * Tests the materials productivity router against a disposable PostgreSQL database.
 * The local MubiSys mirror is seeded with fake IDs and removed after each suite.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { materiaPrimaCadastros, materiaPrimaCategorias, materiasPrimas } from "../../drizzle/schema";

const ID_SOLDA = 987_654_501;
const ID_GERAL = 987_654_502;
const ID_CHAPA = 987_654_503;
const IDS = [ID_SOLDA, ID_GERAL, ID_CHAPA];
const espelho = (id: number, nome: string, unidadeMedida: string, custoUnitario: number, categoriaErp: string, tipoErp: string) => ({
  skuErp: `TESTE-MP-${id}`, mubisysMateriaPrimaId: id, nome, unidadeMedida, custoUnitario: String(custoUnitario),
  categoriaErp, tipoErp, statusErp: "Ativo", ativa: true,
});
const materiaisFixture = [
  espelho(ID_SOLDA, "Produtividade Solda 99\u00ba [R$10,00] [Teste]", "Unidade/Gl/Lt/Kg", 10, "M\u00e3o de obra", "Servi\u00e7o"),
  espelho(ID_GERAL, "Produtividade Geral - Hora", "Unidade/Gl/Lt/Kg", 18.5, "M\u00e3o de obra", "Servi\u00e7o"),
  espelho(ID_CHAPA, "Chapa de teste", "Metro quadrado", 100, "Chapas", "Insumo"),
];

vi.mock("../services/mubisysEspelho", async importOriginal => ({
  ...(await importOriginal<typeof import("../services/mubisysEspelho")>()),
  prepararCatalogoEspelhado: vi.fn(async () => {}),
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
  if (!db) return;
  await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, IDS));
  await db.delete(materiasPrimas).where(inArray(materiasPrimas.mubisysMateriaPrimaId, IDS));
};
const preparar = async () => {
  await limpar();
  const db = await getDb();
  if (db) await db.insert(materiasPrimas).values(materiaisFixture);
};

const linha = async (id: number) => {
  const itens = await gestor().listar();
  const item = itens.find(material => material.id === id);
  if (!item) throw new Error(`matéria-prima ${id} fora da listagem`);
  return item;
};

describe("subclassificação das matérias-primas de produtividade (router + banco)", () => {
  beforeAll(preparar);
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

describe("estilo do letreiro (categoria, aro, formato e fundo) no router + banco", () => {
  beforeAll(preparar);
  afterAll(limpar);

  it("nasce vazio e grava os quatro grupos, devolvendo na ordem fixa", async () => {
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeCategorias: [], produtividadeAros: [], produtividadeFormatos: [], produtividadeFundos: [] });
    await gestor().salvar({ ...base(ID_SOLDA), produtividadeCategorias: ["tradicional", "frontlight"], produtividadeAros: ["recuado", "normal"], produtividadeFormatos: ["tradicional", "cursiva"], produtividadeFundos: ["sem_fundo"] });
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeCategorias: ["frontlight", "tradicional"], produtividadeAros: ["normal", "recuado"], produtividadeFormatos: ["cursiva", "tradicional"], produtividadeFundos: ["sem_fundo"] });
  });

  it("o editor da Tabela de Preços (produtividadeClassificacaoSalvar) grava o estilo junto das outras marcações", async () => {
    await gestor().produtividadeClassificacaoSalvar({
      mubisysMateriaPrimaId: ID_SOLDA,
      produtividadeTiposSolda: ["orelhinha"], produtividadeTamanhos: ["ate_11cm"], produtividadeMateriais: ["inox"],
      produtividadeCategorias: ["frontlight"], produtividadeAros: ["recuado"], produtividadeFormatos: ["cursiva"], produtividadeFundos: ["com_fundo"],
    });
    expect(await linha(ID_SOLDA)).toMatchObject({
      produtividadeTiposSolda: ["orelhinha"], produtividadeTamanhos: ["ate_11cm"], produtividadeMateriais: ["inox"],
      produtividadeCategorias: ["frontlight"], produtividadeAros: ["recuado"], produtividadeFormatos: ["cursiva"], produtividadeFundos: ["com_fundo"],
    });
  });

  it("uma tela antiga, que não manda o estilo, não apaga o que já estava marcado", async () => {
    await gestor().salvar({ ...base(ID_SOLDA), produtividadeCategorias: ["tradicional"], produtividadeFormatos: ["cursiva"] });
    await gestor().salvar({ ...base(ID_SOLDA), produtividadeTiposSolda: ["barra_roscada"] });
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeTiposSolda: ["barra_roscada"], produtividadeCategorias: ["tradicional"], produtividadeFormatos: ["cursiva"] });
    await gestor().produtividadeClassificacaoSalvar({ mubisysMateriaPrimaId: ID_SOLDA, produtividadeTiposSolda: [], produtividadeTamanhos: [], produtividadeMateriais: [] });
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeCategorias: ["tradicional"], produtividadeFormatos: ["cursiva"] });
  });

  it("mandar o estilo vazio limpa os quatro grupos", async () => {
    await gestor().salvar({ ...base(ID_SOLDA), produtividadeCategorias: [], produtividadeAros: [], produtividadeFormatos: [], produtividadeFundos: [] });
    expect(await linha(ID_SOLDA)).toMatchObject({ produtividadeCategorias: [], produtividadeAros: [], produtividadeFormatos: [], produtividadeFundos: [] });
  });

  it("recusa aro sem Frontlight, repetidos e valores fora da lista", async () => {
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeCategorias: ["tradicional"], produtividadeAros: ["normal"] })).rejects.toThrow(/só vale para Frontlight/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeAros: ["normal"] })).rejects.toThrow(/só vale para Frontlight/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeFormatos: ["cursiva", "cursiva"] })).rejects.toThrow(/formatos repetidos/);
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeFundos: ["meio_fundo" as any] })).rejects.toThrow();
    await expect(gestor().salvar({ ...base(ID_SOLDA), produtividadeCategorias: ["backlight" as any] })).rejects.toThrow();
    await expect(gestor().produtividadeClassificacaoSalvar({ mubisysMateriaPrimaId: ID_SOLDA, produtividadeTiposSolda: [], produtividadeTamanhos: [], produtividadeMateriais: [], produtividadeAros: ["recuado"] })).rejects.toThrow(/só vale para Frontlight/);
  });

  it("matéria-prima que não é produtividade ignora o estilo enviado", async () => {
    for (const id of [ID_GERAL, ID_CHAPA]) {
      await gestor().salvar({ ...base(id), produtividadeCategorias: ["frontlight"], produtividadeAros: ["normal"], produtividadeFormatos: ["cursiva"], produtividadeFundos: ["com_fundo"] });
      expect(await linha(id)).toMatchObject({ produtividadeCategorias: [], produtividadeAros: [], produtividadeFormatos: [], produtividadeFundos: [] });
    }
  });

  it("só gestor, admin e master gravam o estilo", async () => {
    await expect(materiasPrimasRouter.createCaller(ctxVendas).salvar({ ...base(ID_SOLDA), produtividadeCategorias: ["frontlight"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("mão de obra (produtividade) não tem peso específico", () => {
  beforeAll(preparar);
  afterAll(limpar);

  it("produtividade ignora o peso específico enviado; matéria-prima comum continua guardando", async () => {
    await gestor().salvar({ ...base(ID_SOLDA), pesoEspecificoKg: 0.35 });
    expect((await linha(ID_SOLDA)).pesoEspecificoKg).toBeNull();
    await gestor().salvar({ ...base(ID_CHAPA), pesoEspecificoKg: 0.35 });
    expect((await linha(ID_CHAPA)).pesoEspecificoKg).toBe(0.35);
  });

  it("a categoria 'Produtividade para soldar' (migration 0093) também tira o peso, mesmo em matéria-prima de outro nome", async () => {
    const db = await getDb();
    const [categoria] = await db!.select().from(materiaPrimaCategorias).where(eq(materiaPrimaCategorias.nome, "Produtividade para soldar"));
    expect(categoria).toBeDefined();
    expect(categoria).toMatchObject({ usaDadosChapa: false, usaDadosBobina: false, usaDadosPerfil: false });
    await gestor().salvar({ ...base(ID_CHAPA), categoriaId: categoria.id, pesoEspecificoKg: 0.35 });
    expect((await linha(ID_CHAPA)).pesoEspecificoKg).toBeNull();
  });
});
