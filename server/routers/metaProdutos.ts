import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { metaProdutos } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export const metaProdutosRouter = router({
  // Listar todos os produtos monitorados
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(metaProdutos).orderBy(asc(metaProdutos.nomeProduto));
  }),

  // Criar ou atualizar um produto monitorado
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      nomeProduto: z.string().min(1),
      codigoProduto: z.string().optional(),
      metaParticipacaoPct: z.number().min(0).max(100),
      observacao: z.string().optional(),
      ativo: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const { id, ...data } = input;

      if (id) {
        await db.update(metaProdutos)
          .set({
            nomeProduto: data.nomeProduto,
            codigoProduto: data.codigoProduto ?? null,
            metaParticipacaoPct: String(data.metaParticipacaoPct),
            observacao: data.observacao ?? null,
            ativo: data.ativo,
          })
          .where(eq(metaProdutos.id, id));
        return { success: true, id };
      } else {
        const [result] = await db.insert(metaProdutos).values({
          nomeProduto: data.nomeProduto,
          codigoProduto: data.codigoProduto ?? null,
          metaParticipacaoPct: String(data.metaParticipacaoPct),
          observacao: data.observacao ?? null,
          ativo: data.ativo,
        });
        return { success: true, id: result.insertId };
      }
    }),

  // Remover um produto monitorado
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(metaProdutos).where(eq(metaProdutos.id, input.id));
      return { success: true };
    }),
});
