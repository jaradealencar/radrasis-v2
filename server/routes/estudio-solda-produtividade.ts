import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { cpqSoldaCorrecoes, cpqSoldaRegras, estudioKits, materiaPrimaCadastros } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import { listarMateriasPrimas, type MubiSysMateriaPrima } from "../integrations/mubisys-client";
import {
  ehMateriaProdutividade,
  ehMaterialSolda,
  ehTamanhoProdutividade,
  normalizarTamanhosProdutividade,
  erroTiposSolda,
  MATERIAIS_SOLDA,
  normalizarMateriaisSolda,
  normalizarTiposSolda,
  TAMANHOS_PRODUTIVIDADE,
  TIPOS_SOLDA,
} from "../../shared/produtividade-solda";
import {
  detectarMaterialLetreiro,
  sugerirProdutividades,
  type CandidataSolda,
  type OpcaoSolda,
  type RegraSolda,
} from "../services/cpqSoldaProdutividade";

type BancoDeDados = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const chaveKitSchema = z.string().regex(/^\d+_\d+$/);

const sugerirInput = z.object({
  /** `produtoId_modeloId` do kit; dele saem a subcategoria, o tipo e as produtividades relacionadas ao produto. */
  chaveKit: chaveKitSchema.nullable().optional(),
  titulo: z.string().trim().max(512).default(""),
  /** Usados só quando não há kit (simulador); com kit valem os cadastrados nele. */
  subcategoria: z.string().trim().max(100).nullable().optional(),
  tipoProduto: z.string().trim().max(100).nullable().optional(),
  nomesComposicao: z.array(z.string().max(256)).max(300).default([]),
  tiposFixacao: z.array(z.enum(TIPOS_SOLDA)).max(3).default([]),
  materialManual: z.enum(MATERIAIS_SOLDA).nullable().optional(),
  faixas: z.array(z.object({
    faixa: z.enum(TAMANHOS_PRODUTIVIDADE),
    perimetroM: z.number().finite().min(0).max(100_000),
    elementos: z.number().int().min(0).max(100_000),
  }).strict()).min(1).max(2),
}).strict().superRefine((input, context) => {
  const erroFixacao = erroTiposSolda(input.tiposFixacao);
  if (erroFixacao) context.addIssue({ code: "custom", path: ["tiposFixacao"], message: erroFixacao });
  if (new Set(input.faixas.map(item => item.faixa)).size !== input.faixas.length)
    context.addIssue({ code: "custom", path: ["faixas"], message: "Cada faixa de altura só pode aparecer uma vez." });
});

const correcaoInput = z.object({
  cotacaoRef: z.string().trim().max(80).nullable().optional(),
  faixa: z.enum(TAMANHOS_PRODUTIVIDADE),
  contexto: z.object({
    chaveKit: chaveKitSchema.nullable().optional(),
    titulo: z.string().max(512).default(""),
    subcategoria: z.string().max(100).nullable().optional(),
    tipoProduto: z.string().max(100).nullable().optional(),
    material: z.enum(MATERIAIS_SOLDA).nullable().optional(),
    tiposFixacao: z.array(z.enum(TIPOS_SOLDA)).max(3).default([]),
    perimetroM: z.number().finite().min(0).max(100_000).optional(),
    elementos: z.number().int().min(0).max(100_000).optional(),
  }).strict(),
  sugeridaId: z.number().int().positive().nullable().optional(),
  escolhidaId: z.number().int().positive(),
  nota: z.string().trim().max(500).nullable().optional(),
}).strict();

const regraCampos = z.object({
  nome: z.string().trim().min(1).max(160),
  ativa: z.boolean().default(true),
  prioridade: z.number().int().min(-1000).max(1000).default(0),
  material: z.enum(MATERIAIS_SOLDA).nullable().default(null),
  tipoProduto: z.string().trim().max(80).nullable().default(null),
  fixacaoTipos: z.array(z.enum(TIPOS_SOLDA)).max(3).nullable().default(null),
  palavrasTitulo: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  faixa: z.enum(TAMANHOS_PRODUTIVIDADE).nullable().default(null),
  materiaPrimaId: z.number().int().positive(),
}).strict();

function validarRegra(regra: z.infer<typeof regraCampos>, context: z.RefinementCtx): void {
  const semCondicao = !regra.material && !regra.tipoProduto && !regra.fixacaoTipos && !regra.palavrasTitulo.length && !regra.faixa;
  if (semCondicao) context.addIssue({ code: "custom", message: "Informe ao menos uma condição: uma regra sem condições valeria para todos os orçamentos." });
  const erroFixacao = regra.fixacaoTipos ? erroTiposSolda(regra.fixacaoTipos) : null;
  if (erroFixacao) context.addIssue({ code: "custom", path: ["fixacaoTipos"], message: erroFixacao });
}

const regraInput = regraCampos.superRefine(validarRegra);

const regraDeCorrecaoInput = z.object({
  nome: z.string().trim().min(1).max(160).optional(),
  prioridade: z.number().int().min(-1000).max(1000).default(10),
  usarMaterial: z.boolean().default(true),
  usarFixacao: z.boolean().default(true),
  usarFaixa: z.boolean().default(true),
  usarTipoProduto: z.boolean().default(false),
  palavrasTitulo: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
}).strict();

const atualizarCorrecaoInput = z.object({ status: z.enum(["pendente", "descartada"]) }).strict();

function erro(res: Response, status: number, mensagem: string): void {
  res.status(status).json({ error: mensagem });
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Origem inválida é rejeitada abaixo.
  }
  erro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

async function obterSessao(req: Request, res: Response) {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!sessao) erro(res, 401, "Entre no Radrasys para usar a produtividade de solda do CPQ.");
  return sessao;
}

async function exigirGestor(req: Request, res: Response) {
  const sessao = await obterSessao(req, res);
  if (!sessao) return null;
  if (!["admin", "master", "gestor"].includes(String(sessao.user.role ?? ""))) {
    erro(res, 403, "Somente gestor, admin ou master pode treinar a produtividade de solda.");
    return null;
  }
  return sessao;
}

function rota(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((falha: unknown) => {
      console.error("[EstudioSolda] Falha na rota:", falha);
      if (!res.headersSent) erro(res, 500, "Não foi possível concluir a operação de produtividade de solda agora.");
    });
  };
}

function mensagemZod(falha: z.ZodError): string {
  return falha.issues[0]?.message || "Confira os dados enviados.";
}

// O catálogo do MubiSys é paginado e lento; a escolha é refeita a cada mudança de escala ou de fixação.
const VALIDADE_CATALOGO_MS = 60_000;
let catalogoEmCache: { em: number; itens: MubiSysMateriaPrima[] } | null = null;

async function catalogoDeProdutividades(): Promise<MubiSysMateriaPrima[]> {
  if (catalogoEmCache && Date.now() - catalogoEmCache.em < VALIDADE_CATALOGO_MS) return catalogoEmCache.itens;
  const todas = await listarMateriasPrimas();
  const itens = todas.filter(materia => ehMateriaProdutividade(materia.nome) && !/inativ/i.test(String(materia.status ?? "")));
  catalogoEmCache = { em: Date.now(), itens };
  return itens;
}

interface DadosKit {
  subcategoria: string | null;
  tipoProduto: string | null;
  relacionadas: number[];
}

async function dadosDoKit(db: BancoDeDados, chaveKit: string | null | undefined): Promise<DadosKit | null> {
  if (!chaveKit) return null;
  const [kit] = await db.select({ dadosJson: estudioKits.dadosJson }).from(estudioKits).where(eq(estudioKits.chave, chaveKit));
  if (!kit) return null;
  const dados = kit.dadosJson ?? {};
  const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);
  const relacionadas = Array.isArray(dados.produtividadesRelacionadas)
    ? dados.produtividadesRelacionadas.filter((id): id is number => Number.isInteger(id) && id > 0)
    : [];
  return { subcategoria: texto(dados.subcategoria), tipoProduto: texto(dados.tipoProduto), relacionadas };
}

type CandidataComCusto = CandidataSolda & { unidade: string; valor: number; atualizado: string; status: string };

async function carregarCandidatas(db: BancoDeDados, relacionadas: number[]): Promise<{ candidatas: CandidataComCusto[]; lista: "relacionadas" | "todas" }> {
  const catalogo = await catalogoDeProdutividades();
  const escolhidas = relacionadas.length ? catalogo.filter(materia => relacionadas.includes(materia.id)) : [];
  // Produto sem produtividades relacionadas (ou com todas fora do catálogo): vale o cadastro inteiro.
  const lista = escolhidas.length ? "relacionadas" : "todas";
  const materias = escolhidas.length ? escolhidas : catalogo;
  const ids = materias.map(materia => materia.id);
  const cadastros = ids.length
    ? await db.select({
        id: materiaPrimaCadastros.mubisysMateriaPrimaId,
        tipos: materiaPrimaCadastros.produtividadeTiposSolda,
        tamanhos: materiaPrimaCadastros.produtividadeTamanhos,
        materiais: materiaPrimaCadastros.produtividadeMateriais,
      }).from(materiaPrimaCadastros).where(inArray(materiaPrimaCadastros.mubisysMateriaPrimaId, ids))
    : [];
  const cadastroPorId = new Map(cadastros.map(cadastro => [cadastro.id, cadastro]));
  const candidatas = materias.map(materia => {
    const cadastro = cadastroPorId.get(materia.id);
    return {
      id: materia.id,
      nome: materia.nome,
      tiposSolda: normalizarTiposSolda(cadastro?.tipos),
      tamanhos: normalizarTamanhosProdutividade(cadastro?.tamanhos),
      materiais: normalizarMateriaisSolda(cadastro?.materiais),
      unidade: String(materia.unidade_movimentacao || materia.unidade_custo || ""),
      valor: Number(materia.valor_custo) || 0,
      atualizado: String(materia.data_referencia || ""),
      status: String(materia.status || ""),
    };
  });
  return { candidatas, lista };
}

function regraDoBanco(linha: typeof cpqSoldaRegras.$inferSelect): RegraSolda {
  return {
    id: linha.id,
    nome: linha.nome,
    ativa: linha.ativa,
    prioridade: linha.prioridade,
    material: ehMaterialSolda(linha.material) ? linha.material : null,
    tipoProduto: linha.tipoProduto,
    fixacaoTipos: linha.fixacaoTipos ? normalizarTiposSolda(linha.fixacaoTipos) : null,
    palavrasTitulo: linha.palavrasTitulo ?? [],
    faixa: ehTamanhoProdutividade(linha.faixa) ? linha.faixa : null,
    materiaPrimaId: linha.mubisysMateriaPrimaId,
  };
}

function descricaoRegra(linha: typeof cpqSoldaRegras.$inferSelect) {
  return {
    id: linha.id,
    nome: linha.nome,
    ativa: linha.ativa,
    prioridade: linha.prioridade,
    material: ehMaterialSolda(linha.material) ? linha.material : null,
    tipoProduto: linha.tipoProduto,
    fixacaoTipos: linha.fixacaoTipos ? normalizarTiposSolda(linha.fixacaoTipos) : null,
    palavrasTitulo: linha.palavrasTitulo ?? [],
    faixa: ehTamanhoProdutividade(linha.faixa) ? linha.faixa : null,
    materiaPrimaId: linha.mubisysMateriaPrimaId,
    criadaPorNome: linha.criadaPorNome,
    createdAt: linha.createdAt,
    updatedAt: linha.updatedAt,
  };
}

/** Cada opção sai com os dados que o CPQ precisa para montar a linha da composição (iguais aos de /api/letra-caixa/catalogo). */
function comCusto(opcao: OpcaoSolda, porId: Map<number, CandidataComCusto>) {
  const candidata = porId.get(opcao.id);
  return { ...opcao, unidade: candidata?.unidade ?? "", valor: candidata?.valor ?? 0, atualizado: candidata?.atualizado ?? "", status: candidata?.status ?? "" };
}

async function sugerir(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await obterSessao(req, res))) return;
  await responderSugestao(req, res);
}

async function simular(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  await responderSugestao(req, res);
}

async function responderSugestao(req: Request, res: Response): Promise<void> {
  const parsed = sugerirInput.safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, mensagemZod(parsed.error));
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const entrada = parsed.data;

  const kit = await dadosDoKit(db, entrada.chaveKit);
  const subcategoria = kit?.subcategoria ?? entrada.subcategoria ?? null;
  const tipoProduto = kit?.tipoProduto ?? entrada.tipoProduto ?? null;
  const deteccao = detectarMaterialLetreiro({ subcategoria, tipoProduto, titulo: entrada.titulo, nomesComposicao: entrada.nomesComposicao });
  const material = entrada.materialManual ?? deteccao.material;

  let carregadas: Awaited<ReturnType<typeof carregarCandidatas>>;
  try {
    carregadas = await carregarCandidatas(db, kit?.relacionadas ?? []);
  } catch (falha) {
    console.error("[EstudioSolda] Falha ao consultar as produtividades no MubiSys:", falha);
    return void erro(res, 502, "Não foi possível consultar as produtividades de solda no MubiSys agora.");
  }
  const regras = (await db.select().from(cpqSoldaRegras).where(eq(cpqSoldaRegras.ativa, true))).map(regraDoBanco);
  const sugestoes = sugerirProdutividades(
    { tiposFixacao: entrada.tiposFixacao, titulo: entrada.titulo, tipoProduto, material },
    entrada.faixas,
    carregadas.candidatas,
    regras,
  );
  const porId = new Map(carregadas.candidatas.map(candidata => [candidata.id, candidata]));

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    material: { ...deteccao, usado: material, manual: entrada.materialManual != null },
    subcategoria,
    tipoProduto,
    lista: carregadas.lista,
    totalCandidatas: carregadas.candidatas.length,
    faixas: sugestoes.map(sugestao => ({
      ...sugestao,
      escolhida: sugestao.escolhida ? comCusto(sugestao.escolhida, porId) : null,
      alternativas: sugestao.alternativas.map(opcao => comCusto(opcao, porId)),
    })),
  });
}

async function registrarCorrecao(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const sessao = await obterSessao(req, res);
  if (!sessao) return;
  const parsed = correcaoInput.safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, mensagemZod(parsed.error));
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const { contexto, faixa, sugeridaId, escolhidaId, nota, cotacaoRef } = parsed.data;
  if (sugeridaId != null && sugeridaId === escolhidaId) return void erro(res, 400, "A produtividade escolhida é a mesma que foi sugerida.");

  let catalogo: MubiSysMateriaPrima[];
  try {
    catalogo = await catalogoDeProdutividades();
  } catch (falha) {
    console.error("[EstudioSolda] Falha ao conferir a produtividade no MubiSys:", falha);
    return void erro(res, 502, "Não foi possível confirmar a produtividade no MubiSys agora.");
  }
  if (!catalogo.some(materia => materia.id === escolhidaId)) return void erro(res, 400, "A matéria-prima escolhida não é uma produtividade de solda do catálogo.");

  const [criada] = await db.insert(cpqSoldaCorrecoes).values({
    cotacaoRef: cotacaoRef ?? null,
    faixa,
    contextoJson: contexto,
    sugeridaMateriaPrimaId: sugeridaId ?? null,
    escolhidaMateriaPrimaId: escolhidaId,
    nota: nota || null,
    usuarioNome: String(sessao.user.name ?? "").slice(0, 160) || null,
  }).returning({ id: cpqSoldaCorrecoes.id });
  res.status(201).json({ id: criada.id });
}

async function listarRegras(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const linhas = await db.select().from(cpqSoldaRegras).orderBy(desc(cpqSoldaRegras.prioridade), desc(cpqSoldaRegras.id));
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ regras: linhas.map(descricaoRegra) });
}

function valoresDaRegra(dados: z.infer<typeof regraInput>) {
  return {
    nome: dados.nome,
    ativa: dados.ativa,
    prioridade: dados.prioridade,
    material: dados.material,
    tipoProduto: dados.tipoProduto || null,
    fixacaoTipos: dados.fixacaoTipos ? normalizarTiposSolda(dados.fixacaoTipos) : null,
    palavrasTitulo: dados.palavrasTitulo,
    faixa: dados.faixa,
    mubisysMateriaPrimaId: dados.materiaPrimaId,
  };
}

async function criarRegra(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const sessao = await exigirGestor(req, res);
  if (!sessao) return;
  const parsed = regraInput.safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, mensagemZod(parsed.error));
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [criada] = await db.insert(cpqSoldaRegras).values({
    ...valoresDaRegra(parsed.data),
    criadaPorNome: String(sessao.user.name ?? "").slice(0, 160) || null,
  }).returning();
  res.status(201).json({ regra: descricaoRegra(criada) });
}

function idDaRota(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function atualizarRegra(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const id = idDaRota(req);
  if (!id) return void erro(res, 400, "Regra inválida.");
  const parsed = regraInput.safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, mensagemZod(parsed.error));
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [atualizada] = await db.update(cpqSoldaRegras).set({ ...valoresDaRegra(parsed.data), updatedAt: new Date() }).where(eq(cpqSoldaRegras.id, id)).returning();
  if (!atualizada) return void erro(res, 404, "Regra não encontrada.");
  res.json({ regra: descricaoRegra(atualizada) });
}

async function excluirRegra(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const id = idDaRota(req);
  if (!id) return void erro(res, 400, "Regra inválida.");
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [removida] = await db.delete(cpqSoldaRegras).where(eq(cpqSoldaRegras.id, id)).returning({ id: cpqSoldaRegras.id });
  if (!removida) return void erro(res, 404, "Regra não encontrada.");
  res.json({ ok: true });
}

async function listarCorrecoes(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const status = typeof req.query.status === "string" && ["pendente", "virou_regra", "descartada"].includes(req.query.status) ? req.query.status : null;
  const consulta = db.select().from(cpqSoldaCorrecoes);
  const linhas = await (status ? consulta.where(eq(cpqSoldaCorrecoes.status, status)) : consulta).orderBy(desc(cpqSoldaCorrecoes.createdAt)).limit(200);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ correcoes: linhas });
}

async function atualizarCorrecao(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res) || !(await exigirGestor(req, res))) return;
  const id = idDaRota(req);
  if (!id) return void erro(res, 400, "Correção inválida.");
  const parsed = atualizarCorrecaoInput.safeParse(req.body);
  if (!parsed.success) return void erro(res, 400, mensagemZod(parsed.error));
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [atual] = await db.select().from(cpqSoldaCorrecoes).where(eq(cpqSoldaCorrecoes.id, id));
  if (!atual) return void erro(res, 404, "Correção não encontrada.");
  if (atual.status === "virou_regra") return void erro(res, 409, "Esta correção já virou uma regra.");
  await db.update(cpqSoldaCorrecoes).set({ status: parsed.data.status }).where(eq(cpqSoldaCorrecoes.id, id));
  res.json({ ok: true });
}

/** Transforma a correção do vendedor numa regra: as condições vêm do contexto da correção, as que o gestor desmarcar ficam livres. */
async function regraDaCorrecao(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const sessao = await exigirGestor(req, res);
  if (!sessao) return;
  const id = idDaRota(req);
  if (!id) return void erro(res, 400, "Correção inválida.");
  const parsed = regraDeCorrecaoInput.safeParse(req.body ?? {});
  if (!parsed.success) return void erro(res, 400, mensagemZod(parsed.error));
  const db = await getDb();
  if (!db) return void erro(res, 503, "O banco de dados está indisponível.");
  const [correcao] = await db.select().from(cpqSoldaCorrecoes).where(eq(cpqSoldaCorrecoes.id, id));
  if (!correcao) return void erro(res, 404, "Correção não encontrada.");
  if (correcao.status === "virou_regra") return void erro(res, 409, "Esta correção já virou uma regra.");

  const contexto = correcao.contextoJson as { material?: unknown; tipoProduto?: unknown; tiposFixacao?: unknown };
  const opcoes = parsed.data;
  const material = opcoes.usarMaterial && ehMaterialSolda(contexto.material) ? contexto.material : null;
  const tipoProduto = opcoes.usarTipoProduto && typeof contexto.tipoProduto === "string" && contexto.tipoProduto.trim() ? contexto.tipoProduto.trim().slice(0, 80) : null;
  const fixacao = opcoes.usarFixacao ? normalizarTiposSolda(contexto.tiposFixacao) : [];
  const faixa = opcoes.usarFaixa && ehTamanhoProdutividade(correcao.faixa) ? correcao.faixa : null;
  const nova = {
    nome: opcoes.nome ?? `Correção #${correcao.id}`,
    ativa: true,
    prioridade: opcoes.prioridade,
    material,
    tipoProduto,
    fixacaoTipos: fixacao.length ? fixacao : null,
    palavrasTitulo: opcoes.palavrasTitulo,
    faixa,
    materiaPrimaId: correcao.escolhidaMateriaPrimaId,
  };
  const valida = regraInput.safeParse(nova);
  if (!valida.success) return void erro(res, 400, mensagemZod(valida.error));

  const regra = await db.transaction(async tx => {
    const [criada] = await tx.insert(cpqSoldaRegras).values({
      ...valoresDaRegra(valida.data),
      criadaPorNome: String(sessao.user.name ?? "").slice(0, 160) || null,
    }).returning();
    await tx.update(cpqSoldaCorrecoes).set({ status: "virou_regra", regraId: criada.id }).where(eq(cpqSoldaCorrecoes.id, id));
    return criada;
  });
  res.status(201).json({ regra: descricaoRegra(regra) });
}

export function registrarRotasEstudioSoldaProdutividade(app: Express): void {
  app.post("/api/letra-caixa/solda/sugerir", rota(sugerir));
  app.post("/api/letra-caixa/solda/simular", rota(simular));
  app.post("/api/letra-caixa/solda/correcoes", rota(registrarCorrecao));
  app.get("/api/letra-caixa/solda/regras", rota(listarRegras));
  app.post("/api/letra-caixa/solda/regras", rota(criarRegra));
  app.put("/api/letra-caixa/solda/regras/:id", rota(atualizarRegra));
  app.delete("/api/letra-caixa/solda/regras/:id", rota(excluirRegra));
  app.get("/api/letra-caixa/solda/correcoes", rota(listarCorrecoes));
  app.put("/api/letra-caixa/solda/correcoes/:id", rota(atualizarCorrecao));
  app.post("/api/letra-caixa/solda/correcoes/:id/regra", rota(regraDaCorrecao));
}
