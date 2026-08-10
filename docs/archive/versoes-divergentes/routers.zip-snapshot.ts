import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { transportadorasRouter, cotacoesFreteRouter, cteRouter } from "./routers/logistica";
import { acoesCorretivasRouter, metasRetrabalhoRouter, planosAcaoRouter, alertasRouter, desempenhoColaboradorRouter } from "./routers/qualidade";
import { metasRouter } from "./routers/metas";
import { financeiroRouter } from "./routers/financeiro";
import { observacoesFinanceirasRouter } from "./routers/observacoesFinanceiras";
import { bibliotecaArquivosRouter } from "./routers/bibliotecaArquivos";
import { performanceRouter } from "./routers/performance";
import { performanceAbcRouter } from "./routers/performanceAbc";
import { auditoriaRouter } from "./routers/auditoria";
import { cargosRouter } from "./routers/cargos";
import { curriculosRouter } from "./routers/curriculos";
import { pcpRouter } from "./routers/pcp";
import { desempenhoColabMensalRouter } from "./routers/desempenhoColabMensal";
import { empacotamentoRouter } from "./routers/empacotamento";
import { metaProdutosRouter } from "./routers/metaProdutos";
import { performanceComercialRouter } from "./routers/performanceComercial";
import { crmRouter } from "./routers/crm";
import { custoLedRouter } from "./routers/custoLed";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { APP_ROLES, PAGE_KEYS } from "../drizzle/schema";
import {
  listLocalUsers, getLocalUserByEmail, getLocalUserById, getLocalUserByName,
  createLocalUser, updateLocalUser, deleteLocalUser,
  getAllRolePermissions, setRolePermission, getPermissionsForRole,
  getFinanceiros, getFinanceiroByMesAno, upsertFinanceiro,
} from "./db";
import {
  getErrorLibrary,
  getErrorByCode,
  listRetrabalhos,
  getRetrabalhosAll,
  createRetrabalho,
  createBatchRetrabalhos,
  updateRetrabalho,
  deleteRetrabalho,
  getRetrabalhosById,
  getKpis, getBySetor, getByCategoria, getByCodigoErro, getByResponsavel, getEvolucaoMensal, getReincidencia,
  getDistinctValues,
  getFaturamento,
  upsertFaturamento,
  updateErrorCorrection,
  updateErrorItem,
  createErrorLibraryItem,
  deleteErrorLibraryItem,
  listKnowledge, getKnowledgeById, createKnowledge, updateKnowledge, deleteKnowledge,
  listSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier,
  listRoutines, createRoutine, updateRoutine, deleteRoutine, listPendingRoutines, markRoutineDone,
  listRegulations, getRegulationById, createRegulation, updateRegulation, deleteRegulation,
  listPops, getPopById, createPop, updatePop, deletePop,
  listPriceTableSections, updatePriceTableSection, getPriceTableMeta, listPriceTableHistory,
  addPriceTableSection, deletePriceTableSection,
  listKnowledgeComments, createKnowledgeComment, deleteKnowledgeComment,
  insertAuditLog,
  listKnowledgeSuggestions, createKnowledgeSuggestion, updateKnowledgeSuggestion, deleteKnowledgeSuggestion,
  listArquivosBibliotecaComConteudo,
} from "./db";

const filterSchema = z.object({
  mes: z.string().optional(),
  setor: z.string().optional(),
  tipo: z.string().optional(),
  responsavel: z.string().optional(),
  classe: z.string().optional(),
  dataInicio: z.date().optional(),
  dataFim: z.date().optional(),
  search: z.string().optional(),
  tipoRegistro: z.enum(["retrabalho", "cnq"]).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Error Library ──────────────────────────────────────────────────────
  errorLibrary: router({
    list: publicProcedure.query(() => getErrorLibrary()),
    byCode: publicProcedure.input(z.object({ code: z.string() })).query(({ input }) => getErrorByCode(input.code)),
    updateCorrection: protectedProcedure
      .input(z.object({ code: z.string(), correction: z.string().min(1) }))
      .mutation(({ input }) => updateErrorCorrection(input.code, input.correction)),
    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        category: z.string().min(1),
        description: z.string().min(1),
        correction: z.string().min(1),
        tipoRegistro: z.enum(["retrabalho", "cnq"]).default("retrabalho"),
      }))
      .mutation(({ input }) => createErrorLibraryItem(input as any)),
    updateItem: protectedProcedure
      .input(z.object({
        code: z.string(),
        description: z.string().min(1).optional(),
        correction: z.string().min(1).optional(),
      }))
      .mutation(({ input }) => updateErrorItem(input.code, { description: input.description, correction: input.correction })),
    uploadImage: protectedProcedure
      .input(z.object({
        code: z.string(),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `error-library/${input.code}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateErrorItem(input.code, { imageUrl: url, imageKey: key } as any);
        return { url, key };
      }),
    removeImage: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ input }) => {
        await updateErrorItem(input.code, { imageUrl: null, imageKey: null } as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteErrorLibraryItem(input.id)),
  }),
  faturamento: router({
    list: publicProcedure.query(() => getFaturamento()),
    upsert: publicProcedure
      .input(z.object({ mes: z.string(), ano: z.number(), valorFaturado: z.number(), totalPedidos: z.number() }))
      .mutation(({ input }) => upsertFaturamento(input.mes, input.ano, input.valorFaturado, input.totalPedidos)),
  }),

  financeiros: router({
    list: publicProcedure.query(() => getFinanceiros()),
    byMesAno: publicProcedure
      .input(z.object({ mes: z.number(), ano: z.number() }))
      .query(({ input }) => getFinanceiroByMesAno(input.mes, input.ano)),
    upsert: protectedProcedure
      .input(z.object({
        mes: z.number(),
        ano: z.number(),
        receitaBruta: z.number().optional(),
        receitaOperacional: z.number().optional(),
        receitaFinanceira: z.number().optional(),
        despesasTotal: z.number().optional(),
        despesasFixas: z.number().optional(),
        despesasVariaveis: z.number().optional(),
        despesasPessoal: z.number().optional(),
        despesasFinanceiras: z.number().optional(),
        despesasImpostos: z.number().optional(),
        lucroGruto: z.number().optional(),
        lucroOperacional: z.number().optional(),
        lucroLiquido: z.number().optional(),
        entradas: z.number().optional(),
        saidas: z.number().optional(),
        saldoMes: z.number().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(({ input }) => upsertFinanceiro(input)),
  }),

  // ─── Retrabalhos ────────────────────────────────────────────────────────
  retrabalhos: router({
    list: publicProcedure
      .input(z.object({ filter: filterSchema.optional(), page: z.number().default(1), pageSize: z.number().default(50) }))
      .query(({ input }) => listRetrabalhos(input.filter ?? {}, input.page, input.pageSize)),

    all: publicProcedure
      .input(filterSchema.optional())
      .query(({ input }) => getRetrabalhosAll(input ?? {})),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getRetrabalhosById(input.id)),

    create: protectedProcedure
      .input(z.object({
        titulo: z.string().optional().nullable(),
        osRetrabalhada: z.string().optional().nullable(), // Opcional para CNQ
        osOriginal: z.string().optional().nullable(), // Opcional para CNQ
        data: z.date(),
        setor: z.string(),
        tipo: z.enum(["INTERNO", "EXTERNO"]),
        custo: z.string().default("0"),
        frete: z.string().default("0"),
        total: z.string().default("0"),
        codigoErro: z.string().optional().nullable(),
        responsavel: z.string().min(1, "Responsável é obrigatório"),
        tipoResponsavel: z.enum(["operador", "gestor"]).default("operador"),
        descricao: z.string().optional().nullable(),
        classe: z.enum(["EVITÁVEL", "INEVITÁVEL"]),
        horasImpacto: z.union([z.number(), z.string()]).optional().nullable().transform(v => v != null ? String(v) : null),
        mes: z.string().optional().nullable(),
        tipoRegistro: z.enum(["retrabalho", "cnq"]).default("retrabalho"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createRetrabalho(input);
        // Registrar evento de auditoria (fire-and-forget)
        const newId = (result as { id?: number })?.id ?? null;
        insertAuditLog({
          retrabalhoId: newId,
          osRetrabalhada: input.osRetrabalhada,
          osOriginal: input.osOriginal,
          acao: "CRIACAO",
          usuarioId: ctx.user?.id ?? null,
          usuarioNome: ctx.user?.name ?? null,
          usuarioRole: ctx.user?.role ?? null,
          detalhes: { input },
        }).catch(() => {});
        return result;
      }),

    createBatch: protectedProcedure
      .input(z.object({
        titulo: z.string().optional().nullable(),
        osRetrabalhada: z.string().optional().nullable(), // Opcional para CNQ
        osOriginal: z.string().optional().nullable(), // Opcional para CNQ
        data: z.date(),
        setor: z.string(),
        tipo: z.enum(["INTERNO", "EXTERNO"]),
        custo: z.string().default("0"),
        frete: z.string().default("0"),
        total: z.string().default("0"),
        responsavel: z.string().min(1, "Responsável é obrigatório"),
        tipoResponsavel: z.enum(["operador", "gestor"]).default("operador"),
        descricao: z.string().optional().nullable(),
        classe: z.enum(["EVITÁVEL", "INEVITÁVEL"]),
        horasImpacto: z.union([z.number(), z.string()]).optional().nullable().transform(v => v != null ? String(v) : null),
        mes: z.string().optional().nullable(),
        tipoRegistro: z.enum(["retrabalho", "cnq"]).default("retrabalho"),
        errorIds: z.array(z.number()).min(1, "Selecione pelo menos um erro"),
      }))
      .mutation(async ({ input, ctx }) => {
        const { errorIds, ...baseData } = input;
        const results = await createBatchRetrabalhos(baseData, errorIds);
        results.forEach((result, idx) => {
          const newId = (result as { id?: number })?.id ?? null;
          insertAuditLog({
            retrabalhoId: newId,
            osRetrabalhada: input.osRetrabalhada,
            osOriginal: input.osOriginal,
            acao: "CRIACAO_LOTE",
            usuarioId: ctx.user?.id ?? null,
            usuarioNome: ctx.user?.name ?? null,
            usuarioRole: ctx.user?.role ?? null,
            detalhes: { batchIndex: idx, totalBatch: errorIds.length },
          }).catch(() => {});
        });
        return { success: true, count: results.length, results };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          titulo: z.string().optional().nullable(),
          osRetrabalhada: z.string().optional(),
          osOriginal: z.string().optional(),
          data: z.date().optional(),
          setor: z.string().optional(),
          tipo: z.enum(["INTERNO", "EXTERNO"]).optional(),
          custo: z.string().optional(),
          frete: z.string().optional(),
          total: z.string().optional(),
          codigoErro: z.string().optional().nullable(),
          responsavel: z.string().optional().nullable(),
          tipoResponsavel: z.enum(["operador", "gestor"]).optional(),
          descricao: z.string().optional().nullable(),
          classe: z.enum(["EVITÁVEL", "INEVITÁVEL"]).optional(),
          horasImpacto: z.union([z.number(), z.string()]).optional().nullable().transform(v => v != null ? String(v) : null),
          mes: z.string().optional().nullable(),
          tipoRegistro: z.enum(["retrabalho", "cnq"]).optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        // Buscar dados atuais antes de editar para registrar o diff
        const before = await getRetrabalhosById(input.id);
        const result = await updateRetrabalho(input.id, input.data);
        // Registrar evento de auditoria (fire-and-forget)
        insertAuditLog({
          retrabalhoId: input.id,
          osRetrabalhada: before?.osRetrabalhada ?? null,
          osOriginal: before?.osOriginal ?? null,
          acao: "EDICAO",
          usuarioId: ctx.user?.id ?? null,
          usuarioNome: ctx.user?.name ?? null,
          usuarioRole: ctx.user?.role ?? null,
          detalhes: { antes: before, alteracoes: input.data },
        }).catch(() => {});
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Buscar dados antes de excluir para preservar na auditoria
        const before = await getRetrabalhosById(input.id);
        const result = await deleteRetrabalho(input.id);
        // Registrar evento de auditoria (fire-and-forget)
        insertAuditLog({
          retrabalhoId: input.id,
          osRetrabalhada: before?.osRetrabalhada ?? null,
          osOriginal: before?.osOriginal ?? null,
          acao: "EXCLUSAO",
          usuarioId: ctx.user?.id ?? null,
          usuarioNome: ctx.user?.name ?? null,
          usuarioRole: ctx.user?.role ?? null,
          detalhes: { registroExcluido: before },
        }).catch(() => {});
        return result;
      }),
  }),

  // ─── Dashboard / KPIs ───────────────────────────────────────────────────
  dashboard: router({
    kpis: publicProcedure.input(filterSchema.optional()).query(({ input }) => getKpis(input ?? {})),
    bySetor: publicProcedure.input(filterSchema.optional()).query(({ input }) => getBySetor(input ?? {})),
    byCategoria: publicProcedure.input(filterSchema.optional()).query(({ input }) => getByCategoria(input ?? {})),
    byCodigoErro: publicProcedure.input(filterSchema.optional()).query(({ input }) => getByCodigoErro(input ?? {})),
    byResponsavel: publicProcedure.input(filterSchema.optional()).query(({ input }) => getByResponsavel(input ?? {})),
    evolucaoMensal: publicProcedure.query(() => getEvolucaoMensal()),
    evolucaoMensalCnq: publicProcedure.query(() => getEvolucaoMensal("cnq")),
    evolucaoMensalRetrabalho: publicProcedure.query(() => getEvolucaoMensal("retrabalho")),
    kpisCnq: publicProcedure.input(filterSchema.optional()).query(({ input }) => getKpis({ ...(input ?? {}), tipoRegistro: "cnq" })),
    reincidencia: publicProcedure.input(filterSchema.optional()).query(({ input }) => getReincidencia(input ?? {})),
    distinctValues: publicProcedure.query(() => getDistinctValues()),
    retrabalhosDodia: publicProcedure.query(async () => {
      const agora = new Date();
      const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
      const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
      const ontemInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 0, 0, 0, 0);
      const ontemFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 23, 59, 59, 999);
      const [hoje, ontem] = await Promise.all([
        getRetrabalhosAll({ dataInicio: hojeInicio, dataFim: hojeFim }),
        getRetrabalhosAll({ dataInicio: ontemInicio, dataFim: ontemFim }),
      ]);
      return {
        hoje,
        ontem,
        dataHoje: hojeInicio.toISOString(),
        dataOntem: ontemInicio.toISOString(),
      };
    }),
  }),

  // ─── Insights LLM ───────────────────────────────────────────────────────
  insights: router({
    generate: publicProcedure
      .input(filterSchema.optional())
      .mutation(async ({ input }) => {
        const [kpis, bySetor, byErro, byResp, evolucao, reincidencia, allRetrabalhos] = await Promise.all([
          getKpis(input ?? {}),
          getBySetor(input ?? {}),
          getByCodigoErro(input ?? {}),
          getByResponsavel(input ?? {}),
          getEvolucaoMensal(),
          getReincidencia(input ?? {}),
          getRetrabalhosAll(input ?? {}),
        ]);

        // Extrair descrições do ocorrido não vazias para enriquecer o contexto da IA
        const descricoes = allRetrabalhos
          .filter(r => r.descricao && r.descricao.trim().length > 10)
          .slice(0, 30) // limitar para não exceder tokens
          .map(r => `- [${r.setor}/${r.codigoErro ?? "sem código"}] ${r.descricao?.trim()}`);

        const context = `
Você é um especialista em qualidade industrial e gestão de produção de letreiros.
Analise os dados de retrabalho abaixo e gere insights práticos e acionáveis.

## KPIs Gerais
- Total de retrabalhos: ${kpis?.total}
- Custo total: R$ ${kpis?.custoTotal?.toFixed(2)}
- Custo médio por retrabalho: R$ ${kpis?.custoMedio?.toFixed(2)}
- Evitáveis: ${kpis?.evitavel} (${kpis?.pctEvitavel}%)
- Inevitáveis: ${kpis?.inevitavel} (${kpis?.pctInevitavel}%)

## Retrabalhos por Setor
${bySetor.map(s => `- ${s.setor}: ${s.count} ocorrências, R$ ${Number(s.custo).toFixed(2)}`).join("\n")}

## Erros Mais Frequentes
${byErro.slice(0, 10).map(e => `- ${e.codigoErro}: ${e.count} ocorrências, R$ ${Number(e.custo).toFixed(2)}`).join("\n")}

## Responsáveis com Mais Retrabalhos
${byResp.slice(0, 8).map(r => `- ${r.responsavel ?? "Sem responsável"}: ${r.count} ocorrências, R$ ${Number(r.custo).toFixed(2)}`).join("\n")}

## Evolução Mensal
${evolucao.map(m => `- ${m.mes}: ${m.count} retrabalhos, R$ ${Number(m.custo).toFixed(2)}, Evitáveis: ${m.evitavel}, Inevitáveis: ${m.inevitavel}`).join("\n")}

## Erros com Reincidência (≥2 ocorrências)
${reincidencia.slice(0, 10).map(r => `- ${r.codigoErro} (${r.setor}): ${r.count} reincidências, R$ ${Number(r.custo).toFixed(2)}, Responsáveis: ${r.responsaveis}`).join("\n")}
${descricoes.length > 0 ? `
## Descrições do Ocorrido (relatos reais dos operadores)
${descricoes.join("\n")}
` : ""}
`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: context },
            {
              role: "user",
              content: `Com base nesses dados de retrabalho de uma fábrica de letreiros, gere:

1. **Diagnóstico Geral** (2-3 parágrafos): análise crítica dos padrões identificados
2. **Top 3 Problemas Críticos**: os problemas mais urgentes com impacto financeiro
3. **Análise por Setor**: quais setores precisam de atenção imediata e por quê
4. **Padrões de Reincidência**: erros que se repetem e indicam falha de processo
5. **Análise das Descrições do Ocorrido**: se houver relatos dos operadores, identifique padrões nas causas raiz descritas, linguagem recorrente e situações que indicam falhas de processo ou treinamento
6. **Plano de Ação Prioritário**: 5 ações concretas e implementáveis imediatamente
7. **Metas Sugeridas**: indicadores e metas para os próximos 3 meses

Seja direto, técnico e prático. Use dados específicos dos números fornecidos. Quando houver relatos dos operadores, cite-os diretamente para embasar suas recomendações.`,
            },
          ],
        });

        return { content: response.choices[0]?.message?.content ?? "Não foi possível gerar insights." };
      }),
  }),

  // ─── OPERAÇÕES: Base de Conhecimento ────────────────────────────────────
  knowledge: router({
    list: publicProcedure
      .input(z.object({ search: z.string().optional(), category: z.string().optional() }).optional())
      .query(({ input }) => listKnowledge(input?.search, input?.category)),
    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getKnowledgeById(input.id)),
    create: protectedProcedure
      .input(z.object({ title: z.string(), content: z.string(), category: z.string(), subcategory: z.string().optional().nullable(), keywords: z.string().optional().nullable() }))
      .mutation(({ input }) => createKnowledge(input)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.object({ title: z.string().optional(), content: z.string().optional(), category: z.string().optional(), subcategory: z.string().optional().nullable(), keywords: z.string().optional().nullable() }) }))
      .mutation(({ input }) => updateKnowledge(input.id, input.data)),
     delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteKnowledge(input.id)),
    askAI: protectedProcedure
      .input(z.object({ question: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // 1) Buscar fontes internas: knowledge, erros, POPs e arquivos da biblioteca
        const [allKnowledge, allErrors, allPops, allArquivos] = await Promise.all([
          listKnowledge(input.question),
          getErrorLibrary(),
          listPops(),
          listArquivosBibliotecaComConteudo(),
        ]);

        // Filtrar por relevância simples (contém palavras da pergunta)
        const words = input.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matchScore = (text: string) => words.filter(w => text.toLowerCase().includes(w)).length;

        const topKnowledge = allKnowledge
          .map(k => ({ ...k, score: matchScore(k.title + " " + k.content) }))
          .filter(k => k.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        const topErrors = allErrors
          .map((e: any) => ({ ...e, score: matchScore((e.code ?? "") + " " + (e.description ?? "") + " " + (e.correction ?? "")) }))
          .filter((e: any) => e.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 3);

        const topPops = allPops
          .map((p: any) => ({ ...p, score: matchScore((p.title ?? "") + " " + (p.steps ?? "") + " " + (p.objective ?? "")) }))
          .filter((p: any) => p.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 2);

        // Filtrar arquivos da biblioteca com conteúdo extraído e relevância
        const topArquivos = allArquivos
          .filter((a: any) => a.conteudoExtraido && a.conteudoExtraido.trim().length > 0)
          .map((a: any) => ({
            ...a,
            score: matchScore(
              (a.nome ?? "") + " " +
              (a.descricao ?? "") + " " +
              (a.tags ?? "") + " " +
              (a.categoria ?? "") + " " +
              (a.conteudoExtraido ?? "")
            ),
          }))
          .filter((a: any) => a.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 3);

        const hasInternalContent = topKnowledge.length > 0 || topErrors.length > 0 || topPops.length > 0 || topArquivos.length > 0;

        // 2) Montar contexto interno para o Gemini
        let contextText = "";
        if (topKnowledge.length > 0) {
          contextText += "\n## Artigos da Base de Conhecimento\n";
          topKnowledge.forEach(k => { contextText += `### ${k.title}\n${k.content}\n\n`; });
        }
        if (topErrors.length > 0) {
          contextText += "\n## Erros Documentados\n";
          topErrors.forEach((e: any) => { contextText += `- **${e.code}** ${e.description}: ${e.correction}\n`; });
        }
        if (topPops.length > 0) {
          contextText += "\n## Procedimentos Operacionais (POPs)\n";
          topPops.forEach((p: any) => { contextText += `### ${p.title}\n${p.steps}\n\n`; });
        }
        if (topArquivos.length > 0) {
          contextText += "\n## Documentos da Biblioteca de Arquivos\n";
          topArquivos.forEach((a: any) => {
            const excerptSize = 1500;
            const excerpt = (a.conteudoExtraido as string).slice(0, excerptSize);
            contextText += `### ${a.nome} (${a.categoria}${a.subcategoria ? " > " + a.subcategoria : ""})\n${excerpt}\n\n`;
          });
        }

        // 3) Chamar Gemini
        const { askGemini } = await import("./gemini");
        const systemPrompt = hasInternalContent
          ? `Você é um assistente especialista nos processos internos da empresa Letreiros Express. Use o contexto interno fornecido como base principal para responder. Se o contexto não for suficiente, complemente com seu conhecimento geral. Seja objetivo e prático. Responda em no máximo 3 parágrafos curtos.`
          : `Você é um assistente especialista em processos industriais e produção de letreiros. A pergunta não possui informações na base interna da empresa. Responda com base no seu conhecimento geral de forma objetiva e prática. Deixe claro que esta é uma resposta geral, não baseada em dados internos da empresa. Responda em no máximo 3 parágrafos curtos.`;

        const geminiAnswer = await askGemini([
          { role: "user" as const, parts: [{ text: `${systemPrompt}\n\n${contextText ? `Contexto interno:\n${contextText}\n\n` : ""}Pergunta: ${input.question}` }] },
        ]);

        return {
          internalSources: {
            hasContent: hasInternalContent,
            knowledge: topKnowledge.map(k => ({ id: k.id, title: k.title, category: k.category, excerpt: k.content.slice(0, 300) })),
            errors: topErrors.map((e: any) => ({ code: e.code, description: e.description, correction: e.correction })),
            pops: topPops.map((p: any) => ({ id: p.id, title: p.title, code: p.code })),
            files: topArquivos.map((a: any) => ({ id: a.id, nome: a.nome, categoria: a.categoria, subcategoria: a.subcategoria, fileName: a.fileName, fileUrl: a.fileUrl, conteudoExtraido: a.conteudoExtraido ?? null })),
          },
          geminiAnswer,
          geminiAnswerIsGeneral: !hasInternalContent,
        };
      }),
  }),

  // ─── SUGESTÕES DE INCORPORAÇÃO NA BASE DE CONHECIMENTO ──────────────────
  knowledgeSuggestions: router({
    list: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(({ input }) => listKnowledgeSuggestions(input?.status)),
    create: protectedProcedure
      .input(z.object({
        pergunta: z.string(),
        conteudoSugerido: z.string(),
        fonte: z.enum(["gemini", "manual"]).default("manual"),
        tituloSugerido: z.string().optional(),
        categoriaSugerida: z.string().optional(),
      }))
      .mutation(({ input, ctx }) => createKnowledgeSuggestion({
        ...input,
        autorId: ctx.user?.id ? Number(ctx.user.id) : undefined,
        autorNome: ctx.user?.name ?? "Usuário",
      } as any)),
    // Master aprova: cria artigo na base de conhecimento
    approve: protectedProcedure
      .input(z.object({
        id: z.number(),
        titulo: z.string(),
        categoria: z.string(),
        conteudo: z.string(),
        observacao: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.localUser?.role !== "master" && ctx.localUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o master pode aprovar sugestões." });
        }
        // Criar artigo na base de conhecimento
        await createKnowledge({ title: input.titulo, content: input.conteudo, category: input.categoria });
        // Atualizar status da sugestão
        await updateKnowledgeSuggestion(input.id, {
          status: "aprovado",
          tituloSugerido: input.titulo,
          categoriaSugerida: input.categoria,
          observacaoMaster: input.observacao,
        });
        return { success: true };
      }),
    reject: protectedProcedure
      .input(z.object({ id: z.number(), observacao: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.localUser?.role !== "master" && ctx.localUser?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o master pode rejeitar sugestões." });
        }
        await updateKnowledgeSuggestion(input.id, { status: "rejeitado", observacaoMaster: input.observacao });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteKnowledgeSuggestion(input.id)),
  }),
  // ─── OPERAÇÕES: Fornecedores ─────────────────────────────────────────────
  suppliers: router({
    list: publicProcedure
      .input(z.object({ search: z.string().optional(), category: z.string().optional() }).optional())
      .query(({ input }) => listSuppliers(input?.search, input?.category)),
    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getSupplierById(input.id)),
    create: protectedProcedure
      .input(z.object({ name: z.string(), company: z.string().optional().nullable(), category: z.string(), supplies: z.string().optional().nullable(), contact: z.string().optional().nullable(), phone: z.string().optional().nullable(), email: z.string().optional().nullable(), paymentTerms: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
      .mutation(({ input, ctx }) => createSupplier({ ...input, createdByNome: ctx.user.name ?? ctx.user.email ?? "sistema", updatedByNome: ctx.user.name ?? ctx.user.email ?? "sistema" } as any)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.object({ name: z.string().optional(), company: z.string().optional().nullable(), category: z.string().optional(), supplies: z.string().optional().nullable(), contact: z.string().optional().nullable(), phone: z.string().optional().nullable(), email: z.string().optional().nullable(), paymentTerms: z.string().optional().nullable(), notes: z.string().optional().nullable(), active: z.enum(["sim", "nao"]).optional() }) }))
      .mutation(({ input, ctx }) => updateSupplier(input.id, { ...input.data, updatedByNome: ctx.user.name ?? ctx.user.email ?? "sistema" } as any)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteSupplier(input.id)),
  }),

  // ─── OPERAÇÕES: Rotinas ──────────────────────────────────────────────────────────────────
  routines: router({
    list: publicProcedure.query(() => listRoutines()),
    pending: publicProcedure.query(() => listPendingRoutines()),
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional().nullable(),
        frequency: z.enum(["diaria", "semanal", "quinzenal", "mensal", "esporadico"]),
        assignedTo: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        calendarDates: z.string().optional().nullable(),
      }))
      .mutation(({ input }) => createRoutine(input as any)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          title: z.string().optional(),
          description: z.string().optional().nullable(),
          frequency: z.enum(["diaria", "semanal", "quinzenal", "mensal", "esporadico"]).optional(),
          assignedTo: z.string().optional().nullable(),
          status: z.enum(["pendente", "em_dia", "atrasada"]).optional(),
          lastDone: z.date().optional().nullable(),
          startDate: z.string().optional().nullable(),
          calendarDates: z.string().optional().nullable(),
          nextDue: z.date().optional().nullable(),
        }),
      }))
      .mutation(({ input }) => updateRoutine(input.id, input.data as any)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteRoutine(input.id)),
    markDone: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => markRoutineDone(input.id)),
  }),

  // ─── OPERAÇÕES: Regulamentos ─────────────────────────────────────────────────────
  regulations: router({
    list: publicProcedure.input(z.object({ type: z.string().optional() }).optional()).query(({ input }) => listRegulations(input?.type)),
    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getRegulationById(input.id)),
    create: protectedProcedure
      .input(z.object({ title: z.string(), type: z.enum(["regulamento", "memorando", "politica", "procedimento"]), content: z.string(), version: z.string().optional().nullable() }))
      .mutation(({ input }) => createRegulation(input as any)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.object({ title: z.string().optional(), type: z.enum(["regulamento", "memorando", "politica", "procedimento"]).optional(), content: z.string().optional(), version: z.string().optional().nullable(), active: z.enum(["sim", "nao"]).optional() }) }))
      .mutation(({ input }) => updateRegulation(input.id, input.data as any)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteRegulation(input.id)),
  }),

  // ─── OPERAÇÕES: POPs ─────────────────────────────────────────────────────
  pops: router({
    list: publicProcedure.input(z.object({ sector: z.string().optional() }).optional()).query(({ input }) => listPops(input?.sector)),
    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getPopById(input.id)),
    create: protectedProcedure
      .input(z.object({ code: z.string(), title: z.string(), sector: z.string(), objective: z.string().optional().nullable(), steps: z.string(), responsible: z.string().optional().nullable(), version: z.string().optional().nullable() }))
      .mutation(({ input }) => createPop(input as any)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.object({ code: z.string().optional(), title: z.string().optional(), sector: z.string().optional(), objective: z.string().optional().nullable(), steps: z.string().optional(), responsible: z.string().optional().nullable(), version: z.string().optional().nullable(), active: z.enum(["sim", "nao"]).optional() }) }))
      .mutation(({ input }) => updatePop(input.id, input.data as any)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deletePop(input.id)),

    // Gera um POP automaticamente via IA a partir de um erro da biblioteca
    generateFromError: protectedProcedure
      .input(z.object({
        errorCode: z.string(),
        errorDescription: z.string(),
        errorCategory: z.string(),
        correction: z.string(),
        // histórico de ocorrências para enriquecer o contexto
        occurrenceCount: z.number().optional(),
        totalCost: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `Você é um especialista em qualidade e processos industriais de uma fábrica de letreiros chamada Letreiros Express.

Com base nas informações abaixo sobre um tipo de erro de retrabalho, crie um Procedimento Operacional Padrão (POP) completo e detalhado para PREVENIR a recorrência deste erro.

## Dados do Erro
- **Código:** ${input.errorCode}
- **Categoria/Setor:** ${input.errorCategory}
- **Descrição do erro:** ${input.errorDescription}
- **Ação corretiva documentada:** ${input.correction}
${input.occurrenceCount ? `- **Ocorrências registradas:** ${input.occurrenceCount}` : ""}
${input.totalCost ? `- **Custo total acumulado:** R$ ${input.totalCost.toFixed(2)}` : ""}

Crie um POP estruturado com:
1. **Objetivo** — o que este POP visa prevenir/garantir (2-3 frases)
2. **Passos detalhados** — mínimo 5 passos numerados, cada um com ação clara e verificação
3. **Pontos de atenção** — riscos e cuidados específicos
4. **Critério de aceitação** — como saber que o processo foi executado corretamente

O POP deve ser prático, direto e aplicável no chão de fábrica. Use linguagem simples e imperativa (ex: "Verifique...", "Aplique...", "Confirme...").`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um especialista em qualidade industrial e criação de POPs para fábricas de letreiros. Responda sempre em português brasileiro." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pop_gerado",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do POP (ex: POP - Prevenção de Erro de Solda ES-01)" },
                  objective: { type: "string", description: "Objetivo do POP em 2-3 frases" },
                  steps: {
                    type: "array",
                    description: "Lista de passos do procedimento",
                    items: {
                      type: "object",
                      properties: {
                        step: { type: "number", description: "Número do passo" },
                        action: { type: "string", description: "Ação a ser executada" },
                        check: { type: "string", description: "Verificação ou critério de aceitação do passo" },
                      },
                      required: ["step", "action", "check"],
                      additionalProperties: false,
                    },
                  },
                  attention_points: {
                    type: "array",
                    description: "Pontos de atenção e riscos",
                    items: { type: "string" },
                  },
                  acceptance_criteria: { type: "string", description: "Critério geral de aceitação do procedimento" },
                },
                required: ["title", "objective", "steps", "attention_points", "acceptance_criteria"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = (response.choices[0]?.message?.content as string) ?? "{}";
        let parsed: { title: string; objective: string; steps: Array<{step: number; action: string; check: string}>; attention_points: string[]; acceptance_criteria: string };
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new Error("Falha ao interpretar resposta da IA");
        }

        // Monta o código do POP automaticamente baseado no código do erro
        const existingPops = await listPops();
        const popCode = `POP-${input.errorCode}`;
        // Verifica se já existe um POP para este erro
        const existing = existingPops.find(p => p.code === popCode);

        // Formata os passos como texto estruturado para armazenamento
        const stepsText = [
          ...parsed.steps.map(s => `${s.step}. ${s.action}\n   ✓ ${s.check}`),
          "",
          "⚠️ PONTOS DE ATENÇÃO:",
          ...parsed.attention_points.map(p => `• ${p}`),
          "",
          "✅ CRITÉRIO DE ACEITAÇÃO:",
          parsed.acceptance_criteria,
        ].join("\n");

        if (existing) {
          // Atualiza o POP existente com nova versão
          const rawVer = (existing.version ?? "1.0").replace(/^v/i, "");
          const currentVersion = parseFloat(rawVer) || 1.0;
          const newVersion = (currentVersion + 0.1).toFixed(1);
          await updatePop(existing.id, {
            title: parsed.title,
            objective: parsed.objective,
            steps: stepsText,
            version: newVersion,
          });
          return { action: "updated", popCode, popId: existing.id, title: parsed.title, stepsText, parsed };
        } else {
          // Cria novo POP
          const result = await createPop({
            code: popCode,
            title: parsed.title,
            sector: input.errorCategory,
            objective: parsed.objective,
            steps: stepsText,
            responsible: "",
            version: "1.0",
          });
          return { action: "created", popCode, popId: (result as any).insertId, title: parsed.title, stepsText, parsed };
        }
      }),

    // Incorpora o conhecimento de um erro a um POP existente via IA
    incorporateError: protectedProcedure
      .input(z.object({
        popId: z.number(),
        errorCode: z.string(),
        errorDescription: z.string(),
        errorCategory: z.string(),
        correction: z.string(),
      }))
      .mutation(async ({ input }) => {
        const pop = await getPopById(input.popId);
        if (!pop) throw new Error("POP não encontrado");

        const prompt = `Você é um especialista em qualidade industrial da Letreiros Express.

Abaixo está um POP (Procedimento Operacional Padrão) existente e um novo conhecimento sobre um erro de retrabalho que deve ser incorporado a ele.

## POP Existente
- **Código:** ${pop.code}
- **Título:** ${pop.title}
- **Objetivo atual:** ${pop.objective ?? "(não definido)"}
- **Passos/Procedimento atual:**
${pop.steps}

## Novo Conhecimento a Incorporar
- **Código do Erro:** ${input.errorCode}
- **Categoria/Setor:** ${input.errorCategory}
- **Descrição do erro:** ${input.errorDescription}
- **Ação corretiva documentada:** ${input.correction}

## Tarefa
Atualize o POP incorporando o novo conhecimento de forma coerente e complementar ao conteúdo existente. Não remova passos já existentes — apenas enriqueça, adicione ou refine.

Retorne o POP atualizado com:
1. **Objetivo** — revisado se necessário (2-3 frases)
2. **Passos detalhados** — lista completa e enriquecida com os novos conhecimentos
3. **Pontos de atenção** — incluindo os novos riscos identificados
4. **Critério de aceitação** — revisado se necessário

Use linguagem simples e imperativa ("Verifique...", "Aplique...", "Confirme...").`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um especialista em qualidade industrial e criação de POPs para fábricas de letreiros. Responda sempre em português brasileiro." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pop_atualizado",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  objective: { type: "string" },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        step: { type: "number" },
                        action: { type: "string" },
                        check: { type: "string" },
                      },
                      required: ["step", "action", "check"],
                      additionalProperties: false,
                    },
                  },
                  attention_points: { type: "array", items: { type: "string" } },
                  acceptance_criteria: { type: "string" },
                },
                required: ["objective", "steps", "attention_points", "acceptance_criteria"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = (response.choices[0]?.message?.content as string) ?? "{}";
        let parsed: { objective: string; steps: Array<{step: number; action: string; check: string}>; attention_points: string[]; acceptance_criteria: string };
        try { parsed = JSON.parse(raw); } catch { throw new Error("Falha ao interpretar resposta da IA"); }

        const stepsText = [
          ...parsed.steps.map(s => `${s.step}. ${s.action}\n   ✓ ${s.check}`),
          "",
          "⚠️ PONTOS DE ATENÇÃO:",
          ...parsed.attention_points.map(p => `• ${p}`),
          "",
          "✅ CRITÉRIO DE ACEITAÇÃO:",
          parsed.acceptance_criteria,
        ].join("\n");

        const rawVer = (pop.version ?? "1.0").replace(/^v/i, "");
        const currentVersion = parseFloat(rawVer) || 1.0;
        const newVersion = (currentVersion + 0.1).toFixed(1);

        await updatePop(input.popId, {
          objective: parsed.objective,
          steps: stepsText,
          version: newVersion,
        });

        return { popId: input.popId, popCode: pop.code, title: pop.title, newVersion, stepsText, parsed };
      }),
    // Gera um POP unificado por categoria abrangendo todos os erros da categoria
    generateFromCategory: protectedProcedure
      .input(z.object({
        category: z.string(),
        errors: z.array(z.object({
          code: z.string(),
          description: z.string(),
          correction: z.string(),
          imageUrl: z.string().optional().nullable(),
        })),
      }))
      .mutation(async ({ input }) => {
        const errorsText = input.errors.map(e =>
          `- **${e.code}** — ${e.description}\n  Ação corretiva: ${e.correction}`
        ).join("\n");
        // Coletar imagens dos erros para incluir no POP
        const errorImages = input.errors
          .filter(e => e.imageUrl)
          .map(e => ({ code: e.code, description: e.description, imageUrl: e.imageUrl! }));

        const prompt = `Você é um especialista em qualidade e processos industriais da Letreiros Express (fábrica de letreiros).
Crie um Procedimento Operacional Padrão (POP) UNIFICADO para a categoria "${input.category}" que abranja e previna TODOS os erros listados abaixo.

## Erros da Categoria ${input.category}
${errorsText}

## REGRA CRÍTICA — PRESERVAÇÃO INTEGRAL DAS INSTRUÇÕES
⚠️ NUNCA abrevie, resuma, encurte ou remova qualquer parte do texto das "Ações corretivas" fornecidas acima.
Cada campo "Ação corretiva" deve aparecer INTEGRALMENTE no campo "action" do passo correspondente.
Você pode COMPLEMENTAR com contexto adicional APÓS o texto original, mas JAMAIS pode remover, encurtar ou parafrasear o conteúdo original.
Se a ação corretiva original tiver 3 frases, o campo action deve conter essas mesmas 3 frases + eventuais complementos.

## Instruções
O POP deve:
- Ter um objetivo geral que cubra todos os erros da categoria
- Ter um passo dedicado para CADA erro listado, com o texto da ação corretiva PRESERVADO INTEGRALMENTE
- Cada passo deve ser claro, acionável e verificarável no chão de fábrica
- Incluir pontos de atenção específicos para os riscos desta categoria
- Usar linguagem simples e imperativa ("Verifique...", "Aplique...", "Confirme...")
- Ser prático e direto, voltado para treinamento de mão-de-obra
- Mínimo de 6 passos; adicione passos de preparação e verificação final além dos passos de cada erro`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um especialista em qualidade industrial e criação de POPs para fábricas de letreiros. Responda sempre em português brasileiro." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pop_categoria",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do POP (ex: POP - Iluminação)" },
                  objective: { type: "string", description: "Objetivo geral do POP em 2-3 frases" },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        step: { type: "number" },
                        action: { type: "string" },
                        check: { type: "string" },
                      },
                      required: ["step", "action", "check"],
                      additionalProperties: false,
                    },
                  },
                  attention_points: { type: "array", items: { type: "string" } },
                  acceptance_criteria: { type: "string" },
                },
                required: ["title", "objective", "steps", "attention_points", "acceptance_criteria"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = (response.choices[0]?.message?.content as string) ?? "{}";
        let parsed: { title: string; objective: string; steps: Array<{step: number; action: string; check: string}>; attention_points: string[]; acceptance_criteria: string };
        try { parsed = JSON.parse(raw); } catch { throw new Error("Falha ao interpretar resposta da IA"); }

        const stepsText = [
          ...parsed.steps.map(s => `${s.step}. ${s.action}\n   \u2713 ${s.check}`),
          "",
          "\u26a0\ufe0f PONTOS DE ATEN\u00c7\u00c3O:",
          ...parsed.attention_points.map(p => `\u2022 ${p}`),
          "",
          "\u2705 CRIT\u00c9RIO DE ACEITA\u00c7\u00c3O:",
          parsed.acceptance_criteria,
        ].join("\n");

        // Código do POP baseado na categoria
        const categorySlug = input.category.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
        const popCode = `POP-${categorySlug}`;
        const existingPops = await listPops();
        const existing = existingPops.find(p => p.code === popCode);

        if (existing) {
          const rawVer = (existing.version ?? "1.0").replace(/^v/i, "");
          const newVersion = ((parseFloat(rawVer) || 1.0) + 0.1).toFixed(1);
          await updatePop(existing.id, { title: parsed.title, objective: parsed.objective, steps: stepsText, version: newVersion });
          return { action: "updated", popCode, popId: existing.id, title: parsed.title, stepsText, parsed, errorImages };
        } else {
          const result = await createPop({
            code: popCode,
            title: parsed.title,
            sector: input.category,
            objective: parsed.objective,
            steps: stepsText,
            responsible: "",
            version: "1.0",
          });
          return { action: "created", popCode, popId: (result as any).insertId, title: parsed.title, stepsText, parsed, errorImages };
        }
      }),

    // Edição manual de texto do POP
    updateContent: publicProcedure      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        objective: z.string().optional().nullable(),
        steps: z.string().optional(),
        responsible: z.string().optional().nullable(),
        version: z.string().optional().nullable(),
        sector: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updatePop(id, data as any);
      }),

    // Upload de imagem em anexo ao POP
    uploadImage: publicProcedure
      .input(z.object({
        popId: z.number(),
        fileName: z.string(),
        fileBase64: z.string(), // base64 da imagem
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `pops/${input.popId}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        // Busca o POP e adiciona a imagem à lista de attachments
        const pop = await getPopById(input.popId);
        if (!pop) throw new TRPCError({ code: "NOT_FOUND", message: "POP não encontrado" });
        let attachments: string[] = [];
        try {
          attachments = pop.attachments ? JSON.parse(pop.attachments as string) : [];
        } catch { attachments = []; }
        attachments.push(url);
        await updatePop(input.popId, { attachments: JSON.stringify(attachments) } as any);
        return { url, attachments };
      }),

    // Remove imagem de anexo do POP
    removeImage: publicProcedure
      .input(z.object({ popId: z.number(), url: z.string() }))
      .mutation(async ({ input }) => {
        const pop = await getPopById(input.popId);
        if (!pop) throw new TRPCError({ code: "NOT_FOUND", message: "POP não encontrado" });
        let attachments: string[] = [];
        try {
          attachments = pop.attachments ? JSON.parse(pop.attachments as string) : [];
        } catch { attachments = []; }
        attachments = attachments.filter(u => u !== input.url);
        await updatePop(input.popId, { attachments: JSON.stringify(attachments) } as any);
        return { attachments };
      }),

    // Registrar acesso (visualização) a um POP
    registrarAcesso: protectedProcedure
      .input(z.object({
        popId: z.number(),
        popCode: z.string(),
        popTitle: z.string(),
        tipo: z.enum(["visualizacao", "download"]).default("visualizacao"),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return { success: false };
        const { popAcessos } = await import("../drizzle/schema");
        await db.insert(popAcessos).values({
          popId: input.popId,
          popCode: input.popCode,
          popTitle: input.popTitle,
          usuarioNome: ctx.user.name ?? ctx.user.email ?? "desconhecido",
          usuarioEmail: ctx.user.email ?? null,
          tipo: input.tipo,
        });
        return { success: true };
      }),

    // Relatório de acessos/downloads de POPs
    relatorioAcessos: protectedProcedure
      .input(z.object({
        popId: z.number().optional(),
        tipo: z.enum(["visualizacao", "download", "todos"]).default("todos"),
        dataInicio: z.string().optional(), // ISO date string
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { popAcessos } = await import("../drizzle/schema");
        const { desc: descOrder, eq: eqOp, and: andOp, gte: gteOp, lte: lteOp } = await import("drizzle-orm");
        const conditions: any[] = [];
        if (input?.popId) conditions.push(eqOp(popAcessos.popId, input.popId));
        if (input?.tipo && input.tipo !== "todos") conditions.push(eqOp(popAcessos.tipo, input.tipo as any));
        if (input?.dataInicio) conditions.push(gteOp(popAcessos.createdAt, new Date(input.dataInicio)));
        if (input?.dataFim) conditions.push(lteOp(popAcessos.createdAt, new Date(input.dataFim + "T23:59:59")));
        const where = conditions.length > 0 ? andOp(...conditions) : undefined;
        const rows = await db.select().from(popAcessos).where(where).orderBy(descOrder(popAcessos.createdAt)).limit(500);
        return rows;
      }),

    // Estatísticas de acessos por POP
    estatisticasAcessos: protectedProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { popAcessos } = await import("../drizzle/schema");
      const { sql: sqlRaw, desc: descOrder } = await import("drizzle-orm");
      const rows = await db
        .select({
          popCode: popAcessos.popCode,
          popTitle: popAcessos.popTitle,
          totalVisualizacoes: sqlRaw<number>`SUM(CASE WHEN ${popAcessos.tipo} = 'visualizacao' THEN 1 ELSE 0 END)`,
          totalDownloads: sqlRaw<number>`SUM(CASE WHEN ${popAcessos.tipo} = 'download' THEN 1 ELSE 0 END)`,
          total: sqlRaw<number>`COUNT(*)`,
          ultimoAcesso: sqlRaw<Date>`MAX(${popAcessos.createdAt})`,
        })
        .from(popAcessos)
        .groupBy(popAcessos.popCode, popAcessos.popTitle)
        .orderBy(descOrder(sqlRaw`COUNT(*)`));
      return rows;
    }),
  }),

  // ─── LOCAL AUTH (e-mail + senha) ─────────────────────────────────────────
  localAuth: router({
    login: publicProcedure
      .input(z.object({ emailOrName: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        // Tenta por e-mail primeiro; se não encontrar, tenta por nome (para usuários de produção)
        const isEmail = input.emailOrName.includes("@");
        let user = isEmail
          ? await getLocalUserByEmail(input.emailOrName.toLowerCase().trim())
          : await getLocalUserByName(input.emailOrName.trim());
        // Fallback: se veio como e-mail mas não achou, tenta por nome
        if (!user && isEmail) user = await getLocalUserByName(input.emailOrName.trim());
        if (!user || user.active !== "sim") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
        }
        // Cria sessão: reutiliza o mesmo cookie de sessão do sistema
        const jwt = await import("jsonwebtoken");
        const token = jwt.default.sign(
          { localUserId: user.id, email: user.email, role: user.role, name: user.name },
          process.env.JWT_SECRET ?? "secret",
          { expiresIn: "7d" }
        );
        ctx.res.cookie("local_session", token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        const permissions = await getPermissionsForRole(user.role);
        return { id: user.id, name: user.name, email: user.email, role: user.role, permissions };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie("local_session");
      return { ok: true };
    }),

    me: publicProcedure.query(async ({ ctx }) => {
      const cookie = ctx.req.cookies?.local_session;
      if (!cookie) return null;
      try {
        const jwt = await import("jsonwebtoken");
        const decoded = jwt.default.verify(cookie, process.env.JWT_SECRET ?? "secret") as any;
        const user = await getLocalUserById(decoded.localUserId);
        if (!user || user.active !== "sim") return null;
        const permissions = await getPermissionsForRole(user.role);
        return { id: user.id, name: user.name, email: user.email, role: user.role, permissions };
      } catch { return null; }
    }),

    // Retorna o localUser resolvido pelo contexto (funciona tanto para login local quanto OAuth)
    myLocalRole: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.localUser) return null;
      return { id: ctx.localUser.id, name: ctx.localUser.name, role: ctx.localUser.role };
    }),
  }),

  // ─── GERENCIAMENTO DE USUÁRIOS LOCAIS (master/admin) ─────────────────────
  localUsers: router({
    // Endpoint público para seletores de responsável em todo o sistema
    activeList: publicProcedure.query(async () => {
      const allUsers = await listLocalUsers();
      return allUsers
        .filter(u => u.active === "sim")
        .map(u => ({ id: u.id, name: u.name, role: u.role }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }),
    list: publicProcedure.query(async ({ ctx }) => {
      const allUsers = await listLocalUsers();
      // Modo bootstrap: se não há usuários, permite acesso livre
      if (allUsers.length === 0) return allUsers;
      const role = ctx.localUser?.role ?? ctx.user?.role;
      if (role !== "admin" && role !== "master") throw new TRPCError({ code: "FORBIDDEN" });
      return allUsers;
    }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email().optional(),
        password: z.string().min(6),
        role: z.enum(["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const allUsers = await listLocalUsers();
        // Modo bootstrap: se não há usuários, qualquer um pode criar o primeiro
        if (allUsers.length > 0) {
          const role = ctx.localUser?.role ?? ctx.user?.role;
          if (role !== "admin" && role !== "master") throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Usuários de produção/empacotamento podem ser criados sem e-mail
        const needsEmail = input.role !== "producao" && input.role !== "empacotamento";
        if (needsEmail && !input.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "E-mail obrigatório para esta função" });
        }
        if (input.email) {
          const existing = await getLocalUserByEmail(input.email.toLowerCase());
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado" });
        }
        // Verificar duplicidade de nome para usuários sem e-mail
        const existingName = await getLocalUserByName(input.name.trim());
        if (existingName) throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com esse nome" });
        const passwordHash = await bcrypt.hash(input.password, 10);
        return createLocalUser({
          name: input.name.trim(),
          email: input.email ? input.email.toLowerCase() : undefined,
          passwordHash,
          role: input.role,
          active: "sim",
        });
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        role: z.enum(["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"]).optional(),
        password: z.string().min(6).optional(),
        active: z.enum(["sim", "nao"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const allUsers = await listLocalUsers();
        if (allUsers.length > 0) {
          const role = ctx.localUser?.role ?? ctx.user?.role;
          if (role !== "admin" && role !== "master") throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { id, password, ...rest } = input;
        const data: Record<string, unknown> = { ...rest };
        if (password) data.passwordHash = await bcrypt.hash(password, 10);
        return updateLocalUser(id, data as any);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const allUsers = await listLocalUsers();
        if (allUsers.length > 0) {
          const role = ctx.localUser?.role ?? ctx.user?.role;
          if (role !== "admin" && role !== "master") throw new TRPCError({ code: "FORBIDDEN" });
        }
        return deleteLocalUser(input.id);
      }),
  }),

  // ─── PERMISSÕES POR ROLE ──────────────────────────────────────────────────
  permissions: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      const role = ctx.localUser?.role ?? ctx.user?.role;
      if (role !== "admin" && role !== "master") throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await getAllRolePermissions();
      // Retorna matriz: { role: { pageKey: boolean } }
      const matrix: Record<string, Record<string, boolean>> = {};
      for (const role of APP_ROLES) {
        matrix[role] = {};
        for (const page of PAGE_KEYS) {
          matrix[role][page] = role === "master" || role === "admin";
        }
      }
      for (const row of rows) {
        if (!matrix[row.role]) matrix[row.role] = {};
        matrix[row.role][row.pageKey] = row.canAccess === "sim";
      }
      return matrix;
    }),

    set: protectedProcedure
      .input(z.object({
        role: z.enum(["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"]),
        pageKey: z.string(),
        canAccess: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const role = ctx.localUser?.role ?? ctx.user?.role;
        if (role !== "admin" && role !== "master") throw new TRPCError({ code: "FORBIDDEN" });
        return setRolePermission(input.role, input.pageKey, input.canAccess ? "sim" : "nao");
      }),

    myPermissions: publicProcedure.query(async ({ ctx }) => {
      // Retorna as páginas que o usuário atual pode acessar
      if (!ctx.user) {
        // Verifica cookie local
        return [];
      }
      const role = ctx.user.role as any;
      return getPermissionsForRole(role);
    }),
  }),
  // ─── COMENTÁRIOS DA BASE DE CONHECIMENTO ──────────────────────────────────────────────────────
  knowledgeComments: router({
    list: publicProcedure
      .input(z.object({ knowledgeId: z.number() }))
      .query(async ({ input }) => {
        return listKnowledgeComments(input.knowledgeId);
      }),
    create: publicProcedure
      .input(z.object({
        knowledgeId: z.number(),
        author: z.string().min(1).max(128).default("Equipe"),
        content: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await createKnowledgeComment(input);
        return { ok: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteKnowledgeComment(input.id);
        return { ok: true };
      }),
  }),

  price: router({
    list: publicProcedure
      .input(z.object({ page: z.number().optional() }))
      .query(async ({ input }) => {
        return listPriceTableSections(input.page);
      }),
    getMeta: publicProcedure
      .query(async () => {
        return getPriceTableMeta();
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        sectionTitle: z.string().optional(),
        contentJson: z.string().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updatePriceTableSection(id, data, ctx.user.name ?? ctx.user.email ?? "usuário");
        return { ok: true };
      }),
    addSection: protectedProcedure
      .input(z.object({
        page: z.number(),
        sectionTitle: z.string(),
        contentJson: z.string(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await addPriceTableSection(input);
        return { ok: true, id };
      }),
    deleteSection: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePriceTableSection(input.id);
        return { ok: true };
      }),
    getHistory: publicProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return listPriceTableHistory(input.limit ?? 100);
      }),
  }),
  // ─── PERFORMANCE ────────────────────────────────────────────────────────────────
  performance: performanceRouter,
  performanceAbc: performanceAbcRouter,
  performanceComercial: performanceComercialRouter,
  crm: crmRouter,
  custoLed: custoLedRouter,
  auditoria: auditoriaRouter,
  cargos: cargosRouter,
  curriculos: curriculosRouter,
  pcp: pcpRouter,
  empacotamento: empacotamentoRouter,
  // ─── BIBLIOTECA DE ARQUIVOS ─────────────────────────────────────────────────────
  bibliotecaArquivos: bibliotecaArquivosRouter,
  // ─── QUALIDADE ────────────────────────────────────────────────────────────────
  acoesCorretivas: acoesCorretivasRouter,
  metasRetrabalho: metasRetrabalhoRouter,
  planosAcao: planosAcaoRouter,
  alertas: alertasRouter,
  desempenhoColaborador: desempenhoColaboradorRouter,
  metasOperacionais: metasRouter,
  metaProdutos: metaProdutosRouter,
  financeiro: financeiroRouter,
  observacoesFinanceiras: observacoesFinanceirasRouter,
  desempenhoColabMensal: desempenhoColabMensalRouter,
  // LOGISTICA ────────────────────────────────────────────────────────────────────
  transportadoras: transportadorasRouter,
  cotacoesFrete: cotacoesFreteRouter,
  cte: cteRouter,
  logistica: router({
    analisarAssertividade: publicProcedure
      .input(z.object({ tipo: z.string(), pergunta: z.string().optional() }))
      .mutation(async ({ input }) => {
        // Coletar dados do banco para contexto
        const { getDb } = await import("./db");
        const db2 = await getDb();
        const { cotacoesFrete, cotacaoOpcoes, transportadoras: transpTable } = await import("../drizzle/schema");
        const cotacoes = db2 ? await db2.select().from(cotacoesFrete).limit(50) : [];
        const opcoes = db2 ? await db2.select().from(cotacaoOpcoes) : [];
        const transps = db2 ? await db2.select().from(transpTable) : [];

        const totalCotacoes = cotacoes.length;
        const concluidas = cotacoes.filter((c: any) => c.status === "concluido").length;
        const emAndamento = cotacoes.filter((c: any) => c.status === "fila" || c.status === "em_cotacao").length;

        const transpMap: Record<string, number> = {};
        opcoes.filter((o: any) => o.selecionada === "sim").forEach((o: any) => {
          const nome = o.transportadoraNome ?? "Desconhecida";
          transpMap[nome] = (transpMap[nome] ?? 0) + 1;
        });
        const rankingTransp = Object.entries(transpMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nome, total]) => `${nome}: ${total}x`)
          .join(", ");

        const destMap: Record<string, number> = {};
        cotacoes.forEach((c: any) => {
          const dest = `${c.municipio ?? ""}/${c.estado ?? ""}`;
          if (c.municipio) destMap[dest] = (destMap[dest] ?? 0) + 1;
        });
        const topDest = Object.entries(destMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([dest, total]) => `${dest}: ${total}x`)
          .join(", ");

        const contexto = `
Dados do sistema de logística:
- Total de cotações: ${totalCotacoes}
- Concluídas: ${concluidas} (${totalCotacoes > 0 ? Math.round((concluidas / totalCotacoes) * 100) : 0}%)
- Em andamento: ${emAndamento}
- Transportadoras cadastradas: ${transps.length}
- Transportadoras mais selecionadas: ${rankingTransp || "nenhuma ainda"}
- Destinos mais frequentes: ${topDest || "nenhum ainda"}
`;

        let prompt = "";
        if (input.tipo === "desempenho") {
          prompt = `Com base nos dados abaixo, analise o desempenho geral da logística, identifique gargalos e sugira melhorias:\n${contexto}`;
        } else if (input.tipo === "transportadoras") {
          prompt = `Com base nos dados abaixo, faça um comparativo das transportadoras e recomende as melhores para diferentes tipos de envio:\n${contexto}`;
        } else if (input.tipo === "oportunidades") {
          prompt = `Com base nos dados abaixo, identifique oportunidades de redução de custo, melhoria de prazo e otimização de rotas:\n${contexto}`;
        } else {
          prompt = `${input.pergunta}\n\nContexto do sistema:\n${contexto}`;
        }

        const resp = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um especialista em logística e transporte de cargas. Responda em português brasileiro de forma objetiva e prática, com bullet points quando adequado." },
            { role: "user", content: prompt },
          ],
        });
        const analise = resp.choices?.[0]?.message?.content ?? "Não foi possível gerar a análise.";
        return { analise };
      }),
  }),
});
export type AppRouter = typeof appRouter;
// performance router registered above in appRouter

