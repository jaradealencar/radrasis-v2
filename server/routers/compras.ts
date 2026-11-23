import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc, inArray, ilike, or, sql } from "drizzle-orm";
import { comprasLogisticaHistorico } from "../../drizzle/schema";
import {
  calcularFreteCompra,
  logisticaCompraSchema,
} from "../../shared/compras-frete";
import {
  consultarOrdemFrete,
  fornecedorDaOrdemConfere,
  snapshotFreteNf,
} from "../services/comprasFrete";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import {
  comprasCotacoes as cotacoes,
  comprasCotacaoItens as itens,
  comprasOrdens as ordens,
  comprasOrdemNfs as vinculos,
  comprasCompradores as compradores,
  materiasPrimas,
  nfCompraImportacoes as nfs,
  nfCompraItens as nfItens,
} from "../../drizzle/schema";
import {
  cotacaoCompraSchema,
  ordemCompraSchema,
  precoConsumo,
  unidadeConsumo,
  menorCotacaoDisponivel,
  type LinhaOrdemCompra,
} from "../../shared/compras-cotacoes";

async function banco() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco indisponível.",
    });
  return db;
}
const perfilSchema = z.object({
  nome: z.string().trim().min(3).max(256),
  documento: z.string().max(18),
  inscricaoEstadual: z.string().max(32),
});
const cadastrosSchema = z.object({
  empresa: perfilSchema,
  pessoa: perfilSchema,
  endereco: z.string().max(512),
  emailNf: z.string().max(256),
});
const filtrosSchema = z.object({
  materiaPrimaId: z.number().int().positive().optional(),
  inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const comprasRouter = router({
  compradores: protectedProcedure.query(async () => {
    const db = await banco();
    const [cadastro] = await db
      .select()
      .from(compradores)
      .where(eq(compradores.id, 1));
    // Dados da empresa conferidos no destinatário da NF-e nf-aczinox-213876.xml.
    return (
      cadastro?.dados ?? {
        empresa: {
          nome: "Radra Indústria LTDA",
          documento: "11.073.532/0001-75",
          inscricaoEstadual: "283557532",
        },
        pessoa: {
          nome: "Daniel Jara de Alencar",
          documento: "744.911.131-49",
          inscricaoEstadual: "",
        },
        endereco:
          "Rua Pedro de Toledo, 306, Vila Piratininga, CEP 79081-030, Campo Grande/MS",
        emailNf: "radrafinanceiro@gmail.com",
      }
    );
  }),
  salvarCompradores: protectedProcedure
    .input(cadastrosSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      await db
        .insert(compradores)
        .values({ id: 1, dados: input, atualizadoPor: ctx.user.id })
        .onConflictDoUpdate({
          target: compradores.id,
          set: {
            dados: input,
            atualizadoPor: ctx.user.id,
            updatedAt: new Date(),
          },
        });
      return { ok: true };
    }),
  salvarCotacao: protectedProcedure
    .input(cotacaoCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const [existente] = await tx
          .select()
          .from(cotacoes)
          .where(eq(cotacoes.chave, input.chave));
        if (existente) return { id: existente.id };
        const ids = [
          ...new Set(
            input.itens.flatMap(i =>
              i.materiaPrimaId ? [i.materiaPrimaId] : []
            )
          ),
        ];
        const mps = ids.length
          ? await tx
              .select()
              .from(materiasPrimas)
              .where(inArray(materiasPrimas.id, ids))
          : [];
        const catalogo = new Map(mps.map(mp => [mp.id, mp]));
        const linhas = input.itens.map(i => {
          const mp = i.materiaPrimaId ? catalogo.get(i.materiaPrimaId) : null;
          if (i.materiaPrimaId && !mp)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Matéria-prima não encontrada.",
            });
          const destino = mp
            ? unidadeConsumo(mp.unidadeMedida)
            : i.unidadeDestino
              ? unidadeConsumo(i.unidadeDestino)
              : null;
          const identica = destino && unidadeConsumo(i.unidade) === destino;
          const fator = i.fatorConversao ?? (identica ? 1 : null);
          if (
            fator &&
            (!destino ||
              (i.unidadeDestino &&
                unidadeConsumo(i.unidadeDestino) !== destino))
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "A unidade de consumo deve ser igual à do cadastro da matéria-prima.",
            });
          return {
            codigo: i.codigo,
            descricao: i.descricao,
            materiaPrimaId: i.materiaPrimaId,
            nomeMateriaPrima: mp?.nome,
            quantidade: String(i.quantidade),
            unidade: i.unidade,
            precoUnitario: String(i.precoUnitario),
            unidadeOrigem: i.unidadeOrigem ?? i.unidade,
            unidadeDestino: destino,
            fatorConversao: fator ? String(fator) : null,
            formula: i.formula,
            custoMubisys: mp?.custoUnitario,
          };
        });
        const freteCalculado = calcularFreteCompra(
          input.freteModo,
          input.freteValorInformado ?? input.frete,
          input.pesoFreteKg
        ).total;
        const total =
          input.itens.reduce(
            (s, i) =>
              s + Math.round(i.quantidade * i.precoUnitario * 100) / 100,
            0
          ) + (freteCalculado ?? 0);
        const [cotacao] = await tx
          .insert(cotacoes)
          .values({
            ...input,
            total: total.toFixed(2),
            frete: freteCalculado == null ? null : freteCalculado.toFixed(2),
            freteValorInformado:
              input.freteValorInformado == null
                ? input.frete == null
                  ? null
                  : String(input.frete)
                : String(input.freteValorInformado),
            pesoFreteKg:
              input.pesoFreteKg == null ? null : String(input.pesoFreteKg),
            criadoPor: ctx.user.id,
          })
          .onConflictDoNothing({ target: cotacoes.chave })
          .returning();
        if (!cotacao) {
          const [outra] = await tx
            .select()
            .from(cotacoes)
            .where(eq(cotacoes.chave, input.chave));
          return { id: outra.id };
        }
        await tx
          .insert(itens)
          .values(linhas.map(i => ({ ...i, cotacaoId: cotacao.id })));
        return { id: cotacao.id };
      });
    }),
  listarCotacoes: protectedProcedure.query(async () =>
    (await banco())
      .select()
      .from(cotacoes)
      .orderBy(desc(cotacoes.id))
      .limit(200)
  ),
  obterCotacao: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await banco();
      const [cotacao] = await db
        .select()
        .from(cotacoes)
        .where(eq(cotacoes.id, input.id));
      if (!cotacao)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cotação não encontrada.",
        });
      return {
        ...cotacao,
        itens: await db
          .select()
          .from(itens)
          .where(eq(itens.cotacaoId, input.id))
          .orderBy(itens.id),
      };
    }),
  emitirOrdem: protectedProcedure
    .input(ordemCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const [anterior] = await tx
          .select()
          .from(ordens)
          .where(eq(ordens.chave, input.chave));
        if (anterior) return anterior;
        const [cotacao] = await tx
          .select()
          .from(cotacoes)
          .where(eq(cotacoes.id, input.cotacaoId));
        if (!cotacao)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Cotação não encontrada.",
          });
        if (
          input.comprador.tipo === "empresa" &&
          !input.comprador.inscricaoEstadual.trim()
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe a inscrição estadual da empresa.",
          });
        const origens = await tx
          .select()
          .from(itens)
          .where(eq(itens.cotacaoId, input.cotacaoId));
        const linhas: LinhaOrdemCompra[] = input.itens.map(i => {
          const origem = origens.find(o => o.id === i.itemId);
          if (!origem)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Item não pertence à cotação.",
            });
          const precoCotado = Number(origem.precoUnitario);
          const preco = i.precoUnitario;
          return {
            itemId: origem.id,
            materiaPrimaId: origem.materiaPrimaId,
            codigo: origem.codigo,
            descricao: origem.descricao,
            unidade: origem.unidade,
            quantidade: i.quantidade,
            precoUnitario: preco,
            precoCotadoUnitario: precoCotado,
            total: Math.round(i.quantidade * preco * 100) / 100,
            unidadeDestino: origem.unidadeDestino,
            fatorConversao: origem.fatorConversao
              ? Number(origem.fatorConversao)
              : null,
            formula: origem.formula,
          };
        });
        const valorInformado = input.freteValorInformado ?? input.frete;
        const frete = calcularFreteCompra(
          input.freteModo,
          valorInformado,
          input.pesoPrevistoKg
        ).total;
        const total = linhas.reduce((s, l) => s + l.total, 0) + (frete ?? 0);
        const [ordem] = await tx
          .insert(ordens)
          .values({
            ...input,
            itens: linhas,
            frete: (frete ?? 0).toFixed(2),
            freteValorInformado: String(valorInformado),
            pesoPrevistoKg:
              input.pesoPrevistoKg == null
                ? null
                : String(input.pesoPrevistoKg),
            total: total.toFixed(2),
            criadoPor: ctx.user.id,
          })
          .onConflictDoNothing({ target: ordens.chave })
          .returning();
        if (ordem) return ordem;
        const [outra] = await tx
          .select()
          .from(ordens)
          .where(eq(ordens.chave, input.chave));
        return outra;
      });
    }),
  listarOrdens: protectedProcedure
    .input(
      z
        .object({
          busca: z.string().max(256).optional(),
          inicio: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          fim: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          pagina: z.number().int().nonnegative().default(0),
          cnpjFornecedor: z.string().optional(),
        })
        .default({ pagina: 0 })
    )
    .query(async ({ input }) =>
      (await banco())
        .select({ ordem: ordens, fornecedor: cotacoes.fornecedor })
        .from(ordens)
        .innerJoin(cotacoes, eq(cotacoes.id, ordens.cotacaoId))
        .where(
          and(
            input.busca
              ? or(
                  ilike(cotacoes.fornecedor, `%${input.busca}%`),
                  ilike(ordens.transportadora, `%${input.busca}%`),
                  sql`cast(${ordens.id} as text) = ${input.busca}`
                )
              : undefined,
            input.inicio
              ? sql`(${ordens.createdAt} at time zone 'UTC' at time zone 'America/Campo_Grande')::date >= ${input.inicio}::date`
              : undefined,
            input.fim
              ? sql`(${ordens.createdAt} at time zone 'UTC' at time zone 'America/Campo_Grande')::date <= ${input.fim}::date`
              : undefined,
            input.cnpjFornecedor
              ? sql`regexp_replace(coalesce(${cotacoes.cnpjFornecedor}, ''), '[^0-9]', '', 'g') = ${input.cnpjFornecedor.replace(/\D/g, "")}`
              : undefined
          )
        )
        .orderBy(desc(ordens.id))
        .limit(50)
        .offset(input.pagina * 50)
    ),
  obterOrdemFrete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await banco();
      return {
        ...(await consultarOrdemFrete(db, input.id)),
        historico: await db
          .select()
          .from(comprasLogisticaHistorico)
          .where(eq(comprasLogisticaHistorico.ordemId, input.id))
          .orderBy(desc(comprasLogisticaHistorico.revisao)),
      };
    }),
  atualizarLogistica: protectedProcedure
    .input(logisticaCompraSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const atual = await consultarOrdemFrete(tx, input.ordemId, true);
        if (atual.ordem.logisticaRevisao !== input.revisao)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A logística foi alterada. Reabra a ordem para atualizar os dados.",
          });
        const frete = calcularFreteCompra(
          input.freteModo,
          input.freteValorInformado ?? input.frete,
          input.pesoPrevistoKg
        ).total;
        if (
          input.freteModo !== "por_kg" &&
          (frete ?? 0) + 0.001 < atual.utilizado
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O frete total não pode ser menor que o valor já aplicado às NFs.",
          });
        const revisao = input.revisao + 1;
        const { ordemId, revisao: _, ...dados } = input;
        const subtotal = atual.ordem.itens.reduce((s, i) => s + i.total, 0);
        await tx
          .update(ordens)
          .set({
            ...dados,
            frete: (frete ?? 0).toFixed(2),
            freteValorInformado: String(
              input.freteValorInformado ?? input.frete
            ),
            pesoPrevistoKg:
              input.pesoPrevistoKg == null
                ? null
                : String(input.pesoPrevistoKg),
            logisticaRevisao: revisao,
            total: (subtotal + (frete ?? 0)).toFixed(2),
          })
          .where(eq(ordens.id, ordemId));
        await tx
          .insert(comprasLogisticaHistorico)
          .values({ ordemId, revisao, dados, criadoPor: ctx.user.id });
        return { ok: true };
      });
    }),
  vincularNf: protectedProcedure
    .input(
      z.object({
        ordemId: z.number().int().positive(),
        importacaoId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await banco();
      return db.transaction(async tx => {
        const ordemFrete = await consultarOrdemFrete(tx, input.ordemId, true);
        const [registro] = await tx
          .select({ cnpj: cotacoes.cnpjFornecedor, nome: cotacoes.fornecedor })
          .from(ordens)
          .innerJoin(cotacoes, eq(cotacoes.id, ordens.cotacaoId))
          .where(eq(ordens.id, input.ordemId));
        const [nf] = await tx
          .select()
          .from(nfs)
          .where(eq(nfs.id, input.importacaoId))
          .for("update");
        if (!registro || !nf || nf.status !== "concluida")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione uma ordem e uma NF concluída.",
          });
        const digitos = (s: string | null) => (s ?? "").replace(/\D/g, "");
        const nome = (s: string | null) =>
          (s ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
        if (
          registro.cnpj
            ? digitos(registro.cnpj) !== digitos(nf.cnpjFornecedor)
            : nome(registro.nome) !== nome(nf.nomeFornecedor)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A NF pertence a outro fornecedor.",
          });
        const [existente] = await tx
          .select()
          .from(vinculos)
          .where(eq(vinculos.importacaoId, input.importacaoId));
        if (existente && existente.ordemId !== input.ordemId)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esta NF já está associada a outra ordem.",
          });
        if (existente) return { ok: true };
        const snapshot = snapshotFreteNf(
          ordemFrete,
          Number(nf.valorFreteNf),
          nf.pesoLiquidoTotalKg ? Number(nf.pesoLiquidoTotalKg) : null
        );
        if (Math.abs(snapshot.freteAplicado - Number(nf.valorFreteNf)) > 0.005)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O frete desta NF já auditada difere da tarifa da ordem. Revise os valores antes de vincular; o custo antigo não será alterado silenciosamente.",
          });
        await tx
          .insert(vinculos)
          .values({
            ...input,
            criadoPor: ctx.user.id,
            logisticaSnapshot: snapshot,
          })
          .onConflictDoNothing();
        return { ok: true };
      });
    }),
  painel: protectedProcedure.input(filtrosSchema).query(async ({ input }) => {
    const db = await banco();
    const cotados = await db
      .select({ item: itens, cotacao: cotacoes })
      .from(itens)
      .innerJoin(cotacoes, eq(cotacoes.id, itens.cotacaoId))
      .where(
        input.materiaPrimaId
          ? eq(itens.materiaPrimaId, input.materiaPrimaId)
          : undefined
      )
      .orderBy(desc(cotacoes.dataCotacao), desc(itens.id))
      .limit(5000);
    const comprados = await db
      .select({
        item: nfItens,
        nf: nfs,
        ordemId: vinculos.ordemId,
        dataOrdem: ordens.createdAt,
        nome: materiasPrimas.nome,
      })
      .from(nfItens)
      .innerJoin(nfs, eq(nfs.id, nfItens.importacaoId))
      .leftJoin(vinculos, eq(vinculos.importacaoId, nfs.id))
      .leftJoin(ordens, eq(ordens.id, vinculos.ordemId))
      .leftJoin(materiasPrimas, eq(materiasPrimas.id, nfItens.materiaPrimaId))
      .where(
        and(
          eq(nfs.status, "concluida"),
          input.materiaPrimaId
            ? eq(nfItens.materiaPrimaId, input.materiaPrimaId)
            : undefined
        )
      )
      .orderBy(desc(nfs.createdAt), desc(nfItens.id))
      .limit(5000);
    const referencias = cotados.map(({ item, cotacao }) => ({
      materiaPrimaId: item.materiaPrimaId,
      unidade: item.unidadeDestino ?? "",
      preco: precoConsumo(
        Number(item.precoUnitario),
        item.fatorConversao ? Number(item.fatorConversao) : null,
        item.unidadeDestino
      ),
      data: cotacao.dataCotacao,
      fornecedor: cotacao.fornecedor,
      cotacaoId: cotacao.id,
      validadeDias: cotacao.validadeDias,
      quantidade: Number(item.quantidade),
      fator: item.fatorConversao ? Number(item.fatorConversao) : null,
    }));
    const noPeriodo = (d: string) =>
      (!input.inicio || d >= input.inicio) && (!input.fim || d <= input.fim);
    const pontos = cotados.map(({ item, cotacao }) => ({
      origem: "Cotação" as const,
      id: item.id,
      documentoId: cotacao.id,
      data: cotacao.dataCotacao,
      materiaPrimaId: item.materiaPrimaId,
      nome: item.nomeMateriaPrima ?? item.descricao,
      fornecedor: cotacao.fornecedor,
      unidade: item.unidadeDestino ?? item.unidade,
      preco: precoConsumo(
        Number(item.precoUnitario),
        item.fatorConversao ? Number(item.fatorConversao) : null,
        item.unidadeDestino
      ),
      precoOriginal: Number(item.precoUnitario),
      unidadeOriginal: item.unidade,
      quantidade: Number(item.quantidade),
      custoFinal: null as number | null,
      ordemId: null as number | null,
      menor: null as (typeof referencias)[number] | null,
      diferenca: null as number | null,
    }));
    for (const { item, nf, ordemId, dataOrdem, nome } of comprados) {
      const data = (nf.dataEmissao ?? nf.createdAt.toISOString()).slice(0, 10);
      const fator = item.fatorConversao ? Number(item.fatorConversao) : null;
      const preco = precoConsumo(
        Number(item.valorUnitario),
        fator,
        item.unidadeErp
      );
      const dataDecisao = dataOrdem
        ? dataOrdem.toLocaleDateString("en-CA", {
            timeZone: "America/Campo_Grande",
          })
        : data;
      const menor =
        preco == null
          ? null
          : menorCotacaoDisponivel(referencias, {
              materiaPrimaId: item.materiaPrimaId,
              unidade: item.unidadeErp ?? "",
              data: dataDecisao,
              quantidade: Number(item.quantidadeErp ?? 0),
            });
      pontos.push({
        origem: "NF" as "Cotação",
        id: item.id,
        documentoId: nf.id,
        data,
        materiaPrimaId: item.materiaPrimaId,
        nome: nome ?? item.descricaoNf,
        fornecedor: nf.nomeFornecedor ?? nf.cnpjFornecedor,
        unidade: item.unidadeErp ?? item.unidadeCompra,
        preco,
        precoOriginal: Number(item.valorUnitario),
        unidadeOriginal: item.unidadeCompra,
        quantidade: Number(item.quantidade),
        custoFinal: item.custoRealErp ? Number(item.custoRealErp) : null,
        ordemId,
        menor,
        diferenca:
          menor && preco != null
            ? (preco - menor.preco!) * Number(item.quantidadeErp ?? 0)
            : null,
      });
    }
    return {
      pontos: pontos
        .filter(p => noPeriodo(p.data))
        .sort((a, b) => a.data.localeCompare(b.data)),
      limiteAtingido: cotados.length === 5000 || comprados.length === 5000,
    };
  }),
  auditarOrdem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await banco();
      const [ordem] = await db
        .select()
        .from(ordens)
        .where(eq(ordens.id, input.id));
      if (!ordem)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ordem não encontrada.",
        });
      const recebidos = await db
        .select({ item: nfItens, nf: nfs })
        .from(vinculos)
        .innerJoin(nfs, eq(nfs.id, vinculos.importacaoId))
        .innerJoin(nfItens, eq(nfItens.importacaoId, nfs.id))
        .where(eq(vinculos.ordemId, input.id));
      return {
        ordem,
        recebidos,
        nfs: [...new Map(recebidos.map(r => [r.nf.id, r.nf])).values()],
      };
    }),
});
