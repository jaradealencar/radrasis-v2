import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db/db";
import { desempenhoColaboradorMensal } from "../../drizzle/schema";
import { and, eq, asc } from "drizzle-orm";

export const desempenhoColabMensalRouter = router({
  // Listar todos os registros de um ano (opcionalmente filtrar por categoria)
  list: publicProcedure
    .input(z.object({
      ano: z.number(),
      categoria: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(desempenhoColaboradorMensal.ano, input.ano)];
      if (input.categoria) {
        conditions.push(eq(desempenhoColaboradorMensal.categoria, input.categoria));
      }
      return db.select()
        .from(desempenhoColaboradorMensal)
        .where(and(...conditions))
        .orderBy(asc(desempenhoColaboradorMensal.nome), asc(desempenhoColaboradorMensal.mes));
    }),

  // Listar colaboradores distintos cadastrados (nome + categoria)
  listColaboradores: publicProcedure
    .input(z.object({ ano: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select({
        nome: desempenhoColaboradorMensal.nome,
        categoria: desempenhoColaboradorMensal.categoria,
      }).from(desempenhoColaboradorMensal);
      // Deduplicar
      const seen = new Set<string>();
      const result: { nome: string; categoria: string }[] = [];
      for (const r of rows) {
        const key = `${r.nome}|${r.categoria}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ nome: r.nome, categoria: r.categoria });
        }
      }
      return result.sort((a, b) => a.nome.localeCompare(b.nome));
    }),

  // Upsert (criar ou atualizar) registro mensal de um colaborador
  upsert: publicProcedure
    .input(z.object({
      nome: z.string().min(1),
      categoria: z.enum(["soldador", "vendedor", "operador_maquinas"]),
      mes: z.number().min(1).max(12),
      ano: z.number(),
      numFaltas: z.number().nullable().optional(),
      // Soldador
      metrosSoldados: z.number().nullable().optional(),
      numRetrabalhos: z.number().nullable().optional(),
      // Vendedor
      numPropostas: z.number().nullable().optional(),
      numVendas: z.number().nullable().optional(),
      faturamentoVendedor: z.number().nullable().optional(),
      ticketMedioVendedor: z.number().nullable().optional(),
      // Operador de Máquinas
      numTrabalhos: z.number().nullable().optional(),
      notas: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Calcular ticket médio automaticamente para vendedor
      let ticketMedio = input.ticketMedioVendedor ?? null;
      if (input.categoria === "vendedor" && input.faturamentoVendedor && input.numVendas && input.numVendas > 0) {
        if (ticketMedio == null) ticketMedio = input.faturamentoVendedor / input.numVendas;
      }

      const existing = await db.select({ id: desempenhoColaboradorMensal.id })
        .from(desempenhoColaboradorMensal)
        .where(and(
          eq(desempenhoColaboradorMensal.nome, input.nome),
          eq(desempenhoColaboradorMensal.categoria, input.categoria),
          eq(desempenhoColaboradorMensal.mes, input.mes),
          eq(desempenhoColaboradorMensal.ano, input.ano),
        ));

      const payload = {
        nome: input.nome,
        categoria: input.categoria,
        mes: input.mes,
        ano: input.ano,
        numFaltas: input.numFaltas ?? 0,
        metrosSoldados: input.metrosSoldados != null ? String(input.metrosSoldados) : null,
        numRetrabalhos: input.numRetrabalhos ?? 0,
        numPropostas: input.numPropostas ?? 0,
        numVendas: input.numVendas ?? 0,
        faturamentoVendedor: input.faturamentoVendedor != null ? String(input.faturamentoVendedor) : null,
        ticketMedioVendedor: ticketMedio != null ? String(ticketMedio) : null,
        numTrabalhos: input.numTrabalhos ?? 0,
        notas: input.notas ?? null,
      };

      if (existing.length > 0) {
        await db.update(desempenhoColaboradorMensal)
          .set(payload)
          .where(eq(desempenhoColaboradorMensal.id, existing[0].id));
        return { id: existing[0].id, action: "updated" };
      } else {
        const [result] = await db.insert(desempenhoColaboradorMensal).values(payload).returning({ id: desempenhoColaboradorMensal.id });
        return { id: result.id, action: "created" };
      }
    }),

  // Deletar colaborador (todos os registros de um nome+categoria)
  deleteColaborador: publicProcedure
    .input(z.object({ nome: z.string(), categoria: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(desempenhoColaboradorMensal)
        .where(and(
          eq(desempenhoColaboradorMensal.nome, input.nome),
          eq(desempenhoColaboradorMensal.categoria, input.categoria),
        ));
      return { ok: true };
    }),
});
