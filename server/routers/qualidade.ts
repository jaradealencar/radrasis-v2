/**
 * Router de Qualidade: ações corretivas, metas, planos de ação, alertas e desempenho por colaborador
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db/db";
import {
  acoesCorretivas, alertasSistema, metasRetrabalho, planosAcao, retrabalhos,
  ishikawaCausas, acoes5w2h,
} from "../../drizzle/schema";
import { eq, desc, and, gte, lte, sql, isNull, lt } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function criarAlerta(params: {
  tipo: "reincidencia" | "meta_excedida" | "sem_acao" | "prazo_vencido" | "novo_retrabalho" | "atraso_expedicao";
  severidade: "info" | "aviso" | "critico";
  titulo: string;
  descricao?: string;
  referenciaId?: number;
  referenciaTipo?: string;
  referenciaExtra?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(alertasSistema).values({
    tipo: params.tipo,
    severidade: params.severidade,
    titulo: params.titulo,
    descricao: params.descricao ?? null,
    referenciaId: params.referenciaId ?? null,
    referenciaTipo: params.referenciaTipo ?? null,
    referenciaExtra: params.referenciaExtra ?? null,
    status: "ativo",
  });
}

// ─── Router de Ações Corretivas ───────────────────────────────────────────────
export const acoesCorretivasRouter = router({
  // Listar ações corretivas (com filtros)
  list: publicProcedure
    .input(z.object({
      retrabalhoid: z.number().optional(),
      status: z.enum(["aberto", "em_tratamento", "resolvido"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let rows = await db.select().from(acoesCorretivas).orderBy(desc(acoesCorretivas.createdAt));
      if (input?.retrabalhoid) rows = rows.filter(r => r.retrabalhoid === input.retrabalhoid);
      if (input?.status) rows = rows.filter(r => r.status === input.status);
      return rows;
    }),

  // Buscar ação corretiva por retrabalho ID
  getByRetrabalho: publicProcedure
    .input(z.object({ retrabalhoid: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(acoesCorretivas)
        .where(eq(acoesCorretivas.retrabalhoid, input.retrabalhoid))
        .orderBy(desc(acoesCorretivas.createdAt))
        .limit(1);
      return rows[0] ?? null;
    }),

  // Criar ou atualizar ação corretiva
  upsert: publicProcedure
    .input(z.object({
      retrabalhoid: z.number(),
      status: z.enum(["aberto", "em_tratamento", "resolvido"]),
      acaoTomada: z.string().optional(),
      responsavel: z.string().optional(),
      prazoResolucao: z.string().optional(), // ISO date string
      custoAdicional: z.number().optional(),
      observacoes: z.string().optional(),
      registradoPor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // Verificar se já existe
      const existing = await db.select().from(acoesCorretivas)
        .where(eq(acoesCorretivas.retrabalhoid, input.retrabalhoid))
        .limit(1);

      const dataResolucao = input.status === "resolvido" ? new Date() : null;
      const prazoResolucao = input.prazoResolucao ? new Date(input.prazoResolucao) : null;

      if (existing.length > 0) {
        await db.update(acoesCorretivas)
          .set({
            status: input.status,
            acaoTomada: input.acaoTomada ?? null,
            responsavel: input.responsavel ?? null,
            prazoResolucao,
            dataResolucao,
            custoAdicional: input.custoAdicional ? String(input.custoAdicional) : "0",
            observacoes: input.observacoes ?? null,
            registradoPor: input.registradoPor ?? null,
          })
          .where(eq(acoesCorretivas.retrabalhoid, input.retrabalhoid));
        return { id: existing[0].id, action: "updated" };
      } else {
        const [result] = await db.insert(acoesCorretivas).values({
          retrabalhoid: input.retrabalhoid,
          status: input.status,
          acaoTomada: input.acaoTomada ?? null,
          responsavel: input.responsavel ?? null,
          prazoResolucao,
          dataResolucao,
          custoAdicional: input.custoAdicional ? String(input.custoAdicional) : "0",
          observacoes: input.observacoes ?? null,
          registradoPor: input.registradoPor ?? null,
        }).returning({ id: acoesCorretivas.id });
        return { id: result.id, action: "created" };
      }
    }),

  // Estatísticas de ações corretivas
  stats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { abertos: 0, emTratamento: 0, resolvidos: 0, semAcao: 0, prazoVencido: 0 };
    const all = await db.select().from(acoesCorretivas);
    const agora = new Date();
    return {
      abertos: all.filter(a => a.status === "aberto").length,
      emTratamento: all.filter(a => a.status === "em_tratamento").length,
      resolvidos: all.filter(a => a.status === "resolvido").length,
      prazoVencido: all.filter(a =>
        a.status !== "resolvido" && a.prazoResolucao && new Date(a.prazoResolucao) < agora
      ).length,
    };
  }),
});

// ─── Router de Metas de Retrabalho ───────────────────────────────────────────
export const metasRetrabalhoRouter = router({
  // Listar metas
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(metasRetrabalho).orderBy(desc(metasRetrabalho.ano), desc(sql`COALESCE(${metasRetrabalho.mes}, 0)`));
  }),

  // Meta vigente (ano atual, sem mês específico = meta anual)
  vigente: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;
    // Tentar meta do mês atual primeiro, depois meta anual
    const rows = await db.select().from(metasRetrabalho)
      .where(eq(metasRetrabalho.ano, anoAtual))
      .orderBy(desc(sql`COALESCE(${metasRetrabalho.mes}, 0)`));
    const metaMes = rows.find(r => r.mes === mesAtual);
    const metaAnual = rows.find(r => r.mes === null);
    return metaMes ?? metaAnual ?? null;
  }),

  // Criar ou atualizar meta
  upsert: publicProcedure
    .input(z.object({
      ano: z.number(),
      mes: z.number().optional(),
      metaMaxRetrabalhosMes: z.number().optional(),
      metaMaxCustoMes: z.number().optional(),
      metaMaxPercFaturamento: z.number().optional(),
      metaMaxPercEvitaveis: z.number().optional(),
      metaMinResolucaoDias: z.number().optional(),
      metaMaxReincidencias: z.number().optional(),
      metasPorSetor: z.string().optional(),
      observacoes: z.string().optional(),
      criadoPor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // Verificar se já existe meta para esse ano/mês
      const existing = await db.select().from(metasRetrabalho)
        .where(and(
          eq(metasRetrabalho.ano, input.ano),
          input.mes ? eq(metasRetrabalho.mes, input.mes) : isNull(metasRetrabalho.mes)
        ))
        .limit(1);

      const values = {
        metaMaxRetrabalhosMes: input.metaMaxRetrabalhosMes ?? null,
        metaMaxCustoMes: input.metaMaxCustoMes ? String(input.metaMaxCustoMes) : null,
        metaMaxPercFaturamento: input.metaMaxPercFaturamento ? String(input.metaMaxPercFaturamento) : null,
        metaMaxPercEvitaveis: input.metaMaxPercEvitaveis ? String(input.metaMaxPercEvitaveis) : null,
        metaMinResolucaoDias: input.metaMinResolucaoDias ?? null,
        metaMaxReincidencias: input.metaMaxReincidencias ?? null,
        metasPorSetor: input.metasPorSetor ?? null,
        observacoes: input.observacoes ?? null,
        criadoPor: input.criadoPor ?? null,
      };

      if (existing.length > 0) {
        await db.update(metasRetrabalho).set(values).where(eq(metasRetrabalho.id, existing[0].id));
        return { id: existing[0].id, action: "updated" };
      } else {
        const [result] = await db.insert(metasRetrabalho).values({
          ano: input.ano,
          mes: input.mes ?? null,
          ...values,
        }).returning({ id: metasRetrabalho.id });
        return { id: result.id, action: "created" };
      }
    }),

  // Comparativo meta vs realizado (mês atual)
  comparativo: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    const inicioMes = new Date(anoAtual, mesAtual - 1, 1);
    const fimMes = new Date(anoAtual, mesAtual, 0, 23, 59, 59);

    // Meta vigente
    const metas = await db.select().from(metasRetrabalho)
      .where(eq(metasRetrabalho.ano, anoAtual))
      .orderBy(desc(sql`COALESCE(${metasRetrabalho.mes}, 0)`));
    const meta = metas.find(r => r.mes === mesAtual) ?? metas.find(r => r.mes === null) ?? null;

    // Retrabalhos do mês
    const retrabsMes = await db.select().from(retrabalhos)
      .where(and(gte(retrabalhos.data, inicioMes), lte(retrabalhos.data, fimMes)));

    const totalMes = retrabsMes.length;
    const custoMes = retrabsMes.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const evitaveisMes = retrabsMes.filter(r => r.classe === "EVITÁVEL").length;
    const percEvitaveis = totalMes > 0 ? (evitaveisMes / totalMes) * 100 : 0;

    // Reincidências do mês (mesmo codigoErro + setor, mais de 1 vez)
    const reincMap: Record<string, number> = {};
    retrabsMes.forEach(r => {
      const key = `${r.codigoErro ?? "sem_codigo"}|${r.setor}`;
      reincMap[key] = (reincMap[key] ?? 0) + 1;
    });
    const maxReincidencias = Math.max(0, ...Object.values(reincMap));

    // Ações corretivas sem resolução há mais de metaMinResolucaoDias
    const acoes = await db.select().from(acoesCorretivas)
      .where(and(
        eq(acoesCorretivas.status, "aberto"),
        gte(acoesCorretivas.createdAt, inicioMes)
      ));

    // Faturamento do mês (da tabela faturamento)
    const { faturamento } = await import("../../drizzle/schema");
    const fatRows = await db.select().from(faturamento)
      .where(and(eq(faturamento.mes, String(mesAtual)), eq(faturamento.ano, anoAtual)))
      .limit(1);
    const fatMes = fatRows[0] ? Number(fatRows[0].valorFaturado ?? 0) : 0;
    const percFaturamento = fatMes > 0 ? (custoMes / fatMes) * 100 : 0;

    return {
      meta,
      realizado: {
        totalRetrabalhos: totalMes,
        custoTotal: custoMes,
        percEvitaveis,
        percFaturamento,
        maxReincidencias,
        acoesAbertas: acoes.length,
      },
      status: {
        retrabalhos: meta?.metaMaxRetrabalhosMes ? (totalMes <= meta.metaMaxRetrabalhosMes ? "ok" : "excedido") : "sem_meta",
        custo: meta?.metaMaxCustoMes ? (custoMes <= Number(meta.metaMaxCustoMes) ? "ok" : "excedido") : "sem_meta",
        percFaturamento: meta?.metaMaxPercFaturamento ? (percFaturamento <= Number(meta.metaMaxPercFaturamento) ? "ok" : "excedido") : "sem_meta",
        percEvitaveis: meta?.metaMaxPercEvitaveis ? (percEvitaveis <= Number(meta.metaMaxPercEvitaveis) ? "ok" : "excedido") : "sem_meta",
        reincidencias: meta?.metaMaxReincidencias ? (maxReincidencias <= meta.metaMaxReincidencias ? "ok" : "excedido") : "sem_meta",
      },
    };
  }),
});

// ─── Router de Planos de Ação ─────────────────────────────────────────────────
export const planosAcaoRouter = router({
  list: publicProcedure
    .input(z.object({
      codigoErro: z.string().optional(),
      setor: z.string().optional(),
      status: z.enum(["pendente", "em_andamento", "concluido", "monitorando"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let rows = await db.select().from(planosAcao).orderBy(desc(planosAcao.createdAt));
      if (input?.codigoErro) rows = rows.filter(r => r.codigoErro === input.codigoErro);
      if (input?.setor) rows = rows.filter(r => r.setor === input.setor);
      if (input?.status) rows = rows.filter(r => r.status === input.status);
      // Enrich with action counts for progress bars
      const allAcoes = await db.select().from(acoes5w2h);
      return rows.map(p => {
        const acoes = allAcoes.filter(a => a.planoId === p.id);
        const total = acoes.length;
        const concluidas = acoes.filter(a => a.status === "concluido").length;
        const emAndamento = acoes.filter(a => a.status === "em_andamento").length;
        return { ...p, _totalAcoes: total, _acoesConc: concluidas, _acoesAndamento: emAndamento };
      });
    }),

  create: publicProcedure
    .input(z.object({
      codigoErro: z.string(),
      setor: z.string().optional(),
      titulo: z.string(),
      problemaRaiz: z.string().optional(),
      acoesPreventivas: z.string().optional(),
      responsavel: z.string().optional(),
      prazo: z.string().optional(),
      reincidenciasNaAbertura: z.number().optional(),
      criadoPor: z.string().optional(),
      errosPrevenidos: z.array(z.string()).optional(),
      errosResolvidos: z.array(z.string()).optional(),
      metodologia: z.string().optional(),
      codigosErro: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [result] = await db.insert(planosAcao).values({
        codigoErro: input.codigoErro,
        setor: input.setor ?? null,
        titulo: input.titulo,
        problemaRaiz: input.problemaRaiz ?? null,
        acoesPreventivas: input.acoesPreventivas ?? null,
        responsavel: input.responsavel ?? null,
        prazo: input.prazo ? new Date(input.prazo) : null,
        status: "pendente",
        reincidenciasNaAbertura: input.reincidenciasNaAbertura ?? 0,
        criadoPor: input.criadoPor ?? null,
        errosPrevenidos: input.errosPrevenidos ? JSON.stringify(input.errosPrevenidos) : null,
        errosResolvidos: input.errosResolvidos ? JSON.stringify(input.errosResolvidos) : null,
        metodologia: input.metodologia ?? "ambos",
        codigosErro: input.codigosErro ? JSON.stringify(input.codigosErro) : null,
      }).returning({ id: planosAcao.id });
      return { id: result.id };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      titulo: z.string().optional(),
      problemaRaiz: z.string().optional(),
      acoesPreventivas: z.string().optional(),
      responsavel: z.string().optional(),
      prazo: z.string().optional(),
      status: z.enum(["pendente", "em_andamento", "concluido", "monitorando"]).optional(),
      reincidenciasAposPlano: z.number().optional(),
      errosPrevenidos: z.array(z.string()).optional(),
      errosResolvidos: z.array(z.string()).optional(),
      metodologia: z.string().optional(),
      setor: z.string().optional(),
      codigosErro: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, errosPrevenidos, errosResolvidos, codigosErro, ...rest } = input;
      await db.update(planosAcao).set({
        ...rest,
        prazo: rest.prazo ? new Date(rest.prazo) : undefined,
        errosPrevenidos: errosPrevenidos !== undefined ? JSON.stringify(errosPrevenidos) : undefined,
        errosResolvidos: errosResolvidos !== undefined ? JSON.stringify(errosResolvidos) : undefined,
        codigosErro: codigosErro !== undefined ? JSON.stringify(codigosErro) : undefined,
      }).where(eq(planosAcao.id, id));
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(planosAcao).where(eq(planosAcao.id, input.id));
      return { success: true };
    }),

  // Ishikawa: listar causas de um plano
  listCausas: publicProcedure
    .input(z.object({ planoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(ishikawaCausas).where(eq(ishikawaCausas.planoId, input.planoId)).orderBy(ishikawaCausas.categoria);
    }),

  // Ishikawa: criar causa
  createCausa: publicProcedure
    .input(z.object({
      planoId: z.number(),
      categoria: z.enum(["maquina", "mao_de_obra", "material", "metodo", "medida", "meio_ambiente"]),
      causa: z.string(),
      prioridade: z.enum(["alta", "media", "baixa"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [result] = await db.insert(ishikawaCausas).values({
        planoId: input.planoId,
        categoria: input.categoria,
        causa: input.causa,
        prioridade: input.prioridade ?? "media",
      }).returning({ id: ishikawaCausas.id });
      return { id: result.id };
    }),

  // Ishikawa: atualizar causa
  updateCausa: publicProcedure
    .input(z.object({
      id: z.number(),
      causa: z.string().optional(),
      prioridade: z.enum(["alta", "media", "baixa"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...rest } = input;
      await db.update(ishikawaCausas).set(rest).where(eq(ishikawaCausas.id, id));
      return { success: true };
    }),

  // Ishikawa: deletar causa
  deleteCausa: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(ishikawaCausas).where(eq(ishikawaCausas.id, input.id));
      return { success: true };
    }),

  // 5W2H: listar ações de um plano
  listAcoes: publicProcedure
    .input(z.object({ planoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(acoes5w2h).where(eq(acoes5w2h.planoId, input.planoId)).orderBy(acoes5w2h.createdAt);
    }),

  // 5W2H: criar ação
  createAcao: publicProcedure
    .input(z.object({
      planoId: z.number(),
      what: z.string(),
      why: z.string().optional(),
      where: z.string().optional(),
      who: z.string().optional(),
      when: z.string().optional(),
      how: z.string().optional(),
      howMuch: z.string().optional(),
      causaId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [result] = await db.insert(acoes5w2h).values({
        planoId: input.planoId,
        what: input.what,
        why: input.why ?? null,
        where: input.where ?? null,
        who: input.who ?? null,
        when: input.when ?? null,
        how: input.how ?? null,
        howMuch: input.howMuch ?? null,
        causaId: input.causaId ?? null,
        status: "pendente",
      }).returning({ id: acoes5w2h.id });
      return { id: result.id };
    }),

  // 5W2H: atualizar ação
  updateAcao: publicProcedure
    .input(z.object({
      id: z.number(),
      what: z.string().optional(),
      why: z.string().optional(),
      where: z.string().optional(),
      who: z.string().optional(),
      when: z.string().optional(),
      how: z.string().optional(),
      howMuch: z.string().optional(),
      status: z.enum(["pendente", "em_andamento", "concluido"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...rest } = input;
      await db.update(acoes5w2h).set(rest).where(eq(acoes5w2h.id, id));
      return { success: true };
    }),

  // 5W2H: deletar ação
  deleteAcao: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(acoes5w2h).where(eq(acoes5w2h.id, input.id));
      return { success: true };
    }),

  // Exportar dados completos do plano para geração de PDF no frontend
  exportData: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [plano] = await db.select().from(planosAcao).where(eq(planosAcao.id, input.id));
      if (!plano) throw new Error("Plano não encontrado");
      const causas = await db.select().from(ishikawaCausas).where(eq(ishikawaCausas.planoId, input.id)).orderBy(ishikawaCausas.categoria);
      const acoes = await db.select().from(acoes5w2h).where(eq(acoes5w2h.planoId, input.id)).orderBy(acoes5w2h.createdAt);
      return { plano, causas, acoes };
    }),

  // Gerar ações 5W2H via IA para um plano de ação
  gerarAcoesIA: publicProcedure
    .input(z.object({
      planoId: z.number(),
      titulo: z.string(),
      problemaRaiz: z.string().optional(),
      codigoErro: z.string(),
      causas: z.array(z.object({ categoria: z.string(), causa: z.string() })).optional(),
      quantidade: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const qtd = input.quantidade ?? 5;
      const causasTexto = input.causas && input.causas.length > 0
        ? `\n\nCausas identificadas (Ishikawa):\n${input.causas.map(c => `- ${c.categoria}: ${c.causa}`).join("\n")}`
        : "";
      const prompt = `Você é um especialista em qualidade industrial. Gere exatamente ${qtd} ações preventivas no formato 5W2H para o seguinte plano de ação:\n\nTítulo: ${input.titulo}\nCódigo do Erro: ${input.codigoErro}\nProblema Raiz: ${input.problemaRaiz ?? "Não especificado"}${causasTexto}\n\nResponda APENAS com um JSON array com exatamente ${qtd} objetos, cada um com os campos:\n- what: O que fazer (ação específica e mensurável)\n- why: Por que fazer (justificativa)\n- where: Onde executar (setor/local)\n- who: Quem é responsável (cargo/função)\n- when: Quando (prazo em dias, ex: "30 dias")\n- how: Como fazer (método/procedimento)\n- howMuch: Quanto custa (estimativa ou "Sem custo adicional")\n\nAs ações devem ser práticas, específicas e diretamente relacionadas ao problema.`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um especialista em qualidade industrial e metodologias 5W2H e Ishikawa. Responda sempre em JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "acoes_5w2h",
            strict: true,
            schema: {
              type: "object",
              properties: {
                acoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      what: { type: "string" },
                      why: { type: "string" },
                      where: { type: "string" },
                      who: { type: "string" },
                      when: { type: "string" },
                      how: { type: "string" },
                      howMuch: { type: "string" },
                    },
                    required: ["what", "why", "where", "who", "when", "how", "howMuch"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["acoes"],
              additionalProperties: false,
            },
          },
        },
      });
      const rawContent = response.choices?.[0]?.message?.content ?? "{}";
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      let acoes: any[] = [];
      try {
        const parsed = JSON.parse(content);
        acoes = parsed.acoes ?? parsed ?? [];
        if (!Array.isArray(acoes)) acoes = [];
      } catch {
        throw new Error("Falha ao interpretar resposta da IA");
      }
      // Inserir as ações no banco
      const insertedIds: number[] = [];
      for (const acao of acoes.slice(0, qtd)) {
        const [result] = await db.insert(acoes5w2h).values({
          planoId: input.planoId,
          what: acao.what ?? "",
          why: acao.why ?? null,
          where: acao.where ?? null,
          who: acao.who ?? null,
          when: acao.when ?? null,
          how: acao.how ?? null,
          howMuch: acao.howMuch ?? null,
          status: "pendente",
        }).returning({ id: acoes5w2h.id });
        insertedIds.push(result.id);
      }
      return { success: true, count: insertedIds.length, ids: insertedIds };
    }),

  // Reincidências com plano de ação vinculado
  reincidenciasComPlano: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    // Buscar reincidências (mesmo codigoErro + setor, >= 2 ocorrências)
    const rows = await db.select({
      codigoErro: retrabalhos.codigoErro,
      setor: retrabalhos.setor,
      count: sql<number>`COUNT(*)`,
      custoTotal: sql<number>`SUM(${retrabalhos.total})`,
      ultimaOcorrencia: sql<Date>`MAX(${retrabalhos.data})`,
    })
      .from(retrabalhos)
      .groupBy(retrabalhos.codigoErro, retrabalhos.setor)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(sql`COUNT(*)`));

    // Para cada reincidência, verificar se há plano de ação
    const planos = await db.select().from(planosAcao);
    return rows.map(r => {
      const plano = planos.find(p =>
        p.codigoErro === r.codigoErro && (!p.setor || p.setor === r.setor)
      ) ?? null;
      return { ...r, plano };
    });
  }),
});

// ─── Router de Alertas ────────────────────────────────────────────────────────
export const alertasRouter = router({
  // Listar alertas ativos
  list: publicProcedure
    .input(z.object({
      status: z.enum(["ativo", "lido", "arquivado"]).optional(),
      tipo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let rows = await db.select().from(alertasSistema).orderBy(desc(alertasSistema.createdAt));
      if (input?.status) rows = rows.filter(r => r.status === input.status);
      if (input?.tipo) rows = rows.filter(r => r.tipo === input.tipo);
      return rows;
    }),

  // Contar alertas ativos (para badge no menu)
  countAtivos: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, criticos: 0, avisos: 0 };
    const rows = await db.select().from(alertasSistema).where(eq(alertasSistema.status, "ativo"));
    return {
      total: rows.length,
      criticos: rows.filter(r => r.severidade === "critico").length,
      avisos: rows.filter(r => r.severidade === "aviso").length,
    };
  }),

  // Marcar como lido
  marcarLido: publicProcedure
    .input(z.object({ id: z.number(), lidoPor: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(alertasSistema).set({
        status: "lido",
        lidoPor: input.lidoPor ?? null,
        lidoEm: new Date(),
      }).where(eq(alertasSistema.id, input.id));
      return { success: true };
    }),

  // Arquivar alerta
  arquivar: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(alertasSistema).set({ status: "arquivado" }).where(eq(alertasSistema.id, input.id));
      return { success: true };
    }),

  // Marcar todos como lidos
  marcarTodosLidos: publicProcedure
    .input(z.object({ lidoPor: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(alertasSistema).set({
        status: "lido",
        lidoPor: input.lidoPor ?? null,
        lidoEm: new Date(),
      }).where(eq(alertasSistema.status, "ativo"));
      return { success: true };
    }),

  // Verificar e gerar alertas automáticos (chamado periodicamente ou após registros)
  verificarAlertas: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { gerados: 0 };
    let gerados = 0;
    const agora = new Date();

    // 1. Retrabalhos sem ação corretiva há mais de 3 dias
    const tresdiasAtras = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000);
    const retrabsSemAcao = await db.select().from(retrabalhos)
      .where(lt(retrabalhos.createdAt, tresdiasAtras));
    const acoesExistentes = await db.select({ id: acoesCorretivas.retrabalhoid }).from(acoesCorretivas);
    const idsComAcao = new Set(acoesExistentes.map((a: any) => a.retrabalhoid));
    const semAcao = retrabsSemAcao.filter(r => !idsComAcao.has(r.id));
    for (const r of semAcao.slice(0, 10)) {
      // Verificar se já existe alerta para esse retrabalho
      const alertaExistente = await db.select().from(alertasSistema)
        .where(and(
          eq(alertasSistema.tipo, "sem_acao"),
          eq(alertasSistema.referenciaId, r.id),
          eq(alertasSistema.status, "ativo")
        )).limit(1);
      if (alertaExistente.length === 0) {
        await criarAlerta({
          tipo: "sem_acao",
          severidade: "aviso",
          titulo: `OS ${r.osRetrabalhada} sem ação corretiva`,
          descricao: `Retrabalho registrado em ${new Date(r.data).toLocaleDateString("pt-BR")} ainda não possui ação corretiva cadastrada.`,
          referenciaId: r.id,
          referenciaTipo: "retrabalho",
          referenciaExtra: r.osRetrabalhada,
        });
        gerados++;
      }
    }

    // 2. Ações corretivas com prazo vencido
    const acoesVencidas = await db.select().from(acoesCorretivas)
      .where(and(
        lt(acoesCorretivas.prazoResolucao, agora),
        eq(acoesCorretivas.status, "aberto")
      ));
    for (const a of acoesVencidas.slice(0, 10)) {
      const alertaExistente = await db.select().from(alertasSistema)
        .where(and(
          eq(alertasSistema.tipo, "prazo_vencido"),
          eq(alertasSistema.referenciaId, a.id),
          eq(alertasSistema.status, "ativo")
        )).limit(1);
      if (alertaExistente.length === 0) {
        await criarAlerta({
          tipo: "prazo_vencido",
          severidade: "critico",
          titulo: `Prazo de ação corretiva vencido`,
          descricao: `A ação corretiva do retrabalho #${a.retrabalhoid} venceu em ${a.prazoResolucao ? new Date(a.prazoResolucao).toLocaleDateString("pt-BR") : "data desconhecida"}.`,
          referenciaId: a.id,
          referenciaTipo: "acao_corretiva",
          referenciaExtra: String(a.retrabalhoid),
        });
        gerados++;
      }
    }

    // 3. Reincidências: mesmo codigoErro + setor >= 3 vezes no mês
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const retrabsMes = await db.select().from(retrabalhos)
      .where(gte(retrabalhos.data, inicioMes));
    const reincMap: Record<string, { count: number; setor: string; codigoErro: string }> = {};
    retrabsMes.forEach(r => {
      if (!r.codigoErro) return;
      const key = `${r.codigoErro}|${r.setor}`;
      if (!reincMap[key]) reincMap[key] = { count: 0, setor: r.setor, codigoErro: r.codigoErro };
      reincMap[key].count++;
    });
    for (const [key, info] of Object.entries(reincMap)) {
      if (info.count >= 3) {
        const alertaExistente = await db.select().from(alertasSistema)
          .where(and(
            eq(alertasSistema.tipo, "reincidencia"),
            eq(alertasSistema.referenciaExtra, key),
            eq(alertasSistema.status, "ativo")
          )).limit(1);
        if (alertaExistente.length === 0) {
          await criarAlerta({
            tipo: "reincidencia",
            severidade: "critico",
            titulo: `Reincidência crítica: ${info.codigoErro} no setor ${info.setor}`,
            descricao: `O erro ${info.codigoErro} ocorreu ${info.count} vezes no setor ${info.setor} neste mês. Crie um plano de ação preventivo.`,
            referenciaTipo: "reincidencia",
            referenciaExtra: key,
          });
          gerados++;
        }
      }
    }

    return { gerados };
  }),
});

// ─── Router de Desempenho por Colaborador ─────────────────────────────────────
export const desempenhoColaboradorRouter = router({
  // Ranking de colaboradores por retrabalhos
  ranking: publicProcedure
    .input(z.object({
      mes: z.string().optional(),
      setor: z.string().optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Construir filtro de data
      const conditions = [];
      if (input?.mes) {
        const [ano, mes] = input.mes.split("-").map(Number);
        if (ano && mes) {
          conditions.push(gte(retrabalhos.data, new Date(ano, mes - 1, 1)));
          conditions.push(lte(retrabalhos.data, new Date(ano, mes, 0, 23, 59, 59)));
        }
      }
      if (input?.dataInicio) conditions.push(gte(retrabalhos.data, new Date(input.dataInicio)));
      if (input?.dataFim) conditions.push(lte(retrabalhos.data, new Date(input.dataFim)));
      if (input?.setor) conditions.push(eq(retrabalhos.setor, input.setor));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select().from(retrabalhos).where(whereClause);

      // Agrupar por responsável
      const map: Record<string, {
        responsavel: string;
        total: number;
        custoTotal: number;
        evitaveis: number;
        inevitaveis: number;
        setores: Set<string>;
        erros: Record<string, number>;
        ultimoRetrabalho: Date | null;
      }> = {};

      rows.forEach(r => {
        const resp = r.responsavel?.trim() || "Não informado";
        if (!map[resp]) {
          map[resp] = {
            responsavel: resp,
            total: 0,
            custoTotal: 0,
            evitaveis: 0,
            inevitaveis: 0,
            setores: new Set(),
            erros: {},
            ultimoRetrabalho: null,
          };
        }
        map[resp].total++;
        map[resp].custoTotal += Number(r.total ?? 0);
        if (r.classe === "EVITÁVEL") map[resp].evitaveis++;
        else map[resp].inevitaveis++;
        map[resp].setores.add(r.setor);
        if (r.codigoErro) {
          map[resp].erros[r.codigoErro] = (map[resp].erros[r.codigoErro] ?? 0) + 1;
        }
        const dataR = new Date(r.data);
        if (!map[resp].ultimoRetrabalho || dataR > map[resp].ultimoRetrabalho!) {
          map[resp].ultimoRetrabalho = dataR;
        }
      });

      return Object.values(map)
        .map(v => ({
          responsavel: v.responsavel,
          total: v.total,
          custoTotal: v.custoTotal,
          evitaveis: v.evitaveis,
          inevitaveis: v.inevitaveis,
          percEvitaveis: v.total > 0 ? (v.evitaveis / v.total) * 100 : 0,
          setores: Array.from(v.setores),
          erroMaisFrequente: Object.entries(v.erros).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
          ultimoRetrabalho: v.ultimoRetrabalho,
        }))
        .sort((a, b) => b.total - a.total);
    }),

  // Evolução mensal de um colaborador específico
  evolucao: publicProcedure
    .input(z.object({ responsavel: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select({
        mes: sql<string>`TO_CHAR(${retrabalhos.data}, 'YYYY-MM')`,
        total: sql<number>`COUNT(*)`,
        custoTotal: sql<number>`SUM(${retrabalhos.total})`,
        evitaveis: sql<number>`SUM(CASE WHEN ${retrabalhos.classe} = 'EVITÁVEL' THEN 1 ELSE 0 END)`,
      })
        .from(retrabalhos)
        .where(eq(retrabalhos.responsavel, input.responsavel))
        .groupBy(sql`TO_CHAR(${retrabalhos.data}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${retrabalhos.data}, 'YYYY-MM')`);
      return rows;
    }),

  // Comparativo entre colaboradores (radar/spider chart data)
  comparativo: publicProcedure
    .input(z.object({
      responsaveis: z.array(z.string()),
      mes: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input.mes) {
        const [ano, mes] = input.mes.split("-").map(Number);
        if (ano && mes) {
          conditions.push(gte(retrabalhos.data, new Date(ano, mes - 1, 1)));
          conditions.push(lte(retrabalhos.data, new Date(ano, mes, 0, 23, 59, 59)));
        }
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select().from(retrabalhos).where(whereClause);
      return input.responsaveis.map(resp => {
        const mine = rows.filter(r => r.responsavel === resp);
        return {
          responsavel: resp,
          total: mine.length,
          custoTotal: mine.reduce((s, r) => s + Number(r.total ?? 0), 0),
          percEvitaveis: mine.length > 0 ? (mine.filter(r => r.classe === "EVITÁVEL").length / mine.length) * 100 : 0,
        };
      });
    }),
});
