import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { planosAcaoComercial } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/** CRUD simples sobre planos_acao_comercial — tabela que já existia no schema
 * mas não tinha router nem UI conectados (client/src/pages/comercial/
 * PlanosAcaoComercial.tsx é conteúdo fixo em estado local, desconectado do
 * banco). Usado para o backlog estratégico de crescimento/recompra discutido
 * com o usuário em 2026-09 (ver seção "Backlog Estratégico" na própria tela). */
export const planosAcaoComercialRouter = router({
  listar: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    return db.select().from(planosAcaoComercial).orderBy(desc(planosAcaoComercial.createdAt));
  }),

  criar: protectedProcedure
    .input(z.object({
      titulo: z.string().min(1),
      descricao: z.string().optional(),
      responsavel: z.string().optional(),
      prazo: z.string().optional(), // YYYY-MM-DD
      prioridade: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [row] = await db.insert(planosAcaoComercial).values(input).returning();
      return row;
    }),

  atualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pendente", "em_andamento", "concluido", "cancelado"]).optional(),
      prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
      responsavel: z.string().nullable().optional(),
      prazo: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...campos } = input;
      await db.update(planosAcaoComercial).set({ ...campos, updatedAt: new Date() }).where(eq(planosAcaoComercial.id, id));
      return { ok: true };
    }),

  excluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(planosAcaoComercial).where(eq(planosAcaoComercial.id, input.id));
      return { ok: true };
    }),
});
