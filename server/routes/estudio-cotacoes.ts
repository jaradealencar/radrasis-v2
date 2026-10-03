import { randomBytes } from "crypto";
import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { propostas } from "../../drizzle/schema";
import { auth } from "../_core/auth";
import { getDb } from "../db/db";
import {
  aprovarPrecoCalculado,
  aprovarSugestaoPreco,
  hashBasePreco,
  precoContextoSchema,
  sugerirPrecoComGPT,
  verificarAprovacaoPreco,
} from "../services/cpqPrecoAssistente";

const PREFIXO_ESTUDIO = "[ESTUDIO_COTACAO_V1]";
const reacooes = [
  "aprovado",
  "negociar_pagamento",
  "readequar_menor",
  "em_analise",
  "fora_orcamento",
] as const;

const snapshotSchema = z.object({
  dataEmissao: z.string().datetime(),
  validadeDias: z.number().int().min(1).max(365),
  modalidadeFrete: z.enum(["FOB", "CIF", "retira", "entrega"]).nullable(),
  metodoPagamento: z.enum(["boleto", "cartao", "pix", "ted"]).nullable(),
  formasPagamentoPermitidas: z.array(z.enum(["boleto", "cartao", "pix", "ted"])).refine((formas) => formas.includes("pix")).optional().default(["pix", "cartao", "boleto", "ted"]),
  jurosCartaoPct: z.array(z.number().min(0).max(100)).length(6).optional().default([0, 0, 0, 0, 0, 0]),
  cliente: z.object({
    cnpj: z.string().max(20).nullable(),
    razao: z.string().max(256).nullable(),
    fantasia: z.string().max(256).nullable(),
    endereco: z.string().max(1000).nullable(),
    email: z.string().max(320).nullable().optional().default(null),
    whatsapp: z.string().max(40).nullable().optional().default(null),
  }),
  vendedor: z.string().min(1).max(256),
  whatsappVendedor: z.string().max(32).nullable().optional().default(null),
  modeloNome: z.string().min(1).max(256),
  mubisysProdutoId: z.number().int().positive().nullable().optional(),
  mubisysModeloId: z.number().int().positive().nullable().optional(),
  variacoesModelo: z.array(z.object({
    id: z.number().int().positive(),
    nome: z.string().max(256),
  }).strict()).max(100).optional().default([]),
  descricaoProduto: z.string().max(5000).default(""),
  variacoes: z.array(z.object({
    nome: z.string().min(1).max(80),
    valor: z.string().min(1).max(120),
  })).max(100).optional().default([]),
  areaM2: z.number().nonnegative().nullable(),
  areaGeralM2: z.number().nonnegative().nullable(),
  areaTotalNestingM2: z.number().nonnegative().nullable().optional(),
  perimExtM: z.number().nonnegative().nullable().optional(),
  perimTotalM: z.number().nonnegative().nullable().optional(),
  materiais: z.array(z.object({
    mubisysMateriaPrimaId: z.number().int().positive().nullable(),
    nome: z.string().max(256),
    unidade: z.string().max(80),
    custoUnitario: z.number().nonnegative(),
    quantidade: z.number().nonnegative(),
    custoTotal: z.number().nonnegative(),
    formulaType: z.string().max(40),
    multiplicador: z.number().nonnegative(),
    variacaoModeloId: z.number().int().positive().nullable(),
    variacaoModeloNome: z.string().max(256).nullable(),
    variacaoMaterial: z.object({
      nome: z.string().max(80),
      valor: z.string().max(120),
      materiaPrimaNome: z.string().max(256),
    }).nullable(),
  }).strict()).max(300).optional().default([]),
  custoMateriais: z.number().finite().nonnegative(),
  custoFixo: z.number().finite().nonnegative(),
  custoServicos: z.number().finite().nonnegative(),
  custoDireto: z.number().finite().nonnegative(),
  precoCalculado: z.number().finite().nonnegative(),
  modoPreco: z.enum(["margem", "fixo"]),
  margemAplicadaPct: z.number().finite().min(0).max(99.99).nullable(),
  precoFixo: z.number().finite().nonnegative().nullable(),
  instalacao: z.number().finite().nonnegative(),
  descontoPct: z.number().finite().min(0).max(100),
  regraPreco: z.string().min(1).max(500),
  margemPct: z.number().finite().min(-1000).max(1000).nullable(),
  precificacaoIA: z.object({
    recibo: z.string().min(20).max(6000),
    contexto: precoContextoSchema,
    auditoria: z.object({
      origem: z.enum(["gpt", "calculado"]),
      sugeridoPorId: z.string().nullable(),
      aprovadoPor: z.object({ id: z.string(), nome: z.string(), role: z.string() }).strict(),
      aprovadoEm: z.string().datetime(),
      precoAprovado: z.number().nonnegative(),
      sugestaoId: z.string().nullable(),
      parecer: z.string().nullable(),
      alertas: z.array(z.string()),
      assinaturaBase: z.string().length(64),
      assinaturaCotacao: z.string().length(64),
    }).strict().optional(),
  }).strict().optional(),
  precoFinal: z.number().nonnegative(),
  prazoDiasUteis: z.number().int().nonnegative().nullable(),
  status: z.literal("enviado"),
}).strict();

const criarSchema = z.object({
  sourceId: z.string().min(1).max(80),
  snapshot: snapshotSchema,
});

type Snapshot = z.infer<typeof snapshotSchema> & {
  sourceId: string;
  numeroCotacao: string;
  reacaoCliente: {
    tipo: typeof reacooes[number];
    comentario: string;
    respondidoEm: string;
    formaPagamento?: "boleto" | "cartao" | "pix" | "ted";
    parcelasCartao?: number | null;
    valorPagamento?: number;
  } | null;
};

function lerSnapshot(observacoes: string | null): Snapshot | null {
  if (!observacoes?.startsWith(PREFIXO_ESTUDIO)) return null;
  try {
    const valor = JSON.parse(observacoes.slice(PREFIXO_ESTUDIO.length));
    return valor && typeof valor === "object" ? (valor as Snapshot) : null;
  } catch {
    return null;
  }
}

function gravarSnapshot(snapshot: Snapshot): string {
  return PREFIXO_ESTUDIO + JSON.stringify(snapshot);
}

function numeroCotacao(id: number): string {
  return `COT-${String(id).padStart(6, "0")}`;
}

function respostaErro(res: Response, status: number, mensagem: string): void {
  res.status(status).json({ error: mensagem });
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Rejeita cabeçalho Origin inválido.
  }
  respostaErro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

function rota(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      console.error("[EstudioCotacoes] Falha na rota:", error);
      if (!res.headersSent) respostaErro(res, 500, "Não foi possível concluir esta operação agora.");
    });
  };
}

async function exigirSessao(req: Request, res: Response): Promise<boolean> {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (sessao) return true;
  respostaErro(res, 401, "Entre no Radrasys para acessar o histórico de cotações.");
  return false;
}

/** Cotações do CPQ Letreiros Express usam a tabela existente, com snapshot próprio no campo observações. */
export function registrarRotasEstudioCotacoes(app: Express): void {
  app.post("/api/letra-caixa/precos/sugerir", rota(sugerirPreco));
  app.post("/api/letra-caixa/precos/aprovar", rota(aprovarPreco));
  app.post("/api/letra-caixa/cotacoes", rota(criarCotacao));
  app.get("/api/letra-caixa/cotacoes", rota(listarCotacoes));
  app.get("/api/letra-caixa/cotacoes/:token", rota(obterCotacaoPublica));
  app.post("/api/letra-caixa/cotacoes/:token/resposta", rota(registrarResposta));
}

function basePrecoSnapshot(sourceId: string, snapshot: z.infer<typeof snapshotSchema>) {
  return {
    sourceId,
    mubisysProdutoId: snapshot.mubisysProdutoId ?? null,
    mubisysModeloId: snapshot.mubisysModeloId ?? null,
    modeloNome: snapshot.modeloNome,
    variacoesModelo: snapshot.variacoesModelo ?? [],
    medidas: {
      areaM2: snapshot.areaM2,
      areaGeralM2: snapshot.areaGeralM2,
      areaTotalNestingM2: snapshot.areaTotalNestingM2 ?? null,
      perimExtM: snapshot.perimExtM ?? null,
      perimTotalM: snapshot.perimTotalM ?? null,
    },
    materiais: snapshot.materiais ?? [],
    custoDireto: snapshot.custoDireto,
    custoMateriais: snapshot.custoMateriais,
    custoFixo: snapshot.custoFixo,
    custoServicos: snapshot.custoServicos,
    precoCalculado: snapshot.precoCalculado,
    modoPreco: snapshot.modoPreco,
    margemAplicadaPct: snapshot.margemAplicadaPct,
    precoFixo: snapshot.precoFixo,
    instalacao: snapshot.instalacao,
    descontoPct: snapshot.descontoPct,
    regraPreco: snapshot.regraPreco,
    margemPct: snapshot.margemPct,
  };
}

function assinaturaSnapshotCotacao(sourceId: string, snapshot: z.infer<typeof snapshotSchema>): string {
  const { precificacaoIA: _precificacaoIA, status: _status, ...conteudo } = snapshot;
  return hashBasePreco({ sourceId, snapshot: conteudo });
}

function contextoPrecoSnapshot(snapshot: z.infer<typeof snapshotSchema>) {
  for (const linha of snapshot.materiais ?? []) {
    const medida = linha.formulaType === "areaTotal" ? (snapshot.areaTotalNestingM2 || snapshot.areaGeralM2 || 0)
      : linha.formulaType === "area" ? snapshot.areaM2
      : linha.formulaType === "areaGeral" ? snapshot.areaGeralM2
      : linha.formulaType === "perimExt" ? snapshot.perimExtM
      : linha.formulaType === "perimTotal" ? snapshot.perimTotalM
      : 1;
    if (linha.formulaType !== "fixo" && ["areaTotal", "area", "areaGeral", "perimExt", "perimTotal"].includes(linha.formulaType)
      && (medida == null || (medida <= 0 && linha.multiplicador > 0))) {
      throw new Error(`A medida usada pela fórmula de ${linha.nome} está ausente ou zerada.`);
    }
    const quantidadeEsperada = (medida ?? 0) * linha.multiplicador;
    if (Math.abs(linha.quantidade - quantidadeEsperada) > 0.005) {
      throw new Error(`A quantidade de ${linha.nome} não corresponde à fórmula e às medidas atuais.`);
    }
  }
  const custoMateriaisLinhas = (snapshot.materiais ?? []).reduce((total, linha) => total + linha.custoTotal, 0);
  if ((snapshot.materiais ?? []).some((linha) => linha.quantidade > 0 && linha.custoUnitario <= 0)) {
    throw new Error("Há matéria-prima sem custo válido. Atualize os custos antes da análise ou aprovação.");
  }
  if ((snapshot.materiais ?? []).some((linha) => Math.abs(linha.custoTotal - linha.quantidade * linha.custoUnitario) > 0.02)) {
    throw new Error("O subtotal de uma matéria-prima não corresponde à quantidade e ao custo unitário.");
  }
  const custoDiretoEsperado = snapshot.custoMateriais + snapshot.custoFixo + snapshot.custoServicos;
  const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
  if (Math.abs(arredondar(custoMateriaisLinhas) - arredondar(snapshot.custoMateriais)) > 0.02
    || Math.abs(arredondar(custoDiretoEsperado) - arredondar(snapshot.custoDireto)) > 0.02) {
    throw new Error("Os custos das linhas não fecham com o custo direto. Recalcule o orçamento antes da aprovação.");
  }
  const precoEsperado = snapshot.modoPreco === "fixo"
    ? (snapshot.precoFixo ?? 0) * (1 - snapshot.descontoPct / 100)
    : snapshot.margemAplicadaPct == null || snapshot.margemAplicadaPct >= 100
      ? Number.NaN
      : (snapshot.custoDireto / (1 - snapshot.margemAplicadaPct / 100) + snapshot.instalacao) * (1 - snapshot.descontoPct / 100);
  if (!Number.isFinite(precoEsperado) || Math.abs(arredondar(precoEsperado) - arredondar(snapshot.precoCalculado)) > 0.02) {
    throw new Error("O preço calculado não corresponde à regra informada. Recalcule o orçamento antes da aprovação.");
  }
  return precoContextoSchema.parse({
    produto: snapshot.modeloNome,
    custoDireto: snapshot.custoDireto,
    precoAtual: snapshot.precoCalculado,
    regra: snapshot.regraPreco,
    margemAtualPct: snapshot.margemPct,
    itens: (snapshot.materiais ?? []).map((material) => ({
      nome: material.nome,
      quantidade: material.quantidade,
      custoTotal: material.custoTotal,
    })),
  });
}

async function obterAtor(req: Request) {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!sessao) return null;
  return {
    id: sessao.user.id,
    nome: sessao.user.name,
    role: String(sessao.user.role ?? ""),
  };
}

async function lerSnapshotPreco(req: Request, res: Response) {
  const parsed = z.object({ sourceId: z.string().min(1).max(80), snapshot: snapshotSchema }).strict().safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Confira os dados de custo e composição antes de analisar o preço.");
    return null;
  }
  return parsed.data;
}

async function sugerirPreco(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const ator = await obterAtor(req);
  if (!ator) { respostaErro(res, 401, "Entre no Radrasys para analisar o preço."); return; }
  const dados = await lerSnapshotPreco(req, res);
  if (!dados) return;
  try {
    const contexto = contextoPrecoSnapshot(dados.snapshot);
    const sugestao = await sugerirPrecoComGPT({
      fluxo: "cpq",
      base: basePrecoSnapshot(dados.sourceId, dados.snapshot),
      contexto,
      atorId: ator.id,
    });
    res.json({ ...sugestao, contexto });
  } catch (error) {
    respostaErro(res, 400, error instanceof Error ? error.message : "Não foi possível analisar o preço.");
  }
}

async function aprovarPreco(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const ator = await obterAtor(req);
  if (!ator) { respostaErro(res, 401, "Entre no Radrasys para aprovar um preço."); return; }
  if (!["gestor", "admin", "master"].includes(ator.role)) {
    respostaErro(res, 403, "A aprovação de preços está disponível para Gestor, Admin ou Master.");
    return;
  }
  const parsed = z.object({
    sourceId: z.string().min(1).max(80),
    snapshot: snapshotSchema,
    origem: z.enum(["calculado", "gpt"]),
    precoAprovado: z.number().finite().nonnegative(),
    ticket: z.string().min(20).max(6000).nullable().default(null),
  }).strict().safeParse(req.body);
  if (!parsed.success) { respostaErro(res, 400, "Confira o preço e a configuração antes de aprovar."); return; }
  try {
    const { sourceId, snapshot } = parsed.data;
    const base = basePrecoSnapshot(sourceId, snapshot);
    const contexto = contextoPrecoSnapshot(snapshot);
    const aprovacao = parsed.data.origem === "gpt"
      ? parsed.data.ticket
        ? aprovarSugestaoPreco({ ticket: parsed.data.ticket, fluxo: "cpq", base, contexto, ator })
        : null
      : aprovarPrecoCalculado({ fluxo: "cpq", base, contexto, preco: parsed.data.precoAprovado, ator });
    if (!aprovacao) { respostaErro(res, 400, "A sugestão do GPT expirou. Faça a análise novamente."); return; }
    if (Math.abs(aprovacao.precoAprovado - parsed.data.precoAprovado) >= 0.005) {
      respostaErro(res, 400, "O preço não corresponde ao valor aprovado.");
      return;
    }
    res.json({ ...aprovacao, contexto });
  } catch (error) {
    respostaErro(res, 400, error instanceof Error ? error.message : "Não foi possível aprovar o preço.");
  }
}

async function criarCotacao(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  if (!(await exigirSessao(req, res))) return;
  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Confira os dados do orçamento antes de concluir.");
    return;
  }
  const dadosRecebidos = parsed.data.snapshot;
  if (!dadosRecebidos.precificacaoIA?.recibo) {
    respostaErro(res, 400, "Aprovação humana obrigatória. Aprove o preço antes de gerar o link da cotação.");
    return;
  }
  let dadosComAprovacao: z.infer<typeof snapshotSchema>;
  try {
    const contexto = contextoPrecoSnapshot(dadosRecebidos);
    const auditoria = verificarAprovacaoPreco({
      recibo: dadosRecebidos.precificacaoIA.recibo,
      fluxo: "cpq",
      base: basePrecoSnapshot(parsed.data.sourceId, dadosRecebidos),
      contexto,
      preco: dadosRecebidos.precoFinal,
    });
    dadosComAprovacao = {
      ...dadosRecebidos,
      precificacaoIA: {
        recibo: dadosRecebidos.precificacaoIA.recibo,
        contexto,
        auditoria: {
          ...auditoria,
          assinaturaBase: hashBasePreco(basePrecoSnapshot(parsed.data.sourceId, dadosRecebidos)),
          assinaturaCotacao: assinaturaSnapshotCotacao(parsed.data.sourceId, dadosRecebidos),
        },
      },
    };
  } catch (error) {
    respostaErro(res, 400, error instanceof Error ? error.message : "A aprovação do preço não é válida.");
    return;
  }
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível. Tente novamente.");
    return;
  }

  const { sourceId } = parsed.data;
  const dados = dadosComAprovacao;
  const existentes = await db.select().from(propostas)
    .where(sql`left(${propostas.observacoes}, ${PREFIXO_ESTUDIO.length}) = ${PREFIXO_ESTUDIO}`);
  const existente = existentes.find((item) => lerSnapshot(item.observacoes)?.sourceId === sourceId);
  if (existente) {
    const snapshotAnterior = lerSnapshot(existente.observacoes);
    const assinaturaNova = dados.precificacaoIA?.auditoria?.assinaturaCotacao;
    const assinaturaAnterior = snapshotAnterior?.precificacaoIA?.auditoria?.assinaturaCotacao;
    const mesmaVersaoComercial = !!assinaturaNova && assinaturaNova === assinaturaAnterior
      && snapshotAnterior?.precoFinal === dados.precoFinal;
    const reacaoCliente = mesmaVersaoComercial ? snapshotAnterior?.reacaoCliente ?? null : null;
    const snapshot: Snapshot = {
      ...dados,
      sourceId,
      numeroCotacao: numeroCotacao(existente.id),
      reacaoCliente,
    };
    await db.update(propostas).set({
      clienteNome: dados.cliente.razao || dados.cliente.fantasia || dados.modeloNome,
      clienteCnpj: dados.cliente.cnpj,
      vendedorNome: dados.vendedor,
      observacoes: gravarSnapshot(snapshot),
      ...(mesmaVersaoComercial ? {} : { status: "aberta" }),
      updatedAt: new Date(),
    }).where(eq(propostas.id, existente.id));
    res.json({ id: existente.id, numero: snapshot.numeroCotacao, token: existente.token });
    return;
  }

  const token = randomBytes(24).toString("base64url");
  const snapshotBase = {
    ...dados,
    sourceId,
    numeroCotacao: "",
    reacaoCliente: null,
  } satisfies Snapshot;
  const [inserida] = await db.insert(propostas).values({
    token,
    clienteNome: dados.cliente.razao || dados.cliente.fantasia || dados.modeloNome,
    clienteCnpj: dados.cliente.cnpj,
    vendedorNome: dados.vendedor,
    observacoes: gravarSnapshot(snapshotBase),
    status: "aberta",
  }).returning({ id: propostas.id });
  const snapshot: Snapshot = { ...snapshotBase, numeroCotacao: numeroCotacao(inserida.id) };
  await db.update(propostas).set({ observacoes: gravarSnapshot(snapshot) }).where(eq(propostas.id, inserida.id));
  res.status(201).json({ id: inserida.id, numero: snapshot.numeroCotacao, token });
}

async function listarCotacoes(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  if (!(await exigirSessao(req, res))) return;
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "O banco de dados está indisponível.");
    return;
  }
  const linhas = await db.select().from(propostas)
    .where(sql`left(${propostas.observacoes}, ${PREFIXO_ESTUDIO.length}) = ${PREFIXO_ESTUDIO}`)
    .orderBy(desc(propostas.createdAt));
  const inicio = typeof req.query.inicio === "string" ? Date.parse(`${req.query.inicio}T00:00:00`) : NaN;
  const fim = typeof req.query.fim === "string" ? Date.parse(`${req.query.fim}T23:59:59.999`) : NaN;
  const numero = typeof req.query.numero === "string" ? req.query.numero.trim().toLowerCase() : "";
  const vendedor = typeof req.query.vendedor === "string" ? req.query.vendedor.trim().toLowerCase() : "";
  const cotacoes = linhas.flatMap((linha) => {
    const snapshot = lerSnapshot(linha.observacoes);
    if (!snapshot) return [];
    const criadaEm = linha.createdAt.toISOString();
    const dataMs = linha.createdAt.getTime();
    if (Number.isFinite(inicio) && dataMs < inicio) return [];
    if (Number.isFinite(fim) && dataMs > fim) return [];
    if (numero && !snapshot.numeroCotacao.toLowerCase().includes(numero)) return [];
    if (vendedor && !snapshot.vendedor.toLowerCase().includes(vendedor)) return [];
    return [{
      id: linha.id,
      numero: snapshot.numeroCotacao,
      token: linha.token,
      criadaEm,
      clienteNome: linha.clienteNome,
      clienteCnpj: linha.clienteCnpj,
      clienteFantasia: snapshot.cliente.fantasia,
      clienteEndereco: snapshot.cliente.endereco,
      vendedor: snapshot.vendedor,
      modeloNome: snapshot.modeloNome,
      mubisysProdutoId: snapshot.mubisysProdutoId ?? null,
      mubisysModeloId: snapshot.mubisysModeloId ?? null,
      variacoesModelo: snapshot.variacoesModelo ?? [],
      areaM2: snapshot.areaM2,
      areaGeralM2: snapshot.areaGeralM2,
      areaTotalNestingM2: snapshot.areaTotalNestingM2 ?? null,
      perimExtM: snapshot.perimExtM ?? null,
      perimTotalM: snapshot.perimTotalM ?? null,
      materiais: snapshot.materiais ?? [],
      precoFinal: snapshot.precoFinal,
      modalidadeFrete: snapshot.modalidadeFrete,
      metodoPagamento: snapshot.metodoPagamento,
      status: linha.status,
      reacaoCliente: snapshot.reacaoCliente,
    }];
  });
  res.json({ cotacoes });
}

async function obterCotacaoPublica(req: Request, res: Response): Promise<void> {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "Não foi possível carregar esta cotação agora.");
    return;
  }
  const [linha] = await db.select().from(propostas).where(eq(propostas.token, token)).limit(1);
  const snapshot = lerSnapshot(linha?.observacoes ?? null);
  if (!linha || !snapshot) {
    respostaErro(res, 404, "Cotação não encontrada ou link inválido.");
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    numero: snapshot.numeroCotacao,
    dataEmissao: snapshot.dataEmissao,
    validadeDias: snapshot.validadeDias,
    modalidadeFrete: snapshot.modalidadeFrete,
    metodoPagamento: snapshot.metodoPagamento,
    formasPagamentoPermitidas: snapshot.formasPagamentoPermitidas ?? ["pix", "cartao", "boleto", "ted"],
    jurosCartaoPct: snapshot.jurosCartaoPct ?? [0, 0, 0, 0, 0, 0],
    cliente: snapshot.cliente,
    vendedor: snapshot.vendedor,
    whatsappVendedor: snapshot.whatsappVendedor || null,
    modeloNome: snapshot.modeloNome,
    descricaoProduto: snapshot.descricaoProduto || "",
    variacoes: snapshot.variacoes || [],
    areaM2: snapshot.areaM2,
    areaGeralM2: snapshot.areaGeralM2,
    areaTotalNestingM2: snapshot.areaTotalNestingM2 ?? null,
    perimExtM: snapshot.perimExtM ?? null,
    perimTotalM: snapshot.perimTotalM ?? null,
    precoFinal: snapshot.precoFinal,
    prazoDiasUteis: snapshot.prazoDiasUteis,
    status: linha.status,
    reacaoCliente: snapshot.reacaoCliente,
  });
}

async function registrarResposta(req: Request, res: Response): Promise<void> {
  if (!mesmaOrigem(req, res)) return;
  const parsed = z.object({
    tipo: z.enum(reacooes),
    comentario: z.string().max(2000).default(""),
    formaPagamento: z.enum(["boleto", "cartao", "pix", "ted"]).default("pix"),
    parcelasCartao: z.number().int().min(1).max(6).nullable().default(null),
  }).safeParse(req.body);
  if (!parsed.success) {
    respostaErro(res, 400, "Escolha uma resposta válida para a cotação.");
    return;
  }
  const db = await getDb();
  if (!db) {
    respostaErro(res, 503, "Não foi possível registrar sua resposta agora.");
    return;
  }
  const token = typeof req.params.token === "string" ? req.params.token : "";
  const [linha] = await db.select().from(propostas).where(eq(propostas.token, token)).limit(1);
  const snapshot = lerSnapshot(linha?.observacoes ?? null);
  if (!linha || !snapshot) {
    respostaErro(res, 404, "Cotação não encontrada ou link inválido.");
    return;
  }
  const formasPermitidas = snapshot.formasPagamentoPermitidas ?? ["pix", "cartao", "boleto", "ted"];
  if (!formasPermitidas.includes(parsed.data.formaPagamento)) {
    respostaErro(res, 400, "Esta forma de pagamento não está disponível para a cotação.");
    return;
  }
  const parcelasCartao = parsed.data.formaPagamento === "cartao" ? (parsed.data.parcelasCartao ?? 1) : null;
  const taxaCartao = parcelasCartao ? (snapshot.jurosCartaoPct?.[parcelasCartao - 1] ?? 0) : 0;
  const valorPagamento = snapshot.precoFinal * (1 + taxaCartao / 100);
  const atualizado: Snapshot = {
    ...snapshot,
    reacaoCliente: {
      tipo: parsed.data.tipo,
      comentario: parsed.data.comentario,
      formaPagamento: parsed.data.formaPagamento,
      parcelasCartao,
      valorPagamento,
      respondidoEm: new Date().toISOString(),
    },
  };
  const status = parsed.data.tipo === "aprovado" ? "aceita" : parsed.data.tipo === "fora_orcamento" ? "recusada" : "aberta";
  await db.update(propostas).set({ observacoes: gravarSnapshot(atualizado), status, updatedAt: new Date() })
    .where(eq(propostas.id, linha.id));
  res.json({ success: true, reacaoCliente: atualizado.reacaoCliente });
}
