import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db/db";
import { metricas } from "../../drizzle/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";

export const metricasRouter = router({
  list: publicProcedure
    .input(z.object({
      nome: z.string().optional(),
      dataInicio: z.string().optional(), // AAAA-MM-DD
      dataFim: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input?.nome) conditions.push(eq(metricas.nome, input.nome));
      if (input?.dataInicio) conditions.push(gte(metricas.dataApuracao, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(metricas.dataApuracao, input.dataFim));

      return db.select().from(metricas)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(metricas.dataApuracao), desc(metricas.id));
    }),

  nomesDistintos: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.selectDistinct({ nome: metricas.nome }).from(metricas);
    return rows.map((r) => r.nome).sort((a, b) => a.localeCompare(b));
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(1, "Informe o nome do indicador"),
      valor: z.number(),
      unidade: z.string().max(16).default("%"),
      dataApuracao: z.string(), // AAAA-MM-DD
      observacao: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const [row] = await db.insert(metricas).values({
        nome: input.nome.trim(),
        valor: String(input.valor),
        unidade: input.unidade,
        dataApuracao: input.dataApuracao,
        observacao: input.observacao ?? null,
        criadoPorNome: ctx.user?.name ?? ctx.user?.email ?? "sistema",
      }).returning();
      return row;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1).optional(),
      valor: z.number().optional(),
      unidade: z.string().max(16).optional(),
      dataApuracao: z.string().optional(),
      observacao: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const { id, valor, ...rest } = input;
      const [row] = await db.update(metricas).set({
        ...rest,
        ...(valor !== undefined ? { valor: String(valor) } : {}),
        updatedAt: new Date(),
      }).where(eq(metricas.id, id)).returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.delete(metricas).where(eq(metricas.id, input.id));
      return { success: true };
    }),
});
