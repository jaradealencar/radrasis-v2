import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { listAuditLogs } from "../db/db";

export const auditoriaRouter = router({
  /**
   * Lista logs de auditoria com filtros opcionais e paginação.
   * Disponível apenas para usuários autenticados.
   */
  list: protectedProcedure
    .input(
      z.object({
        acao: z.enum(["CRIACAO", "EDICAO", "EXCLUSAO"]).optional(),
        usuarioId: z.string().optional(),
        retrabalhoId: z.number().int().positive().optional(),
        osRetrabalhada: z.string().max(32).optional(),
        dataInicio: z.string().optional(), // ISO date string "YYYY-MM-DD"
        dataFim: z.string().optional(),    // ISO date string "YYYY-MM-DD"
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const dataInicio = input.dataInicio ? new Date(input.dataInicio) : undefined;
      const dataFim = input.dataFim ? new Date(input.dataFim) : undefined;

      const { rows, total } = await listAuditLogs({
        acao: input.acao,
        usuarioId: input.usuarioId,
        retrabalhoId: input.retrabalhoId,
        osRetrabalhada: input.osRetrabalhada,
        dataInicio,
        dataFim,
        page: input.page,
        pageSize: input.pageSize,
      });

      return {
        rows: rows.map((r) => ({
          ...r,
          detalhes: r.detalhes ? (() => {
            try { return JSON.parse(r.detalhes as string); } catch { return null; }
          })() : null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
});
