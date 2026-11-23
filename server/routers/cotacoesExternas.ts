import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import {
  cotacaoExternaFornecedor,
  cotacaoExternaItem,
  cotacaoExternaVinculo,
  cotacaoExternaAtualizacaoCusto,
  materiasPrimas,
} from "../../drizzle/schema";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { storagePut } from "../db/storage";

export const cotacoesExternasRouter = router({
  /**
   * Lista fornecedores com cotações externas cadastradas, com opção de filtrar
   * por CNPJ, matéria-prima, se já trabalhamos com eles ou busca textual.
   */
  listarFornecedores: protectedProcedure
    .input(
      z.object({
        cnpj: z.string().optional(),
        materiaPrimaId: z.number().optional(),
        jaTrabalhamos: z.boolean().optional(),
        busca: z.string().optional(),
        limite: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: cotacaoExternaFornecedor.id,
          cnpj: cotacaoExternaFornecedor.cnpj,
          nomeFantasia: cotacaoExternaFornecedor.nomeFantasia,
          razaoSocial: cotacaoExternaFornecedor.razaoSocial,
          telefone: cotacaoExternaFornecedor.telefone,
          email: cotacaoExternaFornecedor.email,
          cidade: cotacaoExternaFornecedor.cidade,
          estado: cotacaoExternaFornecedor.estado,
          observacoes: cotacaoExternaFornecedor.observacoes,
          jaTrabalhamos: cotacaoExternaFornecedor.jaTrabalhamos,
          criadoPor: cotacaoExternaFornecedor.criadoPor,
          createdAt: cotacaoExternaFornecedor.createdAt,
          updatedAt: cotacaoExternaFornecedor.updatedAt,
          itens: sql`jsonb_agg(
            jsonb_build_object(
              'id', ${cotacaoExternaItem.id},
              'codigoFornecedor', ${cotacaoExternaItem.codigoFornecedor},
              'descricao', ${cotacaoExternaItem.descricao},
              'unidade', ${cotacaoExternaItem.unidade},
              'precoUnitario', ${cotacaoExternaItem.precoUnitario},
              'precoTotal', ${cotacaoExternaItem.precoTotal},
              'quantidade', ${cotacaoExternaItem.quantidade},
              'dataCotacao', ${cotacaoExternaItem.dataCotacao},
              'validadeDias', ${cotacaoExternaItem.validadeDias},
              'condicaoPagamento', ${cotacaoExternaItem.condicaoPagamento},
              'prazoEntrega', ${cotacaoExternaItem.prazoEntrega},
              'arquivoOrigemUrl', ${cotacaoExternaItem.arquivoOrigemUrl},
              'materiaPrimaId', ${cotacaoExternaItem.materiaPrimaId},
              'vinculadoAoItemNf', ${cotacaoExternaItem.vinculadoAoItemNf},
              'criadoPor', ${cotacaoExternaItem.criadoPor},
              'createdAt', ${cotacaoExternaItem.createdAt}
            ) ORDER BY ${cotacaoExternaItem.createdAt} DESC
          ) filter (where ${cotacaoExternaItem.id} is not null)`.as("itens"),
        })
        .from(cotacaoExternaFornecedor)
        .leftJoin(
          cotacaoExternaItem,
          eq(cotacaoExternaItem.fornecedorId, cotacaoExternaFornecedor.id)
        )
        .where(
          and(
            input.cnpj ? eq(cotacaoExternaFornecedor.cnpj, input.cnpj) : undefined,
            input.jaTrabalhamos !== undefined
              ? eq(cotacaoExternaFornecedor.jaTrabalhamos, input.jaTrabalhamos)
              : undefined,
            input.materiaPrimaId
              ? eq(cotacaoExternaItem.materiaPrimaId, input.materiaPrimaId)
              : undefined,
            input.busca
              ? or(
                  ilike(cotacaoExternaFornecedor.nomeFantasia, `%${input.busca}%`),
                  ilike(cotacaoExternaFornecedor.cnpj, `%${input.busca}%`),
                  ilike(cotacaoExternaItem.descricao, `%${input.busca}%`)
                )
              : undefined
          )
        )
        .groupBy(cotacaoExternaFornecedor.id)
        .orderBy(desc(cotacaoExternaFornecedor.createdAt))
        .limit(input.limite);

      return rows.map((r) => ({
        ...r,
        itens: Array.isArray(r.itens) ? r.itens : r.itens ? [r.itens] : [],
      }));
    }),

  /**
   * Cadastra um fornecedor externo (pode ser empresa que nunca trabalhamos)
   * junto com os itens cotados. É o ponto de entrada para cotação de empresa
   * nova (funcionalidade 3).
   */
  criarFornecedor: protectedProcedure
    .input(
      z.object({
        cnpj: z.string().min(1, "CNPJ obrigatório"),
        nomeFantasia: z.string().min(1, "Nome fantasia obrigatório"),
        razaoSocial: z.string().optional().nullable(),
        telefone: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        cidade: z.string().optional().nullable(),
        estado: z.string().optional().nullable(),
        observacoes: z.string().optional().nullable(),
        jaTrabalhamos: z.boolean().default(false),
        itens: z.array(
          z.object({
            codigoFornecedor: z.string().optional().nullable(),
            descricao: z.string().min(1, "Descrição obrigatória"),
            unidade: z.string().min(1, "Unidade obrigatória"),
            precoUnitario: z.number().nonnegative(),
            precoTotal: z.number().nonnegative().optional().nullable(),
            quantidade: z.number().nonnegative().optional().nullable(),
            dataCotacao: z.string().optional().nullable(),
            validadeDias: z.number().int().nonnegative().optional().nullable(),
            condicaoPagamento: z.string().optional().nullable(),
            prazoEntrega: z.string().optional().nullable(),
            arquivoOrigemUrl: z.string().optional().nullable(),
            materiaPrimaId: z.number().optional().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const userId = ctx.user?.id ? String(ctx.user.id) : null;

      // Verificar se o fornecedor já existe por CNPJ
      const [existente] = await db
        .select({ id: cotacaoExternaFornecedor.id })
        .from(cotacaoExternaFornecedor)
        .where(eq(cotacaoExternaFornecedor.cnpj, input.cnpj))
        .limit(1);

      let fornecedorId: number;
      if (existente) {
        fornecedorId = existente.id;
        await db
          .update(cotacaoExternaFornecedor)
          .set({
            nomeFantasia: input.nomeFantasia,
            razaoSocial: input.razaoSocial ?? null,
            telefone: input.telefone ?? null,
            email: input.email ?? null,
            cidade: input.cidade ?? null,
            estado: input.estado ?? null,
            observacoes: input.observacoes ?? null,
            jaTrabalhamos: input.jaTrabalhamos,
            updatedAt: new Date(),
          })
          .where(eq(cotacaoExternaFornecedor.id, fornecedorId));
      } else {
        const [novo] = await db
          .insert(cotacaoExternaFornecedor)
          .values({
            cnpj: input.cnpj,
            nomeFantasia: input.nomeFantasia,
            razaoSocial: input.razaoSocial ?? null,
            telefone: input.telefone ?? null,
            email: input.email ?? null,
            cidade: input.cidade ?? null,
            estado: input.estado ?? null,
            observacoes: input.observacoes ?? null,
            jaTrabalhamos: input.jaTrabalhamos,
            criadoPor: userId,
          })
          .returning({ id: cotacaoExternaFornecedor.id });
        fornecedorId = novo.id;
      }

      // Inserir itens da cotação
      for (const item of input.itens) {
        await db.insert(cotacaoExternaItem).values({
          fornecedorId,
          codigoFornecedor: item.codigoFornecedor ?? null,
          descricao: item.descricao,
          unidade: item.unidade,
          precoUnitario: String(item.precoUnitario),
          precoTotal: item.precoTotal != null ? String(item.precoTotal) : null,
          quantidade: item.quantidade != null ? String(item.quantidade) : null,
          dataCotacao: item.dataCotacao ?? null,
          validadeDias: item.validadeDias ?? null,
          condicaoPagamento: item.condicaoPagamento ?? null,
          prazoEntrega: item.prazoEntrega ?? null,
          arquivoOrigemUrl: item.arquivoOrigemUrl ?? null,
          materiaPrimaId: item.materiaPrimaId ?? null,
          criadoPor: userId,
        });
      }

      return { fornecedorId, ok: true };
    }),

  /**
   * Comparativo de preços para uma matéria-prima: cotações externas de
   * outros fornecedores (funcionalidade 2), incluindo empresas que nunca
   * trabalhamos (3).
   */
  comparativoPrecosPorMateriaPrima: protectedProcedure
    .input(z.object({ materiaPrimaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Dados cadastrais da matéria-prima
      const [mp] = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          mubisysMateriaPrimaId: materiasPrimas.mubisysMateriaPrimaId,
          unidadeMedida: materiasPrimas.unidadeMedida,
          custoUnitario: materiasPrimas.custoUnitario,
        })
        .from(materiasPrimas)
        .where(eq(materiasPrimas.id, input.materiaPrimaId))
        .limit(1);

      if (!mp) return null;

      // Últimas cotações externas cadastradas para esta matéria-prima
      const cotacoesExternas = await db
        .select({
          id: cotacaoExternaItem.id,
          codigoFornecedor: cotacaoExternaItem.codigoFornecedor,
          descricao: cotacaoExternaItem.descricao,
          unidade: cotacaoExternaItem.unidade,
          precoUnitario: cotacaoExternaItem.precoUnitario,
          precoTotal: cotacaoExternaItem.precoTotal,
          quantidade: cotacaoExternaItem.quantidade,
          dataCotacao: cotacaoExternaItem.dataCotacao,
          validadeDias: cotacaoExternaItem.validadeDias,
          condicaoPagamento: cotacaoExternaItem.condicaoPagamento,
          prazoEntrega: cotacaoExternaItem.prazoEntrega,
          arquivoOrigemUrl: cotacaoExternaItem.arquivoOrigemUrl,
          vinculoDescricao: cotacaoExternaVinculo.descricaoOrigem,
          fornecedor: {
            id: cotacaoExternaFornecedor.id,
            cnpj: cotacaoExternaFornecedor.cnpj,
            nomeFantasia: cotacaoExternaFornecedor.nomeFantasia,
            razaoSocial: cotacaoExternaFornecedor.razaoSocial,
            telefone: cotacaoExternaFornecedor.telefone,
            email: cotacaoExternaFornecedor.email,
            cidade: cotacaoExternaFornecedor.cidade,
            estado: cotacaoExternaFornecedor.estado,
            jaTrabalhamos: cotacaoExternaFornecedor.jaTrabalhamos,
            createdAt: cotacaoExternaFornecedor.createdAt,
          },
        })
        .from(cotacaoExternaItem)
        .innerJoin(
          cotacaoExternaFornecedor,
          eq(cotacaoExternaFornecedor.id, cotacaoExternaItem.fornecedorId)
        )
        .leftJoin(
          cotacaoExternaVinculo,
          eq(cotacaoExternaVinculo.cotacaoItemId, cotacaoExternaItem.id)
        )
        .where(eq(cotacaoExternaItem.materiaPrimaId, input.materiaPrimaId))
        .orderBy(desc(cotacaoExternaItem.createdAt));

      return {
        materiaPrima: {
          id: mp.id,
          nome: mp.nome,
          mubisysId: mp.mubisysMateriaPrimaId,
          unidadeMedida: mp.unidadeMedida,
          custoUnitarioAtual: mp.custoUnitario
            ? Number(mp.custoUnitario)
            : null,
        },
        cotacoesExternas: cotacoesExternas.map((c) => ({
          ...c,
          precoUnitario: Number(c.precoUnitario),
          precoTotal: c.precoTotal ? Number(c.precoTotal) : null,
          quantidade: c.quantidade ? Number(c.quantidade) : null,
        })),
      };
    }),

  /**
   * Vincula uma cotação externa a um item de referência (informativo),
   * permitindo comparar preços lado a lado na tela.
   */
  vincularCotacaoExterna: protectedProcedure
    .input(
      z.object({
        descricaoOrigem: z.string().min(1, "Descrição da origem obrigatória"),
        cotacaoItemId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      await db.insert(cotacaoExternaVinculo).values({
        descricaoOrigem: input.descricaoOrigem,
        cotacaoItemId: input.cotacaoItemId,
      });

      return { ok: true };
    }),

  /**
   * Detalhe de um fornecedor externo com todos os itens da cotação,
   * incluindo o preço cadastrado da matéria-prima no MubiSys para
   * comparar lado a lado e decidir se atualiza o custo.
   */
  detalheFornecedor: protectedProcedure
    .input(z.object({ fornecedorId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [fornecedor] = await db
        .select({
          id: cotacaoExternaFornecedor.id,
          cnpj: cotacaoExternaFornecedor.cnpj,
          nomeFantasia: cotacaoExternaFornecedor.nomeFantasia,
          razaoSocial: cotacaoExternaFornecedor.razaoSocial,
          telefone: cotacaoExternaFornecedor.telefone,
          email: cotacaoExternaFornecedor.email,
          cidade: cotacaoExternaFornecedor.cidade,
          estado: cotacaoExternaFornecedor.estado,
          observacoes: cotacaoExternaFornecedor.observacoes,
          jaTrabalhamos: cotacaoExternaFornecedor.jaTrabalhamos,
          criadoPor: cotacaoExternaFornecedor.criadoPor,
          createdAt: cotacaoExternaFornecedor.createdAt,
          updatedAt: cotacaoExternaFornecedor.updatedAt,
        })
        .from(cotacaoExternaFornecedor)
        .where(eq(cotacaoExternaFornecedor.id, input.fornecedorId))
        .limit(1);

      if (!fornecedor) return null;

      const itens = await db
        .select({
          id: cotacaoExternaItem.id,
          codigoFornecedor: cotacaoExternaItem.codigoFornecedor,
          descricao: cotacaoExternaItem.descricao,
          unidade: cotacaoExternaItem.unidade,
          precoUnitario: cotacaoExternaItem.precoUnitario,
          precoTotal: cotacaoExternaItem.precoTotal,
          quantidade: cotacaoExternaItem.quantidade,
          dataCotacao: cotacaoExternaItem.dataCotacao,
          validadeDias: cotacaoExternaItem.validadeDias,
          condicaoPagamento: cotacaoExternaItem.condicaoPagamento,
          prazoEntrega: cotacaoExternaItem.prazoEntrega,
          arquivoOrigemUrl: cotacaoExternaItem.arquivoOrigemUrl,
          materiaPrimaId: cotacaoExternaItem.materiaPrimaId,
          vinculadoAoItemNf: cotacaoExternaItem.vinculadoAoItemNf,
          criadoPor: cotacaoExternaItem.criadoPor,
          createdAt: cotacaoExternaItem.createdAt,
          updatedAt: cotacaoExternaItem.updatedAt,
          materiaPrimaNome: materiasPrimas.nome,
          materiaPrimaCustoUnitario: materiasPrimas.custoUnitario,
          materiaPrimaUnidadeMedida: materiasPrimas.unidadeMedida,
        })
        .from(cotacaoExternaItem)
        .leftJoin(
          materiasPrimas,
          eq(materiasPrimas.id, cotacaoExternaItem.materiaPrimaId)
        )
        .where(eq(cotacaoExternaItem.fornecedorId, input.fornecedorId))
        .orderBy(desc(cotacaoExternaItem.createdAt));

      return {
        fornecedor,
        itens: itens.map((i) => ({
          ...i,
          precoUnitario: Number(i.precoUnitario),
          precoTotal: i.precoTotal ? Number(i.precoTotal) : null,
          quantidade: i.quantidade ? Number(i.quantidade) : null,
          materiaPrimaCustoUnitario: i.materiaPrimaCustoUnitario
            ? Number(i.materiaPrimaCustoUnitario)
            : null,
        })),
      };
    }),

  /**
   * Adiciona um item de cotação a um fornecedor já cadastrado.
   */
  adicionarItemCotacao: protectedProcedure
    .input(
      z.object({
        fornecedorId: z.number(),
        codigoFornecedor: z.string().optional().nullable(),
        descricao: z.string().min(1, "Descrição obrigatória"),
        unidade: z.string().min(1, "Unidade obrigatória"),
        precoUnitario: z.number().nonnegative(),
        precoTotal: z.number().nonnegative().optional().nullable(),
        quantidade: z.number().nonnegative().optional().nullable(),
        dataCotacao: z.string().optional().nullable(),
        validadeDias: z.number().int().nonnegative().optional().nullable(),
        condicaoPagamento: z.string().optional().nullable(),
        prazoEntrega: z.string().optional().nullable(),
        arquivoOrigemUrl: z.string().optional().nullable(),
        materiaPrimaId: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const userId = ctx.user?.id ? String(ctx.user.id) : null;

      const [item] = await db
        .insert(cotacaoExternaItem)
        .values({
          fornecedorId: input.fornecedorId,
          codigoFornecedor: input.codigoFornecedor ?? null,
          descricao: input.descricao,
          unidade: input.unidade,
          precoUnitario: String(input.precoUnitario),
          precoTotal: input.precoTotal != null ? String(input.precoTotal) : null,
          quantidade: input.quantidade != null ? String(input.quantidade) : null,
          dataCotacao: input.dataCotacao ?? null,
          validadeDias: input.validadeDias ?? null,
          condicaoPagamento: input.condicaoPagamento ?? null,
          prazoEntrega: input.prazoEntrega ?? null,
          arquivoOrigemUrl: input.arquivoOrigemUrl ?? null,
          materiaPrimaId: input.materiaPrimaId ?? null,
          criadoPor: userId,
        })
        .returning({ id: cotacaoExternaItem.id });

      return { itemId: item.id, ok: true };
    }),

  /**
   * Atualiza um item de cotação existente.
   */
  atualizarItemCotacao: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        codigoFornecedor: z.string().optional().nullable(),
        descricao: z.string().min(1, "Descrição obrigatória").optional(),
        unidade: z.string().min(1, "Unidade obrigatória").optional(),
        precoUnitario: z.number().nonnegative().optional(),
        precoTotal: z.number().nonnegative().optional().nullable(),
        quantidade: z.number().nonnegative().optional().nullable(),
        dataCotacao: z.string().optional().nullable(),
        validadeDias: z.number().int().nonnegative().optional().nullable(),
        condicaoPagamento: z.string().optional().nullable(),
        prazoEntrega: z.string().optional().nullable(),
        arquivoOrigemUrl: z.string().optional().nullable(),
        materiaPrimaId: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const userId = ctx.user?.id ? String(ctx.user.id) : null;

      const setValues: Record<string, any> = {
        updatedAt: new Date(),
      };
      if (input.codigoFornecedor !== undefined) setValues.codigoFornecedor = input.codigoFornecedor ?? null;
      if (input.descricao !== undefined) setValues.descricao = input.descricao;
      if (input.unidade !== undefined) setValues.unidade = input.unidade;
      if (input.precoUnitario !== undefined) setValues.precoUnitario = String(input.precoUnitario);
      if (input.precoTotal !== undefined) setValues.precoTotal = input.precoTotal != null ? String(input.precoTotal) : null;
      if (input.quantidade !== undefined) setValues.quantidade = input.quantidade != null ? String(input.quantidade) : null;
      if (input.dataCotacao !== undefined) setValues.dataCotacao = input.dataCotacao ?? null;
      if (input.validadeDias !== undefined) setValues.validadeDias = input.validadeDias;
      if (input.condicaoPagamento !== undefined) setValues.condicaoPagamento = input.condicaoPagamento ?? null;
      if (input.prazoEntrega !== undefined) setValues.prazoEntrega = input.prazoEntrega ?? null;
      if (input.arquivoOrigemUrl !== undefined) setValues.arquivoOrigemUrl = input.arquivoOrigemUrl ?? null;
      if (input.materiaPrimaId !== undefined) setValues.materiaPrimaId = input.materiaPrimaId ?? null;
      if (userId) setValues.criadoPor = userId;

      await db
        .update(cotacaoExternaItem)
        .set(setValues)
        .where(eq(cotacaoExternaItem.id, input.itemId));

      return { ok: true };
    }),

  /**
   * Remove um item de cotação.
   */
  removerItemCotacao: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      await db.delete(cotacaoExternaItem).where(eq(cotacaoExternaItem.id, input.itemId));

      return { ok: true };
    }),

  /**
   * Faz upload do arquivo de origem do orçamento (PDF/imagem/planilha) e
   * associa a URL ao item de cotação.
   */
  uploadArquivoCotacao: adminProcedure
    .input(
      z.object({
        itemId: z.number(),
        fileName: z.string(),
        contentType: z.string(),
        data: z.string(), // base64
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [item] = await db
        .select({ id: cotacaoExternaItem.id, fornecedorId: cotacaoExternaItem.fornecedorId })
        .from(cotacaoExternaItem)
        .where(eq(cotacaoExternaItem.id, input.itemId))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item de cotação não encontrado." });

      const buffer = Buffer.from(input.data, "base64");
      const relKey = `cotacoes-externas/fornecedor_${item.fornecedorId}/item_${item.id}/${input.fileName}`;
      const { url } = await storagePut(relKey, buffer, input.contentType);

      await db
        .update(cotacaoExternaItem)
        .set({ arquivoOrigemUrl: url, updatedAt: new Date() })
        .where(eq(cotacaoExternaItem.id, input.itemId));

      return { ok: true, url };
    }),

  /**
   * Atualiza o custo unitário da matéria-prima no espelho local do MubiSys
   * com base no preço de uma cotação externa, registrando a mudança na
   * tabela de auditoria para rastreabilidade.
   */
  atualizarCustoMateriaPrima: adminProcedure
    .input(
      z.object({
        materiaPrimaId: z.number(),
        cotacaoItemId: z.number(),
        custoNovo: z.number().positive(),
        unidade: z.string().min(1, "Unidade obrigatória"),
        observacao: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const userId = ctx.user?.id ? String(ctx.user.id) : null;

      // Verificar se o item de cotação existe e está vinculado à mesma MP
      const [item] = await db
        .select({
          id: cotacaoExternaItem.id,
          materiaPrimaId: cotacaoExternaItem.materiaPrimaId,
          precoUnitario: cotacaoExternaItem.precoUnitario,
        })
        .from(cotacaoExternaItem)
        .where(eq(cotacaoExternaItem.id, input.cotacaoItemId))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item de cotação não encontrado." });

      // Verificar se a MP existe
      const [mp] = await db
        .select({
          id: materiasPrimas.id,
          nome: materiasPrimas.nome,
          custoUnitario: materiasPrimas.custoUnitario,
        })
        .from(materiasPrimas)
        .where(eq(materiasPrimas.id, input.materiaPrimaId))
        .limit(1);

      if (!mp) throw new TRPCError({ code: "NOT_FOUND", message: "Matéria-prima não encontrada." });

      const custoAnterior = mp.custoUnitario ? Number(mp.custoUnitario) : null;

      await db.transaction(async (tx) => {
        await tx
          .update(materiasPrimas)
          .set({
            custoUnitario: String(input.custoNovo),
            updatedAt: new Date(),
          })
          .where(eq(materiasPrimas.id, input.materiaPrimaId));

        await tx.insert(cotacaoExternaAtualizacaoCusto).values({
          materiaPrimaId: input.materiaPrimaId,
          cotacaoItemId: input.cotacaoItemId,
          custoAnterior: custoAnterior != null ? String(custoAnterior) : null,
          custoNovo: String(input.custoNovo),
          unidade: input.unidade,
          observacao: input.observacao ?? null,
          criadoPor: userId,
        });
      });

      return {
        ok: true,
        materiaPrimaId: input.materiaPrimaId,
        custoAnterior,
        custoNovo: input.custoNovo,
      };
    }),
});
