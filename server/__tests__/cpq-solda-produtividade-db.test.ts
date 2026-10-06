import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cpqSoldaCorrecoes, cpqSoldaRegras, estudioKits, materiaPrimaCadastros } from "../../drizzle/schema";

/**
 * Rotas de produtividade de solda do CPQ contra o banco de testes do .env (ids fictícios 987_654_7xx, apagados no final).
 * A sessão e o catálogo do MubiSys são simulados.
 */
const simulado = vi.hoisted(() => ({
  sessao: null as null | { user: { id: string; name: string; role: string } },
  listar: vi.fn(),
}));
vi.mock("../_core/auth", () => ({ auth: { api: { getSession: async () => simulado.sessao } } }));
vi.mock("../integrations/mubisys-client", async importOriginal => ({
  ...(await importOriginal<typeof import("../integrations/mubisys-client")>()),
  listarMateriasPrimas: simulado.listar,
}));

const { getDb } = await import("../db/db");
const { registrarRotasEstudioSoldaProdutividade } = await import("../routes/estudio-solda-produtividade");

const CHAVE_COM = "987654701_1";
const CHAVE_SEM = "987654701_2";
const GAL_GRANDE = 987_654_711;
const GAL_PEQUENA = 987_654_712;
const INOX_GRANDE = 987_654_713;
const FORA_DO_PRODUTO = 987_654_714; // melhor encaixe, mas o produto não a relaciona
const IDS = [GAL_GRANDE, GAL_PEQUENA, INOX_GRANDE, FORA_DO_PRODUTO];

const vendedor = { user: { id: "u-vendas", name: "Vendedora Teste", role: "vendas" } };
const gestor = { user: { id: "u-gestor", name: "Gestor Teste", role: "gestor" } };

let servidor: Server;
let base = "";

const chamar = (metodo: string, caminho: string, corpo?: unknown) =>
  fetch(`${base}/api/letra-caixa/solda${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

const pedido = (extra: Record<string, unknown> = {}) => ({
  chaveKit: CHAVE_COM,
  titulo: "Letreiro Letra Caixa",
  nomesComposicao: ["Chapa Galvanizada"],
  tiposFixacao: ["barra_roscada"],
  faixas: [
    { faixa: "ate_11cm", perimetroM: 3.2, elementos: 6 },
    { faixa: "acima_11cm", perimetroM: 12.5, elementos: 8 },
  ],
  ...extra,
});

const limpar = async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(cpqSoldaCorrecoes).where(inArray(cpqSoldaCorrecoes.escolhidaMateriaPrimaId, IDS));
  await db.delete(cpqSoldaRegras).where(inArray(cpqSoldaRegras.mubisysMateriaPrimaId, IDS));
  await db.delete(estudioKits).where(inArray(estudioKits.chave, [CHAVE_COM, CHAVE_SEM]));
  await db.delete(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, IDS));
};

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("banco indisponível");
  await limpar();
  const kit = (extra: Record<string, unknown>) => ({ linhas: [], categoria: "Letreiros", subcategoria: "Galvanizado", ...extra });
  await db.insert(estudioKits).values([
    { chave: CHAVE_COM, produtoId: 987654701, modeloId: 1, dadosJson: kit({ produtividadesRelacionadas: [GAL_GRANDE, GAL_PEQUENA, INOX_GRANDE] }) },
    { chave: CHAVE_SEM, produtoId: 987654701, modeloId: 2, dadosJson: kit({}) },
  ]);
  const cadastro = (id: number, tipos: string[], tamanho: string, materiais: string[]) => ({
    mubisysMateriaPrimaId: id, produtividadeTiposSolda: tipos, produtividadeTamanho: tamanho, produtividadeMateriais: materiais,
  });
  await db.insert(materiaPrimaCadastros).values([
    cadastro(GAL_GRANDE, ["barra_roscada"], "acima_11cm", ["galvanizado"]),
    cadastro(GAL_PEQUENA, ["barra_roscada"], "ate_11cm", ["galvanizado"]),
    cadastro(INOX_GRANDE, ["barra_roscada"], "acima_11cm", ["inox"]),
    cadastro(FORA_DO_PRODUTO, ["barra_roscada"], "acima_11cm", ["galvanizado"]),
  ]);
  const app = express();
  app.use(express.json());
  registrarRotasEstudioSoldaProdutividade(app);
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  servidor?.close();
  await limpar();
});

beforeEach(() => {
  simulado.sessao = vendedor;
  simulado.listar.mockReset();
  simulado.listar.mockResolvedValue([
    { id: GAL_GRANDE, nome: "Produtividade Solda 1º [R$7,50] [Galvanizado Padrão]", unidade_custo: "Unidade/Gl/Lt/Kg", unidade_movimentacao: "Unidade/Gl/Lt/Kg", valor_custo: 7.5, data_referencia: "2026-10-01", status: "Ativo" },
    { id: GAL_PEQUENA, nome: "Produtividade Solda 33º [R$18,50] [Menor ou igual a 11cm] [Gal]", unidade_custo: "Unidade/Gl/Lt/Kg", unidade_movimentacao: "Unidade/Gl/Lt/Kg", valor_custo: 18.5, data_referencia: "2026-10-01", status: "Ativo" },
    { id: INOX_GRANDE, nome: "Produtividade Solda 3º [R$11,25] [Inox Padrão]", unidade_custo: "Unidade/Gl/Lt/Kg", unidade_movimentacao: "Unidade/Gl/Lt/Kg", valor_custo: 11.25, data_referencia: "2026-10-01", status: "Ativo" },
    { id: FORA_DO_PRODUTO, nome: "Produtividade Solda 98º [R$7,00] [Galvanizado Padrão]", unidade_custo: "Unidade/Gl/Lt/Kg", unidade_movimentacao: "Unidade/Gl/Lt/Kg", valor_custo: 7, data_referencia: "2026-10-01", status: "Ativo" },
    { id: 987_654_719, nome: "Produtividade Solda 97º [Inativa]", unidade_custo: "Unidade/Gl/Lt/Kg", unidade_movimentacao: "Unidade/Gl/Lt/Kg", valor_custo: 1, data_referencia: "2026-10-01", status: "Inativo" },
    { id: 987_654_718, nome: "Produtividade Geral - Hora", unidade_custo: "Hora", unidade_movimentacao: "Hora", valor_custo: 18.5, data_referencia: "2026-10-01", status: "Ativo" },
    { id: 987_654_717, nome: "Chapa de teste", unidade_custo: "Metro quadrado", unidade_movimentacao: "Metro quadrado", valor_custo: 100, data_referencia: "2026-10-01", status: "Ativo" },
  ]);
});

describe("POST /solda/sugerir", () => {
  it("exige sessão", async () => {
    simulado.sessao = null;
    expect((await chamar("POST", "/sugerir", pedido())).status).toBe(401);
  });

  it("usa as produtividades relacionadas ao produto e devolve custo e unidade para montar a linha", async () => {
    const resposta = await chamar("POST", "/sugerir", pedido());
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.lista).toBe("relacionadas");
    expect(corpo.totalCandidatas).toBe(3);
    expect(corpo.material).toMatchObject({ usado: "galvanizado", origem: "subcategoria" });

    const [ate, acima] = corpo.faixas;
    expect(ate).toMatchObject({ faixa: "ate_11cm", necessaria: true, perimetroM: 3.2, origem: "heuristica" });
    expect(ate.escolhida).toMatchObject({ id: GAL_PEQUENA, valor: 18.5, unidade: "Unidade/Gl/Lt/Kg", status: "Ativo" });
    // A 98º encaixa tão bem quanto a 1º, mas o produto não a relaciona: não pode ser escolhida nem alternativa.
    expect(acima.escolhida.id).toBe(GAL_GRANDE);
    expect([acima.escolhida.id, ...acima.alternativas.map((item: { id: number }) => item.id)]).not.toContain(FORA_DO_PRODUTO);
  });

  it("produto sem produtividades relacionadas usa o cadastro inteiro (sem as inativas nem as 'Geral')", async () => {
    const corpo = await (await chamar("POST", "/sugerir", pedido({ chaveKit: CHAVE_SEM }))).json();
    expect(corpo.lista).toBe("todas");
    expect(corpo.totalCandidatas).toBe(4);
    const ids = corpo.faixas.flatMap((faixa: { escolhida: { id: number } | null; alternativas: { id: number }[] }) => [faixa.escolhida?.id, ...faixa.alternativas.map(item => item.id)]);
    expect(ids).not.toContain(987_654_719);
    expect(ids).not.toContain(987_654_718);
  });

  it("o material manual vence a detecção", async () => {
    const corpo = await (await chamar("POST", "/sugerir", pedido({ materialManual: "inox" }))).json();
    expect(corpo.material).toMatchObject({ usado: "inox", manual: true });
    expect(corpo.faixas[1].escolhida.id).toBe(INOX_GRANDE);
  });

  it("recusa pedido inválido com mensagem clara", async () => {
    const semFaixas = await chamar("POST", "/sugerir", pedido({ faixas: [] }));
    expect(semFaixas.status).toBe(400);
    const fixacaoInvalida = await chamar("POST", "/sugerir", pedido({ tiposFixacao: ["sem_fixacao", "orelhinha"] }));
    expect(fixacaoInvalida.status).toBe(400);
    expect((await fixacaoInvalida.json()).error).toContain("Sem fixação");
    const faixaRepetida = await chamar("POST", "/sugerir", pedido({ faixas: [{ faixa: "ate_11cm", perimetroM: 1, elementos: 1 }, { faixa: "ate_11cm", perimetroM: 2, elementos: 2 }] }));
    expect(faixaRepetida.status).toBe(400);
  });
});

describe("correções e regras treináveis", () => {
  it("só gestor, admin ou master mantém regras e correções", async () => {
    simulado.sessao = vendedor;
    expect((await chamar("GET", "/regras")).status).toBe(403);
    expect((await chamar("GET", "/correcoes")).status).toBe(403);
    expect((await chamar("POST", "/simular", pedido())).status).toBe(403);
    expect((await chamar("POST", "/regras", { nome: "x", faixa: "ate_11cm", materiaPrimaId: GAL_PEQUENA })).status).toBe(403);
  });

  it("regra sem nenhuma condição é recusada", async () => {
    simulado.sessao = gestor;
    const resposta = await chamar("POST", "/regras", { nome: "Vale para tudo", materiaPrimaId: GAL_GRANDE });
    expect(resposta.status).toBe(400);
    expect((await resposta.json()).error).toContain("ao menos uma condição");
  });

  it("cria, edita, simula e exclui uma regra", async () => {
    simulado.sessao = gestor;
    const criada = await chamar("POST", "/regras", { nome: "Galvanizado grande no inox", material: "inox", faixa: "acima_11cm", fixacaoTipos: ["barra_roscada"], materiaPrimaId: GAL_GRANDE });
    expect(criada.status).toBe(201);
    const { regra } = await criada.json();

    const simulada = await (await chamar("POST", "/simular", pedido({ materialManual: "inox" }))).json();
    expect(simulada.faixas[1]).toMatchObject({ origem: "regra", regraId: regra.id, confianca: "alta" });
    expect(simulada.faixas[1].escolhida.id).toBe(GAL_GRANDE);

    const editada = await chamar("PUT", `/regras/${regra.id}`, { nome: "Regra desligada", ativa: false, material: "inox", faixa: "acima_11cm", materiaPrimaId: GAL_GRANDE });
    expect(editada.status).toBe(200);
    const depois = await (await chamar("POST", "/simular", pedido({ materialManual: "inox" }))).json();
    expect(depois.faixas[1].origem).toBe("heuristica");

    const lista = await (await chamar("GET", "/regras")).json();
    expect(lista.regras.some((item: { id: number }) => item.id === regra.id)).toBe(true);
    expect((await chamar("DELETE", `/regras/${regra.id}`)).status).toBe(200);
    expect((await chamar("DELETE", `/regras/${regra.id}`)).status).toBe(404);
  });

  it("a troca do vendedor vira correção e o gestor a transforma em regra que passa a valer", async () => {
    // O vendedor achou que, neste produto, o certo para letras grandes em galvanizado é a produtividade do inox.
    simulado.sessao = vendedor;
    const contexto = { chaveKit: CHAVE_COM, titulo: "Letreiro Letra Caixa", subcategoria: "Galvanizado", material: "galvanizado", tiposFixacao: ["barra_roscada"], perimetroM: 12.5, elementos: 8 };
    const registrada = await chamar("POST", "/correcoes", { faixa: "acima_11cm", contexto, sugeridaId: GAL_GRANDE, escolhidaId: INOX_GRANDE, nota: "Fundo e aro em inox" });
    expect(registrada.status).toBe(201);
    const { id } = await registrada.json();

    // Nada de trocar para o que já foi sugerido, nem para algo que não é produtividade.
    expect((await chamar("POST", "/correcoes", { faixa: "acima_11cm", contexto, sugeridaId: INOX_GRANDE, escolhidaId: INOX_GRANDE })).status).toBe(400);
    expect((await chamar("POST", "/correcoes", { faixa: "acima_11cm", contexto, sugeridaId: null, escolhidaId: 987_654_717 })).status).toBe(400);

    simulado.sessao = gestor;
    const pendentes = await (await chamar("GET", "/correcoes?status=pendente")).json();
    expect(pendentes.correcoes.find((item: { id: number }) => item.id === id)).toMatchObject({ escolhidaMateriaPrimaId: INOX_GRANDE, usuarioNome: "Vendedora Teste", status: "pendente" });

    const virada = await chamar("POST", `/correcoes/${id}/regra`, { nome: "Galvanizado com aro inox", palavrasTitulo: ["letra caixa"] });
    expect(virada.status).toBe(201);
    const { regra } = await virada.json();
    expect(regra).toMatchObject({ material: "galvanizado", faixa: "acima_11cm", fixacaoTipos: ["barra_roscada"], palavrasTitulo: ["letra caixa"], materiaPrimaId: INOX_GRANDE });

    // Mesmo produto, mesma configuração: agora a regra decide.
    simulado.sessao = vendedor;
    const depois = await (await chamar("POST", "/sugerir", pedido())).json();
    expect(depois.faixas[1]).toMatchObject({ origem: "regra", regraId: regra.id });
    expect(depois.faixas[1].escolhida.id).toBe(INOX_GRANDE);

    simulado.sessao = gestor;
    expect((await chamar("POST", `/correcoes/${id}/regra`, {})).status).toBe(409);
    const db = await getDb();
    const [linha] = await db!.select().from(cpqSoldaCorrecoes).where(eq(cpqSoldaCorrecoes.id, id));
    expect(linha).toMatchObject({ status: "virou_regra", regraId: regra.id });
  });

  it("descartar uma correção a tira dos pendentes", async () => {
    simulado.sessao = vendedor;
    const { id } = await (await chamar("POST", "/correcoes", {
      faixa: "ate_11cm",
      contexto: { titulo: "Letreiro", material: "galvanizado", tiposFixacao: ["orelhinha"] },
      sugeridaId: GAL_PEQUENA,
      escolhidaId: GAL_GRANDE,
    })).json();
    simulado.sessao = gestor;
    expect((await chamar("PUT", `/correcoes/${id}`, { status: "descartada" })).status).toBe(200);
    const pendentes = await (await chamar("GET", "/correcoes?status=pendente")).json();
    expect(pendentes.correcoes.some((item: { id: number }) => item.id === id)).toBe(false);
  });
});
