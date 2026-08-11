// REFACTOR: Endpoints otimizados para carregamento rápido

import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { db } from "../db/db";
import { cotacoesFrete, cotacaoOpcoes, cotacaoComentarios } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const cotacoesFreteListRouter = {
  // ✅ REFACTOR CRÍTICO: Query leve de listagem (apenas campos essenciais)
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      solicitanteId: z.number().optional(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(15), // ✅ LIMIT 15 (não 50)
    }))
    .query(async ({ input }) => {
      // ✅ REFACTOR: Buscar APENAS campos essenciais para listagem rápida
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);
      
      const offset = (input.page - 1) * input.pageSize;
      const maxPageSize = Math.min(input.pageSize, 15); // Cap em 15
      
      console.log("🔍 [LIST] Página", input.page, "- Limite:", maxPageSize);
      
      // ✅ Condições de filtro
      let whereConditions = [sql`${cotacoesFrete.createdAt} >= ${dataLimite}`];
      if (input.status) whereConditions.push(sql`${cotacoesFrete.status} = ${input.status}`);
      if (input.solicitanteId) whereConditions.push(sql`${cotacoesFrete.solicitanteId} = ${input.solicitanteId}`);
      
      // ✅ Query LEVE: Apenas campos essenciais (SEM arrays, SEM joins)
      const rows = await db.select({
        id: cotacoesFrete.id,
        destinatarioNome: cotacoesFrete.destinatarioNome,
        status: cotacoesFrete.status,
        createdAt: cotacoesFrete.createdAt,
        valorNf: cotacoesFrete.valorNf,
        municipio: cotacoesFrete.municipio,
        solicitanteNome: cotacoesFrete.solicitanteNome,
      })
        .from(cotacoesFrete)
        .where(and(...whereConditions))
        .orderBy(desc(cotacoesFrete.createdAt))
        .limit(maxPageSize)
        .offset(offset);
      
      // ✅ Contar total para paginação
      const [countResult] = await db.select({ count: sql`COUNT(*) as total` })
        .from(cotacoesFrete)
        .where(and(...whereConditions));
      
      const totalRegistros = (countResult as any).total || 0;
      const totalPages = Math.ceil(totalRegistros / maxPageSize);
      
      console.log("✅ [LIST] Retornando", rows.length, "cotações leves (pág.", input.page, "de", totalPages, ")");
      
      return {
        data: rows,
        pagination: {
          page: input.page,
          pageSize: maxPageSize,
          totalRegistros,
          totalPages,
          hasNextPage: input.page < totalPages,
          hasPrevPage: input.page > 1,
        },
      };
    }),
  
  // ✅ NOVO: Endpoint para buscar detalhes completos de uma cotação (sob demanda)
  getDetalhes: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      console.log("🔍 [DETALHES] Buscando cotação completa ID:", input.id);
      
      // Buscar cotação completa
      const [cotacao] = await db.select().from(cotacoesFrete)
        .where(eq(cotacoesFrete.id, input.id));
      
      if (!cotacao) throw new Error("Cotação não encontrada");
      
      // Buscar opções de frete
      const opcoes = await db.select().from(cotacaoOpcoes)
        .where(eq(cotacaoOpcoes.cotacaoId, input.id));
      
      // Buscar comentários
      const comentarios = await db.select().from(cotacaoComentarios)
        .where(eq(cotacaoComentarios.cotacaoId, input.id))
        .orderBy(desc(cotacaoComentarios.createdAt));
      
      console.log("✅ [DETALHES] Retornando cotação completa com", opcoes.length, "opções");
      
      return {
        ...cotacao,
        opcoes,
        comentarios,
      };
    }),
};
