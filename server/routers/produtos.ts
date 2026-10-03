/**
 * Cadastro de Produtos (composição de matéria-prima, kit e vínculo com a
 * Tabela de Preços). Produto é local (nome/categoria só chega via vínculo
 * com o catálogo do MubiSys) porque a API pública do MubiSys não expõe
 * composição — ver AGENTS.md "Pontas soltas conhecidas" e
 * shared/produto-composicao.ts.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb, listPriceTableSections } from "../db/db";
import { produtos, produtoComposicaoMateriais, produtoKitItens } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { listarProdutos, listarMateriasPrimas } from "../integrations/mubisys-client";
import { UNIDADE_CONSUMO_MATERIA_PRIMA } from "../../shared/produto-composicao";
import type { ConfigItem, MarginRow } from "../../shared/price-table";

const unidadeConsumoSchema = z.enum(UNIDADE_CONSUMO_MATERIA_PRIMA);

/** Procura o id (linha de margem ou regra de config) em todas as seções da
 *  Tabela de Preços, pra mostrar a que ele corresponde no cadastro do
 *  produto — sem resolver faixa/coluna automaticamente (decisão do usuário
 *  28/09/2026, ver drizzle/schema.ts em `produtos.idPrecificacao`). */
async function buscarPrecificacaoPorId(
  id: number,
): Promise<{ secaoTitulo: string; pagina: number; rotulo: string; valores: string[] } | null> {
  const secoes = await listPriceTableSections();
  for (const sec of secoes) {
    let conteudo: { type?: string; rows?: MarginRow[]; items?: ConfigItem[] };
    try {
      conteudo = JSON.parse(sec.contentJson);
    } catch {
      continue;
    }
    const isMargin = conteudo.type === "margin_table" || conteudo.type === "margin_table_multi";
    if (isMargin) {
      const linha = (conteudo.rows ?? []).find((r) => r.id === id);
      if (linha) {
        return { secaoTitulo: sec.sectionTitle, pagina: sec.page, rotulo: linha.label, valores: linha.values };
      }
    }
    if (conteudo.type === "config") {
      const item = (conteudo.items ?? []).find((it) => it.id === id);
      if (item) {
        return { secaoTitulo: sec.sectionTitle, pagina: sec.page, rotulo: item.label, valores: [item.value] };
      }
    }
  }
  return null;
}

export const produtosRouter = router({
  // ─── Busca no catálogo do MubiSys (pra vincular ao criar produto) ───────
  buscarMubisys: protectedProcedure
    .input(z.object({ busca: z.string().optional().default("") }))
    .query(async ({ input }) => {
      const termo = input.busca.trim().toLowerCase();
      const produtosMubisys = await listarProdutos();
      return produtosMubisys
        .filter((p) => !termo || p.nome?.toLowerCase().includes(termo))
        .slice(0, 30)
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          categoria: p.categoria || "",
          status: p.status,
          modelos: (p.modelos ?? []).map((m) => ({ id: m.id, nome: m.nome })),
        }));
    }),

  // ─── Busca de matéria-prima no MubiSys (traz o custo ao vivo) ───────────
  buscarMateriaPrimaMubisys: protectedProcedure
    .input(z.object({ busca: z.string().optional().default("") }))
    .query(async ({ input }) => {
      const termo = input.busca.trim().toLowerCase();
      const materiais = await listarMateriasPrimas();
      return materiais
        .filter((m) => !termo || m.nome?.toLowerCase().includes(termo))
        .slice(0, 30)
        .map((m) => ({
          id: m.id,
          nome: m.nome,
          unidadeCusto: m.unidade_custo,
          unidadeMovimentacao: m.unidade_movimentacao,
          valorCusto: Number(m.valor_custo ?? 0),
          status: m.status,
        }));
    }),

  // ─── CRUD local de produtos ─────────────────────────────────────────────
  listar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(produtos).orderBy(asc(produtos.nome));
  }),

  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [produto] = await db.select().from(produtos).where(eq(produtos.id, input.id));
      if (!produto) return null;

      const composicao = await db
        .select()
        .from(produtoComposicaoMateriais)
        .where(eq(produtoComposicaoMateriais.produtoId, input.id))
        .orderBy(asc(produtoComposicaoMateriais.ordem));

      // Uma chamada só à API cobre o custo ao vivo de todas as linhas da composição.
      let custoPorId = new Map<number, number>();
      try {
        const materiais = await listarMateriasPrimas();
        custoPorId = new Map(materiais.map((m) => [m.id, Number(m.valor_custo ?? 0)]));
      } catch {
        // MubiSys fora do ar: mostra a composição sem custo ao vivo em vez de quebrar a tela.
      }

      const composicaoComCusto = composicao.map((item) => ({
        ...item,
        custoUnitarioAtual: custoPorId.get(item.mubisysMateriaPrimaId) ?? null,
      }));

      const kit = await db
        .select({
          id: produtoKitItens.id,
          produtoAssociadoId: produtoKitItens.produtoAssociadoId,
          quantidade: produtoKitItens.quantidade,
          nomeAssociado: produtos.nome,
        })
        .from(produtoKitItens)
        .innerJoin(produtos, eq(produtoKitItens.produtoAssociadoId, produtos.id))
        .where(eq(produtoKitItens.produtoId, input.id));

      const custoMateriaPrima = composicaoComCusto.reduce((soma, item) => {
        const custo = item.custoUnitarioAtual ?? 0;
        return soma + custo * Number(item.quantidade);
      }, 0);
      const custoComFixo = custoMateriaPrima * (1 + Number(produto.percentualCustoFixo) / 100);

      const precificacao =
        produto.idPrecificacao != null ? await buscarPrecificacaoPorId(produto.idPrecificacao) : null;

      return { produto, composicao: composicaoComCusto, kit, custoMateriaPrima, custoComFixo, precificacao };
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        mubisysProdutoId: z.number(),
        mubisysModeloId: z.number(),
        nome: z.string().min(1),
        categoria: z.string().optional(),
        ativo: z.boolean().optional().default(true),
        percentualCustoFixo: z.number().min(0).max(1000).optional().default(0),
        idPrecificacao: z.number().optional(),
        prazoFabricacaoDiasUteis: z.number().int().min(0).optional(),
        instagramUrl: z.string().optional(),
        observacao: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      const values = {
        mubisysProdutoId: data.mubisysProdutoId,
        mubisysModeloId: data.mubisysModeloId,
        nome: data.nome,
        categoria: data.categoria || null,
        ativo: data.ativo,
        percentualCustoFixo: String(data.percentualCustoFixo),
        idPrecificacao: data.idPrecificacao ?? null,
        prazoFabricacaoDiasUteis: data.prazoFabricacaoDiasUteis ?? null,
        instagramUrl: data.instagramUrl || null,
        observacao: data.observacao || null,
        updatedAt: new Date(),
      };
      if (id) {
        await db.update(produtos).set(values).where(eq(produtos.id, id));
        return { success: true, id };
      }
      const [result] = await db.insert(produtos).values(values).returning({ id: produtos.id });
      return { success: true, id: result.id };
    }),

  remover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(produtos).where(eq(produtos.id, input.id));
      return { success: true };
    }),

  // ─── Composição de matéria-prima ────────────────────────────────────────
  composicaoAdicionar: protectedProcedure
    .input(
      z.object({
        produtoId: z.number(),
        mubisysMateriaPrimaId: z.number(),
        materialNome: z.string().min(1),
        mubisysVariacaoId: z.number().int().positive().nullable().optional(),
        variacaoNome: z.string().max(256).nullable().optional(),
        variacaoPadrao: z.boolean().optional().default(false),
        unidadeConsumo: unidadeConsumoSchema,
        quantidade: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const existentes = await db
        .select({ id: produtoComposicaoMateriais.id })
        .from(produtoComposicaoMateriais)
        .where(eq(produtoComposicaoMateriais.produtoId, input.produtoId));
      const [result] = await db
        .insert(produtoComposicaoMateriais)
        .values({
          produtoId: input.produtoId,
          mubisysMateriaPrimaId: input.mubisysMateriaPrimaId,
          materialNome: input.materialNome,
          mubisysVariacaoId: input.mubisysVariacaoId ?? null,
          variacaoNome: input.variacaoNome ?? null,
          variacaoPadrao: input.variacaoPadrao,
          unidadeConsumo: input.unidadeConsumo,
          quantidade: String(input.quantidade),
          ordem: existentes.length,
        })
        .returning({ id: produtoComposicaoMateriais.id });
      return { success: true, id: result.id };
    }),

  composicaoImportarMubisys: protectedProcedure
    .input(
      z.object({
        produtoId: z.number(),
        linhas: z.array(
          z.object({
            mubisysMateriaPrimaId: z.number().int().positive(),
            materialNome: z.string().min(1).max(256),
            mubisysVariacaoId: z.number().int().positive().nullable().optional(),
            variacaoNome: z.string().max(256).nullable().optional(),
            variacaoPadrao: z.boolean().optional().default(false),
            unidadeConsumo: unidadeConsumoSchema,
            quantidade: z.number().min(0).max(99999999.9999),
          }),
        ).min(1).max(500),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [produto] = await db.select({ id: produtos.id }).from(produtos).where(eq(produtos.id, input.produtoId));
      if (!produto) throw new Error("Produto não encontrado.");

      const existentes = await db
        .select({
          id: produtoComposicaoMateriais.id,
          mubisysMateriaPrimaId: produtoComposicaoMateriais.mubisysMateriaPrimaId,
          mubisysVariacaoId: produtoComposicaoMateriais.mubisysVariacaoId,
          unidadeConsumo: produtoComposicaoMateriais.unidadeConsumo,
          ordem: produtoComposicaoMateriais.ordem,
        })
        .from(produtoComposicaoMateriais)
        .where(eq(produtoComposicaoMateriais.produtoId, input.produtoId))
        .orderBy(asc(produtoComposicaoMateriais.ordem));

      let proximaOrdem = existentes.reduce((maior, item) => Math.max(maior, item.ordem), -1) + 1;
      let atualizadas = 0;
      let adicionadas = 0;

      for (const linha of input.linhas) {
        const indiceExistente = existentes.findIndex(
          item => item.mubisysMateriaPrimaId === linha.mubisysMateriaPrimaId
            && item.mubisysVariacaoId === (linha.mubisysVariacaoId ?? null)
            && item.unidadeConsumo === linha.unidadeConsumo,
        );
        const existente = indiceExistente >= 0 ? existentes.splice(indiceExistente, 1)[0] : undefined;

        if (existente) {
          await db
            .update(produtoComposicaoMateriais)
            .set({
              materialNome: linha.materialNome,
              mubisysVariacaoId: linha.mubisysVariacaoId ?? null,
              variacaoNome: linha.variacaoNome ?? null,
              variacaoPadrao: linha.variacaoPadrao,
              quantidade: String(linha.quantidade),
              updatedAt: new Date(),
            })
            .where(eq(produtoComposicaoMateriais.id, existente.id));
          atualizadas++;
        } else {
          await db.insert(produtoComposicaoMateriais).values({
            produtoId: input.produtoId,
            mubisysMateriaPrimaId: linha.mubisysMateriaPrimaId,
            materialNome: linha.materialNome,
            mubisysVariacaoId: linha.mubisysVariacaoId ?? null,
            variacaoNome: linha.variacaoNome ?? null,
            variacaoPadrao: linha.variacaoPadrao,
            unidadeConsumo: linha.unidadeConsumo,
            quantidade: String(linha.quantidade),
            ordem: proximaOrdem++,
          });
          adicionadas++;
        }
      }

      return { success: true, atualizadas, adicionadas };
    }),

  composicaoClonar: protectedProcedure
    .input(z.object({ produtoId: z.number().int().positive(), produtoOrigemId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      if (input.produtoId === input.produtoOrigemId) {
        throw new Error("Escolha outro produto para clonar a composição.");
      }
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [[destino], [origem]] = await Promise.all([
        db.select({ id: produtos.id }).from(produtos).where(eq(produtos.id, input.produtoId)),
        db.select({ id: produtos.id }).from(produtos).where(eq(produtos.id, input.produtoOrigemId)),
      ]);
      if (!destino || !origem) throw new Error("Produto de origem ou destino não encontrado.");

      const [composicaoOrigem, composicaoDestino, kitsOrigem, kitsDestino] = await Promise.all([
        db.select().from(produtoComposicaoMateriais)
          .where(eq(produtoComposicaoMateriais.produtoId, input.produtoOrigemId))
          .orderBy(asc(produtoComposicaoMateriais.ordem)),
        db.select().from(produtoComposicaoMateriais)
          .where(eq(produtoComposicaoMateriais.produtoId, input.produtoId))
          .orderBy(asc(produtoComposicaoMateriais.ordem)),
        db.select().from(produtoKitItens)
          .where(eq(produtoKitItens.produtoId, input.produtoOrigemId))
          .orderBy(asc(produtoKitItens.id)),
        db.select().from(produtoKitItens)
          .where(eq(produtoKitItens.produtoId, input.produtoId))
          .orderBy(asc(produtoKitItens.id)),
      ]);
      if (!composicaoOrigem.length && !kitsOrigem.length) {
        throw new Error("O produto de origem não tem matérias-primas nem itens de kit para clonar.");
      }

      for (const [ordem, material] of composicaoOrigem.entries()) {
        const valores = {
          mubisysMateriaPrimaId: material.mubisysMateriaPrimaId,
          materialNome: material.materialNome,
          mubisysVariacaoId: material.mubisysVariacaoId,
          variacaoNome: material.variacaoNome,
          variacaoPadrao: material.variacaoPadrao,
          unidadeConsumo: material.unidadeConsumo,
          quantidade: material.quantidade,
          ordem,
          updatedAt: new Date(),
        };
        const existente = composicaoDestino[ordem];
        if (existente) {
          await db.update(produtoComposicaoMateriais).set(valores)
            .where(eq(produtoComposicaoMateriais.id, existente.id));
        } else {
          await db.insert(produtoComposicaoMateriais).values({ produtoId: input.produtoId, ...valores });
        }
      }

      for (const extra of composicaoDestino.slice(composicaoOrigem.length)) {
        await db.delete(produtoComposicaoMateriais).where(eq(produtoComposicaoMateriais.id, extra.id));
      }

      const kitsCopiados = kitsOrigem.filter((item) => item.produtoAssociadoId !== input.produtoId);
      for (const [ordem, item] of kitsCopiados.entries()) {
        const valores = {
          produtoAssociadoId: item.produtoAssociadoId,
          quantidade: item.quantidade,
        };
        const existente = kitsDestino[ordem];
        if (existente) {
          await db.update(produtoKitItens).set(valores).where(eq(produtoKitItens.id, existente.id));
        } else {
          await db.insert(produtoKitItens).values({ produtoId: input.produtoId, ...valores });
        }
      }

      for (const extra of kitsDestino.slice(kitsCopiados.length)) {
        await db.delete(produtoKitItens).where(eq(produtoKitItens.id, extra.id));
      }

      return {
        success: true,
        materias: composicaoOrigem.length,
        itensKit: kitsCopiados.length,
        kitsIgnorados: kitsOrigem.length - kitsCopiados.length,
      };
    }),

  composicaoRemover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(produtoComposicaoMateriais).where(eq(produtoComposicaoMateriais.id, input.id));
      return { success: true };
    }),

  // ─── Kit (produtos que acompanham a venda) ──────────────────────────────
  kitAdicionar: protectedProcedure
    .input(
      z.object({
        produtoId: z.number(),
        produtoAssociadoId: z.number(),
        quantidade: z.number().min(0.0001).optional().default(1),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.produtoId === input.produtoAssociadoId) {
        throw new Error("Um produto não pode acompanhar a si mesmo no kit.");
      }
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db
        .insert(produtoKitItens)
        .values({
          produtoId: input.produtoId,
          produtoAssociadoId: input.produtoAssociadoId,
          quantidade: String(input.quantidade),
        })
        .returning({ id: produtoKitItens.id });
      return { success: true, id: result.id };
    }),

  kitRemover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(produtoKitItens).where(eq(produtoKitItens.id, input.id));
      return { success: true };
    }),
});
