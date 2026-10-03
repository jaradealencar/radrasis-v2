/**
 * Proposta (cotação) gerada a partir do catálogo de Produtos — diferente de
 * `crm_propostas` (tabela órfã, nunca usada; ver drizzle/schema.ts). O
 * cliente acessa a proposta por um link público com token (sem login),
 * pode ligar/desligar item pra simular o valor (escolha fica salva) e ver
 * juros de parcelamento + condições comerciais configuradas em Admin.
 */
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { propostas, propostaItens, produtos, configuracoesComerciais } from "../../drizzle/schema";
import { eq, asc, desc, and, inArray, sql } from "drizzle-orm";
import { consultarCnpj, CnpjNaoEncontradoError } from "../integrations/opencnpj-client";

function gerarToken(): string {
  return randomBytes(24).toString("base64url");
}

const PREFIXO_COTACAO_ESTUDIO = "[ESTUDIO_COTACAO_V1]";

const medidasNestingSchema = z.object({
  areaTotalNestingM2: z.number().nonnegative().nullable(),
  areaM2: z.number().nonnegative().nullable(),
  areaGeralM2: z.number().nonnegative().nullable(),
  perimExtM: z.number().nonnegative().nullable(),
  perimTotalM: z.number().nonnegative().nullable(),
}).strict();

const materialConfiguracaoSchema = z.object({
  mubisysMateriaPrimaId: z.number().int().positive().nullable(),
  nome: z.string().min(1).max(256),
  unidade: z.string().max(80),
  custoUnitario: z.number().nonnegative(),
  quantidade: z.number().nonnegative(),
  custoTotal: z.number().nonnegative(),
  formulaType: z.enum(["areaTotal", "area", "areaGeral", "perimExt", "perimTotal", "fixo"]),
  multiplicador: z.number().nonnegative(),
  variacaoModeloId: z.number().int().positive().nullable(),
  variacaoModeloNome: z.string().max(256).nullable(),
  variacaoMaterial: z.object({
    nome: z.string().max(80),
    valor: z.string().max(120),
    materiaPrimaNome: z.string().max(256),
  }).nullable(),
  incluir: z.boolean(),
}).strict();

const configuracaoItemSchema = z.object({
  nestingSourceId: z.string().max(80).nullable(),
  nestingNumero: z.string().max(40).nullable(),
  nestingModeloNome: z.string().max(256).nullable(),
  medidas: medidasNestingSchema,
  variacoesModelo: z.array(z.object({ id: z.number().int().positive(), nome: z.string().max(256) }).strict()).max(100),
  materiais: z.array(materialConfiguracaoSchema).max(500),
}).strict();

function lerSnapshotEstudio(observacoes: string | null): Record<string, unknown> | null {
  if (!observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) return null;
  try {
    const snapshot: unknown = JSON.parse(observacoes.slice(PREFIXO_COTACAO_ESTUDIO.length));
    return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function nomesVariacoes(configuracao: unknown): { nome: string; valor: string }[] {
  if (!configuracao || typeof configuracao !== "object" || Array.isArray(configuracao)) return [];
  const dados = configuracao as Record<string, unknown>;
  const modelo = Array.isArray(dados.variacoesModelo) ? dados.variacoesModelo.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const linha = item as Record<string, unknown>;
    return typeof linha.nome === "string" && typeof linha.id === "number"
      ? [{ nome: "Variação do modelo", valor: linha.nome }]
      : [];
  }) : [];
  const materiais = Array.isArray(dados.materiais) ? dados.materiais.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const linha = item as Record<string, unknown>;
    if (!linha.variacaoMaterial || typeof linha.variacaoMaterial !== "object" || Array.isArray(linha.variacaoMaterial)) return [];
    const variacao = linha.variacaoMaterial as Record<string, unknown>;
    return typeof variacao.nome === "string" && typeof variacao.valor === "string"
      ? [{ nome: variacao.nome, valor: variacao.valor }]
      : [];
  }) : [];
  return [...new Map([...modelo, ...materiais].map((variacao) => [`${variacao.nome}:${variacao.valor}`, variacao])).values()];
}

function calcularTotal(itens: { ativo: boolean; precoUnitario: string; quantidade: string }[]): number {
  return itens
    .filter((i) => i.ativo)
    .reduce((soma, i) => soma + Number(i.precoUnitario) * Number(i.quantidade), 0);
}

/** Maior prazo de fabricação entre os itens ativos — item mais lento manda no prazo total. */
function calcularPrazo(itens: { ativo: boolean; prazoFabricacaoDiasUteis: number | null }[]): number | null {
  const prazos = itens.filter((i) => i.ativo).map((i) => i.prazoFabricacaoDiasUteis ?? 0);
  return prazos.length ? Math.max(...prazos) : null;
}

async function carregarItensComProduto(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, propostaId: number) {
  return db
    .select({
      id: propostaItens.id,
      produtoId: propostaItens.produtoId,
      produtoNome: propostaItens.produtoNome,
      descricao: propostaItens.descricao,
      configuracaoJson: propostaItens.configuracaoJson,
      grupoId: propostaItens.grupoId,
      grupoDescricao: propostaItens.grupoDescricao,
      quantidade: propostaItens.quantidade,
      precoUnitario: propostaItens.precoUnitario,
      ativo: propostaItens.ativo,
      ordem: propostaItens.ordem,
      prazoFabricacaoDiasUteis: produtos.prazoFabricacaoDiasUteis,
      instagramUrl: produtos.instagramUrl,
    })
    .from(propostaItens)
    .innerJoin(produtos, eq(propostaItens.produtoId, produtos.id))
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));
}

type ItemCarregado = Awaited<ReturnType<typeof carregarItensComProduto>>[number];
type ItemPublico = Omit<ItemCarregado, "grupoId" | "grupoDescricao" | "produtoId" | "ordem" | "configuracaoJson"> & {
  variacoes: { nome: string; valor: string }[];
};

/** Mantém os componentes separados no orçamento, mas entrega um único item por grupo ao cliente. */
function consolidarItensPublicos(itens: ItemCarregado[]) {
  const resultado: ItemPublico[] = [];
  const gruposProcessados = new Set<string>();

  for (const item of itens) {
    if (!item.grupoId) {
      const { grupoId: _grupoId, grupoDescricao: _grupoDescricao, produtoId: _produtoId, ordem: _ordem, configuracaoJson, ...publico } = item;
      resultado.push({ ...publico, variacoes: nomesVariacoes(configuracaoJson) });
      continue;
    }
    if (gruposProcessados.has(item.grupoId)) continue;

    const membros = itens.filter((membro) => membro.grupoId === item.grupoId);
    gruposProcessados.add(item.grupoId);
    const prazos = membros
      .map((membro) => membro.prazoFabricacaoDiasUteis)
      .filter((prazo): prazo is number => prazo != null);
    const valorConjunto = membros.reduce(
      (soma, membro) => soma + Number(membro.quantidade) * Number(membro.precoUnitario),
      0,
    );

    const variacoes = membros.flatMap((membro) => nomesVariacoes(membro.configuracaoJson));
    resultado.push({
      id: item.id,
      produtoNome: "Conjunto",
      descricao: item.grupoDescricao,
      quantidade: "1",
      precoUnitario: valorConjunto.toFixed(2),
      ativo: membros.every((membro) => membro.ativo),
      prazoFabricacaoDiasUteis: prazos.length ? Math.max(...prazos) : null,
      instagramUrl: null,
      variacoes: [...new Map(variacoes.map((variacao) => [variacao.valor, variacao])).values()],
    });
  }

  return resultado;
}

async function obterConfiguracoes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [config] = await db.select().from(configuracoesComerciais).limit(1);
  if (config) return config;
  const [criado] = await db.insert(configuracoesComerciais).values({}).returning();
  return criado;
}

export const propostasRouter = router({
  nestingsEstudio: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const registros = await db.select({
      id: propostas.id,
      clienteNome: propostas.clienteNome,
      createdAt: propostas.createdAt,
      observacoes: propostas.observacoes,
    }).from(propostas)
      .where(sql`left(${propostas.observacoes}, ${PREFIXO_COTACAO_ESTUDIO.length}) = ${PREFIXO_COTACAO_ESTUDIO}`)
      .orderBy(desc(propostas.createdAt))
      .limit(100);

    const numeroOuNulo = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
    return registros.flatMap((registro) => {
      const snapshot = lerSnapshotEstudio(registro.observacoes);
      if (!snapshot || typeof snapshot.sourceId !== "string" || typeof snapshot.modeloNome !== "string") return [];
      const variacoesModelo = Array.isArray(snapshot.variacoesModelo)
        ? snapshot.variacoesModelo.flatMap((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return [];
            const variacao = item as Record<string, unknown>;
            return typeof variacao.id === "number" && typeof variacao.nome === "string"
              ? [{ id: variacao.id, nome: variacao.nome }]
              : [];
          })
        : [];
      const medidas = {
        areaTotalNestingM2: numeroOuNulo(snapshot.areaTotalNestingM2),
        areaM2: numeroOuNulo(snapshot.areaM2),
        areaGeralM2: numeroOuNulo(snapshot.areaGeralM2),
        perimExtM: numeroOuNulo(snapshot.perimExtM),
        perimTotalM: numeroOuNulo(snapshot.perimTotalM),
      };
      const materiais = Array.isArray(snapshot.materiais)
        ? snapshot.materiais.flatMap((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return [];
            const parsed = materialConfiguracaoSchema.safeParse({ ...(item as Record<string, unknown>), incluir: true });
            return parsed.success ? [parsed.data] : [];
          })
        : [];
      return [{
        cotacaoId: registro.id,
        sourceId: snapshot.sourceId,
        numero: typeof snapshot.numeroCotacao === "string" ? snapshot.numeroCotacao : `COT-${String(registro.id).padStart(6, "0")}`,
        criadaEm: registro.createdAt,
        clienteNome: registro.clienteNome,
        modeloNome: snapshot.modeloNome,
        mubisysProdutoId: typeof snapshot.mubisysProdutoId === "number" ? snapshot.mubisysProdutoId : null,
        mubisysModeloId: typeof snapshot.mubisysModeloId === "number" ? snapshot.mubisysModeloId : null,
        variacoesModelo,
        medidas,
        materiais,
      }];
    });
  }),

  // ─── Admin ───────────────────────────────────────────────────────────────
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const lista = (await db.select().from(propostas).orderBy(desc(propostas.createdAt)))
      .filter((proposta) => !proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO));
    const resultado = [];
    for (const p of lista) {
      const itens = await db
        .select({ ativo: propostaItens.ativo, precoUnitario: propostaItens.precoUnitario, quantidade: propostaItens.quantidade })
        .from(propostaItens)
        .where(eq(propostaItens.propostaId, p.id));
      resultado.push({ ...p, valorTotal: calcularTotal(itens), qtdItens: itens.length });
    }
    return resultado;
  }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [proposta] = await db.select().from(propostas).where(eq(propostas.id, input.id));
      if (!proposta || proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) return null;
      const itens = await carregarItensComProduto(db, input.id);
      return {
        proposta,
        itens,
        valorTotal: calcularTotal(itens),
        prazoFabricacaoDiasUteis: calcularPrazo(itens),
      };
    }),

  criar: protectedProcedure
    .input(
      z.object({
        clienteNome: z.string().min(1),
        clienteCnpj: z.string().optional(),
        clienteContato: z.string().optional(),
        vendedorNome: z.string().min(1),
        formasPagamento: z.array(z.string()).optional().default([]),
        condicaoPagamentoObs: z.string().optional(),
        observacoes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db
        .insert(propostas)
        .values({
          token: gerarToken(),
          clienteNome: input.clienteNome,
          clienteCnpj: input.clienteCnpj || null,
          clienteContato: input.clienteContato || null,
          vendedorNome: input.vendedorNome,
          formasPagamentoJson: JSON.stringify(input.formasPagamento),
          condicaoPagamentoObs: input.condicaoPagamentoObs || null,
          observacoes: input.observacoes || null,
        })
        .returning({ id: propostas.id, token: propostas.token });
      return { success: true, id: result.id, token: result.token };
    }),

  /** Consulta CNPJ na OpenCNPJ (mesma API já usada em outros módulos) pra
   *  autocompletar razão social/nome fantasia no formulário de proposta —
   *  não há endpoint de escrita no MubiSys, então isto não cria nada lá,
   *  só evita digitação manual do nome do cliente aqui. */
  consultarCnpj: protectedProcedure
    .input(z.object({ cnpj: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const dados = await consultarCnpj(input.cnpj);
        return { encontrado: true as const, razaoSocial: dados.razao_social, nomeFantasia: dados.nome_fantasia };
      } catch (e) {
        if (e instanceof CnpjNaoEncontradoError) return { encontrado: false as const };
        throw e;
      }
    }),

  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        clienteNome: z.string().min(1),
        clienteCnpj: z.string().optional(),
        clienteContato: z.string().optional(),
        vendedorNome: z.string().min(1),
        formasPagamento: z.array(z.string()).optional().default([]),
        condicaoPagamentoObs: z.string().optional(),
        observacoes: z.string().optional(),
        status: z.enum(["aberta", "aceita", "recusada", "expirada"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(propostas)
        .set({
          clienteNome: input.clienteNome,
          clienteCnpj: input.clienteCnpj || null,
          clienteContato: input.clienteContato || null,
          vendedorNome: input.vendedorNome,
          formasPagamentoJson: JSON.stringify(input.formasPagamento),
          condicaoPagamentoObs: input.condicaoPagamentoObs || null,
          observacoes: input.observacoes || null,
          ...(input.status ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(propostas.id, input.id));
      return { success: true };
    }),

  remover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(propostas).where(eq(propostas.id, input.id));
      return { success: true };
    }),

  itemAdicionar: protectedProcedure
    .input(
      z.object({
        propostaId: z.number(),
        produtoId: z.number(),
        quantidade: z.number().min(0.0001).default(1),
        precoUnitario: z.number().min(0),
        descricao: z.string().max(5000).optional().default(""),
        configuracao: configuracaoItemSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [produto] = await db.select({ nome: produtos.nome }).from(produtos).where(eq(produtos.id, input.produtoId));
      if (!produto) throw new Error("Produto não encontrado");
      const existentes = await db
        .select({ id: propostaItens.id })
        .from(propostaItens)
        .where(eq(propostaItens.propostaId, input.propostaId));
      const [result] = await db
        .insert(propostaItens)
        .values({
          propostaId: input.propostaId,
          produtoId: input.produtoId,
          produtoNome: produto.nome,
          descricao: input.descricao,
          configuracaoJson: input.configuracao ?? {},
          quantidade: String(input.quantidade),
          precoUnitario: String(input.precoUnitario),
          ordem: existentes.length,
        })
        .returning({ id: propostaItens.id });
      return { success: true, id: result.id };
    }),

  itemAtualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      quantidade: z.number().min(0.0001),
      precoUnitario: z.number().min(0),
      descricao: z.string().max(5000).optional(),
      configuracao: configuracaoItemSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(propostaItens)
        .set({
          quantidade: String(input.quantidade),
          precoUnitario: String(input.precoUnitario),
          ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
          ...(input.configuracao !== undefined ? { configuracaoJson: input.configuracao } : {}),
        })
        .where(eq(propostaItens.id, input.id));
      return { success: true };
    }),

  grupoCriar: protectedProcedure
    .input(
      z.object({
        propostaId: z.number(),
        itemIds: z.array(z.number()).min(2).max(50).refine((ids) => new Set(ids).size === ids.length, "Itens repetidos"),
        descricao: z.string().max(5000).default(""),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [proposta] = await db
        .select({ id: propostas.id, observacoes: propostas.observacoes })
        .from(propostas)
        .where(eq(propostas.id, input.propostaId));
      if (!proposta || proposta.observacoes?.startsWith(PREFIXO_COTACAO_ESTUDIO)) throw new Error("Proposta não encontrada");

      const itens = await db
        .select({ id: propostaItens.id, grupoId: propostaItens.grupoId, ativo: propostaItens.ativo })
        .from(propostaItens)
        .where(and(eq(propostaItens.propostaId, input.propostaId), inArray(propostaItens.id, input.itemIds)));
      if (itens.length !== input.itemIds.length) throw new Error("Um ou mais itens não pertencem a esta proposta");
      if (itens.some((item) => item.grupoId)) throw new Error("Desfaça os grupos existentes antes de agrupar esses itens");
      if (new Set(itens.map((item) => item.ativo)).size > 1) {
        throw new Error("Para agrupar, os itens precisam estar todos ativos ou todos desligados");
      }

      const grupoId = randomUUID();
      await db
        .update(propostaItens)
        .set({ grupoId, grupoDescricao: input.descricao })
        .where(and(eq(propostaItens.propostaId, input.propostaId), inArray(propostaItens.id, input.itemIds)));
      return { success: true, grupoId };
    }),

  grupoAtualizarDescricao: protectedProcedure
    .input(z.object({ propostaId: z.number(), grupoId: z.string().uuid(), descricao: z.string().max(5000) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const itens = await db
        .select({ id: propostaItens.id })
        .from(propostaItens)
        .where(and(eq(propostaItens.propostaId, input.propostaId), eq(propostaItens.grupoId, input.grupoId)));
      if (itens.length < 2) throw new Error("Grupo não encontrado");
      await db
        .update(propostaItens)
        .set({ grupoDescricao: input.descricao })
        .where(and(eq(propostaItens.propostaId, input.propostaId), eq(propostaItens.grupoId, input.grupoId)));
      return { success: true };
    }),

  grupoDesfazer: protectedProcedure
    .input(z.object({ propostaId: z.number(), grupoId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(propostaItens)
        .set({ grupoId: null, grupoDescricao: "" })
        .where(and(eq(propostaItens.propostaId, input.propostaId), eq(propostaItens.grupoId, input.grupoId)));
      return { success: true };
    }),

  itemRemover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [item] = await db
        .select({ propostaId: propostaItens.propostaId, grupoId: propostaItens.grupoId })
        .from(propostaItens)
        .where(eq(propostaItens.id, input.id));
      if (item?.grupoId) {
        const membros = await db
          .select({ id: propostaItens.id })
          .from(propostaItens)
          .where(and(eq(propostaItens.propostaId, item.propostaId), eq(propostaItens.grupoId, item.grupoId)));
        if (membros.length === 2) {
          await db
            .update(propostaItens)
            .set({ grupoId: null, grupoDescricao: "" })
            .where(and(eq(propostaItens.propostaId, item.propostaId), eq(propostaItens.grupoId, item.grupoId)));
        }
      }
      await db.delete(propostaItens).where(eq(propostaItens.id, input.id));
      return { success: true };
    }),

  // ─── Configurações comerciais globais (condições + juros) ────────────────
  configuracoesObter: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const config = await obterConfiguracoes(db);
    return { ...config, jurosParcelamento: JSON.parse(config.jurosParcelamentoJson || "[]") };
  }),

  configuracoesSalvar: protectedProcedure
    .input(
      z.object({
        condicoesComerciaisUrl: z.string().optional(),
        condicoesComerciaisNome: z.string().optional(),
        jurosParcelamento: z.array(z.object({ parcelas: z.number().int().min(1), jurosPct: z.number().min(0) })),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const atual = await obterConfiguracoes(db);
      await db
        .update(configuracoesComerciais)
        .set({
          condicoesComerciaisUrl: input.condicoesComerciaisUrl ?? atual.condicoesComerciaisUrl,
          condicoesComerciaisNome: input.condicoesComerciaisNome ?? atual.condicoesComerciaisNome,
          jurosParcelamentoJson: JSON.stringify(
            [...input.jurosParcelamento].sort((a, b) => a.parcelas - b.parcelas),
          ),
          updatedAt: new Date(),
        })
        .where(eq(configuracoesComerciais.id, atual.id));
      return { success: true };
    }),

  // ─── Público (sem login — posse do link no token é a autorização) ────────
  publico: router({
    obterPorToken: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [proposta] = await db.select().from(propostas).where(eq(propostas.token, input.token));
        if (!proposta) return null;
        const itens = await carregarItensComProduto(db, proposta.id);
        const config = await obterConfiguracoes(db);
        return {
          proposta: {
            id: proposta.id,
            clienteNome: proposta.clienteNome,
            vendedorNome: proposta.vendedorNome,
            formasPagamento: JSON.parse(proposta.formasPagamentoJson || "[]") as string[],
            condicaoPagamentoObs: proposta.condicaoPagamentoObs,
            status: proposta.status,
            createdAt: proposta.createdAt,
          },
          itens: consolidarItensPublicos(itens),
          valorTotal: calcularTotal(itens),
          prazoFabricacaoDiasUteis: calcularPrazo(itens),
          condicoesComerciaisUrl: config.condicoesComerciaisUrl,
          condicoesComerciaisNome: config.condicoesComerciaisNome,
          jurosParcelamento: JSON.parse(config.jurosParcelamentoJson || "[]") as { parcelas: number; jurosPct: number }[],
        };
      }),

    toggleItem: publicProcedure
      .input(z.object({ token: z.string().min(1), itemId: z.number(), ativo: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const [proposta] = await db.select({ id: propostas.id }).from(propostas).where(eq(propostas.token, input.token));
        if (!proposta) throw new Error("Proposta não encontrada");
        const [item] = await db
          .select({ id: propostaItens.id, propostaId: propostaItens.propostaId, grupoId: propostaItens.grupoId })
          .from(propostaItens)
          .where(eq(propostaItens.id, input.itemId));
        // O item precisa pertencer à proposta do token — senão qualquer link
        // válido poderia mexer em item de outra proposta pelo id.
        if (!item || item.propostaId !== proposta.id) throw new Error("Item não pertence a esta proposta");
        if (item.grupoId) {
          await db
            .update(propostaItens)
            .set({ ativo: input.ativo })
            .where(and(eq(propostaItens.propostaId, proposta.id), eq(propostaItens.grupoId, item.grupoId)));
        } else {
          await db.update(propostaItens).set({ ativo: input.ativo }).where(eq(propostaItens.id, input.itemId));
        }
        return { success: true };
      }),
  }),
});
