/**
 * Proposta (cotação) gerada a partir do catálogo de Produtos — diferente de
 * `crm_propostas` (tabela órfã, nunca usada; ver drizzle/schema.ts). O
 * cliente acessa a proposta por um link público com token (sem login),
 * pode ligar/desligar item pra simular o valor (escolha fica salva) e ver
 * juros de parcelamento + condições comerciais configuradas em Admin.
 */
import { randomBytes } from "crypto";
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { propostas, propostaItens, produtos, configuracoesComerciais } from "../../drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";
import { consultarCnpj, CnpjNaoEncontradoError } from "../integrations/opencnpj-client";

function gerarToken(): string {
  return randomBytes(24).toString("base64url");
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

async function obterConfiguracoes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [config] = await db.select().from(configuracoesComerciais).limit(1);
  if (config) return config;
  const [criado] = await db.insert(configuracoesComerciais).values({}).returning();
  return criado;
}

export const propostasRouter = router({
  // ─── Admin ───────────────────────────────────────────────────────────────
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const lista = await db.select().from(propostas).orderBy(desc(propostas.createdAt));
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
      if (!proposta) return null;
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
          quantidade: String(input.quantidade),
          precoUnitario: String(input.precoUnitario),
          ordem: existentes.length,
        })
        .returning({ id: propostaItens.id });
      return { success: true, id: result.id };
    }),

  itemAtualizar: protectedProcedure
    .input(z.object({ id: z.number(), quantidade: z.number().min(0.0001), precoUnitario: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(propostaItens)
        .set({ quantidade: String(input.quantidade), precoUnitario: String(input.precoUnitario) })
        .where(eq(propostaItens.id, input.id));
      return { success: true };
    }),

  itemRemover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
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
          itens,
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
          .select({ id: propostaItens.id, propostaId: propostaItens.propostaId })
          .from(propostaItens)
          .where(eq(propostaItens.id, input.itemId));
        // O item precisa pertencer à proposta do token — senão qualquer link
        // válido poderia mexer em item de outra proposta pelo id.
        if (!item || item.propostaId !== proposta.id) throw new Error("Item não pertence a esta proposta");
        await db.update(propostaItens).set({ ativo: input.ativo }).where(eq(propostaItens.id, input.itemId));
        return { success: true };
      }),
  }),
});
