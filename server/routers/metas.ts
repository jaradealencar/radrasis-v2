import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { metasOperacionais } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// Schema de validação para upsert de metas
const metasUpsertSchema = z.object({
  id: z.number().optional(),
  anoVigencia: z.number().min(2020).max(2100).nullable().optional(),
  // 1. Entrega no prazo
  metaEntregaNoPrazoPct: z.string().nullable().optional(),
  // 2. Retrabalhos
  metaMaxRetrabalhosMes: z.number().int().nullable().optional(),
  metaMaxRetrabalhoPct: z.string().nullable().optional(),
  // 3. Faturamento
  metaFaturamentoMensal: z.string().nullable().optional(),
  metaFaturamentoAnual: z.string().nullable().optional(),
  // 4. Lucratividade
  metaLucratividadePct: z.string().nullable().optional(),
  metaLucratividadeValor: z.string().nullable().optional(),
  metaLucratividadeAnual: z.string().nullable().optional(),
  // 5. Metros soldados
  metaMetrosSoldadosMes: z.number().int().nullable().optional(),
  metaCapacidadeSoldaMin: z.number().int().nullable().optional(),
  metaCapacidadeSoldaMax: z.number().int().nullable().optional(),
  numSoldadores: z.number().int().nullable().optional(),
  metaMediaSoldaPorSoldador: z.string().nullable().optional(),
  // 6. Prejuízo retrabalhos
  metaMaxPrejuizoRetrabalhoMes: z.string().nullable().optional(),
  metaMaxPrejuizoRetrabalhoPct: z.string().nullable().optional(),
  // 7. Desempenho colaborador
  metaOsPorColaboradorDia: z.string().nullable().optional(),
  metaRetrabalhosPorColaboradorMes: z.number().int().nullable().optional(),
  // 8. Ticket médio
  metaTicketMedio: z.string().nullable().optional(),
  // 10. OS Criadas por mês
  metaOsGeradasMes: z.number().int().nullable().optional(),
  // 9. Metros terceirizados
  metaMaxMetrosTerceirizadosMes: z.number().int().nullable().optional(),
  metaMaxPercTerceirizacao: z.string().nullable().optional(),
  // Geral
  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const metasRouter = router({
  // Busca o registro de metas ativo (o mais recente para o ano vigente ou o padrão global)
  get: publicProcedure
    .input(z.object({ ano: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const ano = input?.ano ?? new Date().getFullYear();

      // Tenta buscar metas específicas do ano
      const rows = await db
        .select()
        .from(metasOperacionais)
        .where(eq(metasOperacionais.ativo, true))
        .orderBy(desc(metasOperacionais.updatedAt))
        .limit(10);

      // Prefere o registro do ano específico, depois o global (anoVigencia null), depois o mais recente
      const metaAno = rows.find(r => r.anoVigencia === ano);
      const metaGlobal = rows.find(r => r.anoVigencia === null);
      return metaAno ?? metaGlobal ?? rows[0] ?? null;
    }),

  // Lista todos os registros de metas
  list: publicProcedure.query(async () => {
    const db = (await getDb())!;
    return db
      .select()
      .from(metasOperacionais)
      .orderBy(desc(metasOperacionais.updatedAt));
  }),

  // Cria ou atualiza metas
  upsert: publicProcedure
    .input(metasUpsertSchema)
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const { id, ...data } = input;

      if (id) {
        await db
          .update(metasOperacionais)
          .set(data as any)
          .where(eq(metasOperacionais.id, id));
        const updated = await db
          .select()
          .from(metasOperacionais)
          .where(eq(metasOperacionais.id, id));
        return updated[0];
      } else {
        const result = await db
          .insert(metasOperacionais)
          .values(data as any);
        const inserted = await db
          .select()
          .from(metasOperacionais)
          .where(eq(metasOperacionais.id, (result as any).insertId));
        return inserted[0];
      }
    }),
});
