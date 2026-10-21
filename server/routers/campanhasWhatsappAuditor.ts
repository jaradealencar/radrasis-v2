import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { CAMPANHAS_AUDITOR_CATALOGO } from "@shared/campanhas-auditor-catalogo";
import {
  CAMPANHAS_AUDITOR_MODULES,
  CAMPANHAS_AUDITOR_STATUS,
  executarAutotestesAuditor,
  sanitizarEvidenciaAuditor,
  resumirChecksAuditor,
  validarCatalogoAuditor,
  type AuditorCheck,
  type AuditorRequirementResult,
  type CampanhaAuditorStatus,
} from "@shared/campanhas-auditor";
import { protectedProcedure, requireRole, router } from "../_core/trpc";
import { getDb } from "../db/db";
import { getPool } from "../db/db-connection";
import {
  campanhasAuditorExecucoes,
  campanhasAuditorRequisitos,
} from "../../drizzle/schema";

const adminProcedure = protectedProcedure.use(requireRole("admin", "master"));
const executarSchema = z.discriminatedUnion("escopo", [
  z.object({ escopo: z.literal("completo") }),
  z.object({ escopo: z.literal("modulo"), modulo: z.string().min(1).max(120) }),
]);

type Status = CampanhaAuditorStatus;
type CatalogItem = (typeof CAMPANHAS_AUDITOR_CATALOGO)[number];

function limparObjeto<T>(value: T): T {
  if (typeof value === "string") return sanitizarEvidenciaAuditor(value) as T;
  if (Array.isArray(value)) return value.map(item => limparObjeto(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, limparObjeto(item)])
    ) as T;
  }
  return value;
}

function falhaBancoAuditor(error: unknown, message: string) {
  const safe =
    error instanceof Error
      ? sanitizarEvidenciaAuditor(error.message)
      : "falha sem detalhe disponível";
  console.error("[CampanhasAuditor] falha de persistência:", safe);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
}

function metadadosRuntime() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null;
  return {
    commitSha: sha,
    branch:
      process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || null,
    ambiente:
      process.env.VERCEL_ENV ||
      (process.env.NODE_ENV === "production"
        ? "production"
        : process.env.NODE_ENV || null),
    publishedSha:
      process.env.VERCEL_ENV && process.env.VERCEL_GIT_COMMIT_SHA
        ? process.env.VERCEL_GIT_COMMIT_SHA
        : null,
    origemVersao:
      process.env.VERCEL_ENV && process.env.VERCEL_GIT_COMMIT_SHA
        ? "metadados do runtime Vercel"
        : process.env.GITHUB_SHA
          ? "metadados de CI; não comprovam versão publicada"
          : "não informada pelo runtime",
  };
}

function paraCatalogo(item: CatalogItem) {
  return {
    id: item.id,
    nome: item.name,
    descricao: item.description,
    modulo: item.module,
    criteriosAceite: item.acceptanceCriteria,
    testesAssociados: [...item.associatedTests],
    criticidade: item.criticality,
    statusAtual: item.initialStatus,
    evidencia: item.initialEvidence,
  };
}

async function sincronizarCatalogo(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
) {
  const rows = CAMPANHAS_AUDITOR_CATALOGO.map(paraCatalogo);
  await db
    .insert(campanhasAuditorRequisitos)
    .values(rows)
    .onConflictDoUpdate({
      target: campanhasAuditorRequisitos.id,
      set: {
        nome: sql.raw('excluded."nome"'),
        descricao: sql.raw('excluded."descricao"'),
        modulo: sql.raw('excluded."modulo"'),
        criteriosAceite: sql.raw('excluded."criterios_aceite"'),
        testesAssociados: sql.raw('excluded."testes_associados"'),
        criticidade: sql.raw('excluded."criticidade"'),
      },
    });
}

function check(
  id: string,
  name: string,
  requirementIds: string[],
  passed: boolean,
  expected: string,
  actual: string,
  phase: string,
  severity: AuditorCheck["severity"] = "alta",
  critical = false,
  evidence: Record<string, unknown> = {}
): AuditorCheck {
  return {
    id,
    name,
    requirementIds,
    passed,
    expected,
    actual,
    phase,
    severity,
    critical,
    evidence: limparObjeto(evidence),
    ...(!passed
      ? {
          hypothesis: "A verificação não encontrou a condição esperada.",
          recommendation:
            "Investigar o detalhe técnico e repetir a auditoria após a correção.",
        }
      : {}),
  };
}

function montarResultados(
  itens: (typeof campanhasAuditorRequisitos.$inferSelect)[],
  checks: AuditorCheck[]
): AuditorRequirementResult[] {
  return itens.map(item => {
    if (item.id === "CAMP-068") {
      return {
        requirementId: item.id,
        status: "inconclusivo",
        executed: false,
        testIds: [],
        evidence: {
          origem: "runtime",
          sha:
            process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
          branch:
            process.env.VERCEL_GIT_COMMIT_REF ||
            process.env.GITHUB_REF_NAME ||
            null,
          pushRemoto: "não consultado pelo painel",
        },
        expected:
          "commit e branch remotos confirmados e deployment associado ao mesmo SHA",
        actual:
          "O painel não consulta GitHub nem a plataforma de deploy; metadados locais do runtime não confirmam push remoto.",
        phase: "verificação Git/deploy",
        severity: "alta",
        hypothesis:
          "Integração autorizada de Git/deploy não configurada no runtime.",
        recommendation:
          "Configurar uma fonte autorizada de status Git e deployment antes de aprovar a versão publicada.",
      };
    }
    const vinculados = checks.filter(result =>
      result.requirementIds.includes(item.id)
    );
    const executado = vinculados.length > 0;
    const aprovado = executado && vinculados.every(result => result.passed);
    const status = executado
      ? aprovado
        ? "aprovado_simulacao"
        : "reprovado"
      : CAMPANHAS_AUDITOR_STATUS.includes(item.statusAtual as Status)
        ? (item.statusAtual as Status)
        : "inconclusivo";
    return {
      requirementId: item.id,
      status,
      executed: executado,
      testIds: vinculados.map(result => result.id),
      evidence: limparObjeto(
        executado
          ? {
              checks: vinculados.map(result => result.id),
              results: vinculados.map(result => result.evidence),
            }
          : (item.evidencia ?? {})
      ),
      expected: executado
        ? vinculados.map(result => result.expected).join("; ")
        : item.criteriosAceite,
      actual: executado
        ? vinculados
            .map(
              result =>
                `${result.id}: ${result.passed ? "aprovado" : "reprovado"}`
            )
            .join("; ")
        : `Sem execução nesta auditoria. Estado documentado: ${item.statusAtual}.`,
      phase: executado
        ? vinculados.map(result => result.phase).join(", ")
        : "não executado",
      severity: vinculados.some(result => result.severity === "critica")
        ? "critica"
        : (item.criticidade as AuditorCheck["severity"]),
      ...(!aprovado && executado
        ? {
            hypothesis: vinculados.find(result => !result.passed)?.hypothesis,
            recommendation: vinculados.find(result => !result.passed)
              ?.recommendation,
          }
        : {}),
    };
  });
}

export const campanhasWhatsappAuditorRouter = router({
  catalogo: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "O banco do Auditor não está disponível.",
      });
    try {
      await sincronizarCatalogo(db);
      return await db
        .select()
        .from(campanhasAuditorRequisitos)
        .orderBy(asc(campanhasAuditorRequisitos.id));
    } catch (error) {
      throw falhaBancoAuditor(
        error,
        "Não foi possível carregar o catálogo do Auditor."
      );
    }
  }),

  historico: adminProcedure
    .input(
      z
        .object({ limite: z.number().int().min(1).max(100).default(20) })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "O banco do Auditor não está disponível.",
        });
      try {
        return await db
          .select({
            id: campanhasAuditorExecucoes.id,
            escopo: campanhasAuditorExecucoes.escopo,
            modulo: campanhasAuditorExecucoes.modulo,
            modo: campanhasAuditorExecucoes.modo,
            commitSha: campanhasAuditorExecucoes.commitSha,
            branch: campanhasAuditorExecucoes.branch,
            ambiente: campanhasAuditorExecucoes.ambiente,
            publishedSha: campanhasAuditorExecucoes.publishedSha,
            resumo: campanhasAuditorExecucoes.resumo,
            finalizada: campanhasAuditorExecucoes.finalizada,
            iniciadoEm: campanhasAuditorExecucoes.iniciadoEm,
            concluidoEm: campanhasAuditorExecucoes.concluidoEm,
          })
          .from(campanhasAuditorExecucoes)
          .orderBy(desc(campanhasAuditorExecucoes.iniciadoEm))
          .limit(input?.limite ?? 20);
      } catch (error) {
        throw falhaBancoAuditor(
          error,
          "Não foi possível carregar o histórico do Auditor."
        );
      }
    }),

  detalhe: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "O banco do Auditor não está disponível.",
        });
      try {
        const [report] = await db
          .select()
          .from(campanhasAuditorExecucoes)
          .where(eq(campanhasAuditorExecucoes.id, input.id))
          .limit(1);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Execução de auditoria não encontrada.",
          });
        const entries = report.resultados as Array<Record<string, unknown>>;
        return {
          ...report,
          checks: entries
            .filter(item => item.kind === "check")
            .map(({ kind: _kind, ...item }) => item),
          resultados: entries
            .filter(item => item.kind === "requirement")
            .map(({ kind: _kind, ...item }) => item),
          versao: {
            commitSha: report.commitSha,
            branch: report.branch,
            ambiente: report.ambiente,
            publishedSha: report.publishedSha,
            origemVersao: String(
              (report.resumo as Record<string, unknown>).avisoVersao ??
                "não informada pelo runtime"
            ),
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw falhaBancoAuditor(
          error,
          "Não foi possível abrir os detalhes desta execução."
        );
      }
    }),

  executar: adminProcedure
    .input(executarSchema)
    .mutation(async ({ ctx, input }) => {
      if (
        input.escopo === "modulo" &&
        !CAMPANHAS_AUDITOR_MODULES.includes(input.modulo as never)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Módulo de auditoria inválido.",
        });
      }
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "O banco do Auditor não está disponível; execução não registrada.",
        });

      try {
        await sincronizarCatalogo(db);
        const catalogo = await db
          .select()
          .from(campanhasAuditorRequisitos)
          .orderBy(asc(campanhasAuditorRequisitos.id));
        const checks: AuditorCheck[] = [];
        const validacaoCatalogo = validarCatalogoAuditor();
        const idsPersistidos = new Set(catalogo.map(item => item.id));
        checks.push(
          check(
            "AUD-CATALOG-COMPLETE",
            "Integridade do catálogo",
            ["CAMP-057"],
            validacaoCatalogo.ok &&
              idsPersistidos.size === CAMPANHAS_AUDITOR_CATALOGO.length,
            "84 requisitos sem IDs duplicados ou faltantes, persistidos no banco",
            `${catalogo.length} requisitos persistidos; ${validacaoCatalogo.duplicados.length} duplicados e ${validacaoCatalogo.ausentes.length} ausentes no catálogo-fonte`,
            "catálogo",
            "critica",
            true,
            {
              totalEsperado: CAMPANHAS_AUDITOR_CATALOGO.length,
              totalPersistido: catalogo.length,
              ...validacaoCatalogo,
            }
          )
        );

        const falsosAprovados = CAMPANHAS_AUDITOR_CATALOGO.filter(item =>
          item.initialStatus.startsWith("aprovado_")
        ).map(item => item.id);
        checks.push(
          check(
            "AUD-NO-CODE-ONLY-APPROVAL",
            "Estados sem aprovação baseada em código",
            ["CAMP-069"],
            falsosAprovados.length === 0,
            "nenhum requisito aprovado só pela presença de código",
            falsosAprovados.length
              ? `Aprovações iniciais sem teste: ${falsosAprovados.join(", ")}`
              : "nenhum requisito recebeu aprovação inicial automática",
            "classificação de requisitos",
            "critica",
            true,
            { requisitosAprovadosNaImportacao: falsosAprovados }
          )
        );

        const textoSanitizado = sanitizarEvidenciaAuditor(
          "Bearer abc123 email teste@example.com telefone 67999001234 token=secreto"
        );
        const sanitizacaoOk =
          !/abc123|teste@example\.com|67999001234|secreto/u.test(
            textoSanitizado
          );
        checks.push(
          check(
            "AUD-EVIDENCE-SANITIZATION",
            "Sanitização de evidências",
            ["CAMP-073"],
            sanitizacaoOk,
            "tokens, e-mails e telefones removidos do relatório",
            textoSanitizado,
            "proteção de evidências",
            "alta",
            true,
            {
              fixture: "credenciais e dados pessoais fictícios",
              evidênciaSanitizada: textoSanitizado,
            }
          )
        );

        const autotestes = executarAutotestesAuditor();
        checks.push(...autotestes);
        const runtime = metadadosRuntime();

        const dbProbe = await getPool().query("SELECT 1 AS ok");
        checks.push(
          check(
            "AUD-DATABASE-READINESS",
            "Conectividade de leitura ao banco",
            [],
            dbProbe.rows[0]?.ok === 1,
            "consulta SELECT 1 retorna 1",
            `SELECT 1 ${dbProbe.rows[0]?.ok === 1 ? "retornou 1" : "não retornou 1"}`,
            "banco de auditoria",
            "critica",
            true,
            { consulta: "SELECT 1", leitura: "somente leitura" }
          )
        );
        const tables = await getPool().query(
          "SELECT to_regclass('campanhas_auditor_requisitos') IS NOT NULL AS requisitos, to_regclass('campanhas_auditor_execucoes') IS NOT NULL AS execucoes"
        );
        checks.push(
          check(
            "AUD-DATABASE-SCHEMA",
            "Tabelas do Auditor disponíveis",
            [],
            Boolean(tables.rows[0]?.requisitos && tables.rows[0]?.execucoes),
            "catálogo e histórico existem",
            `catálogo=${Boolean(tables.rows[0]?.requisitos)}; histórico=${Boolean(tables.rows[0]?.execucoes)}`,
            "banco de auditoria",
            "critica",
            true,
            {
              tabelas: {
                catalogo: Boolean(tables.rows[0]?.requisitos),
                historico: Boolean(tables.rows[0]?.execucoes),
              },
            }
          )
        );

        const selecionados =
          input.escopo === "completo"
            ? catalogo
            : catalogo.filter(item => item.modulo === input.modulo);
        const selecionadosIds = new Set(selecionados.map(item => item.id));
        const checksNoEscopo =
          input.escopo === "completo"
            ? checks
            : checks.filter(
                result =>
                  result.requirementIds.some(id => selecionadosIds.has(id)) ||
                  (input.modulo === "Robô Auditor" &&
                    result.requirementIds.length === 0)
              );
        const resultados = montarResultados(selecionados, checksNoEscopo);
        const summary = resumirChecksAuditor(checksNoEscopo);
        const resumo = {
          ...summary,
          requisitosNoEscopo: selecionados.length,
          requisitosAprovadosSimulacao: resultados.filter(
            item => item.status === "aprovado_simulacao"
          ).length,
          requisitosReprovados: resultados.filter(
            item => item.status === "reprovado"
          ).length,
          requisitosNaoImplementados: resultados.filter(
            item => item.status === "nao_implementado"
          ).length,
          requisitosNaoVerificados: resultados.filter(item => !item.executed)
            .length,
          coberturaRequisitos:
            selecionados.length === 0
              ? 0
              : Math.round(
                  (summary.requisitosCobertos / selecionados.length) * 100
                ),
          deployVerificado: false,
          avisoVersao: `${runtime.origemVersao}; push remoto e deploy não consultados por integração externa`,
        };
        const iniciadoEm = new Date();
        const insertRows = await db
          .insert(campanhasAuditorExecucoes)
          .values({
            escopo: input.escopo,
            modulo: input.escopo === "modulo" ? input.modulo : null,
            modo: "manual_seguro",
            usuarioId: ctx.user.id,
            commitSha: runtime.commitSha,
            branch: runtime.branch,
            ambiente: runtime.ambiente,
            publishedSha: runtime.publishedSha,
            resumo: limparObjeto(resumo),
            resultados: limparObjeto([
              ...checksNoEscopo.map(item => ({ kind: "check", ...item })),
              ...resultados.map(item => ({ kind: "requirement", ...item })),
            ]),
            iniciadoEm,
            concluidoEm: new Date(),
          })
          .returning({ id: campanhasAuditorExecucoes.id });
        const id = insertRows[0]?.id;
        if (!id) throw new Error("Audit history did not return an id");
        const persistido = await db
          .select({ id: campanhasAuditorExecucoes.id })
          .from(campanhasAuditorExecucoes)
          .where(eq(campanhasAuditorExecucoes.id, id))
          .limit(1);
        if (persistido[0]?.id !== id)
          throw new Error("Audit history read-after-write failed");

        const persistCheck = check(
          "AUD-HISTORY-PERSISTENCE",
          "Persistência do histórico",
          ["CAMP-071"],
          true,
          "execução pode ser consultada após gravação",
          `execução ${id} lida após gravação`,
          "histórico",
          "alta",
          true,
          { executionId: id, readAfterWrite: true }
        );
        checksNoEscopo.push(persistCheck);
        const resultadosFinais = montarResultados(selecionados, checksNoEscopo);
        const resumoFinalBase = resumirChecksAuditor(checksNoEscopo);
        const resumoFinal = {
          ...resumoFinalBase,
          requisitosNoEscopo: selecionados.length,
          requisitosAprovadosSimulacao: resultadosFinais.filter(
            item => item.status === "aprovado_simulacao"
          ).length,
          requisitosReprovados: resultadosFinais.filter(
            item => item.status === "reprovado"
          ).length,
          requisitosNaoImplementados: resultadosFinais.filter(
            item => item.status === "nao_implementado"
          ).length,
          requisitosNaoVerificados: resultadosFinais.filter(
            item => !item.executed
          ).length,
          coberturaRequisitos:
            selecionados.length === 0
              ? 0
              : Math.round(
                  (resumoFinalBase.requisitosCobertos / selecionados.length) *
                    100
                ),
          deployVerificado: false,
          avisoVersao: `${runtime.origemVersao}; push remoto e deploy não consultados por integração externa`,
        };
        await db
          .update(campanhasAuditorExecucoes)
          .set({
            resumo: limparObjeto(resumoFinal),
            resultados: limparObjeto([
              ...checksNoEscopo.map(item => ({ kind: "check", ...item })),
              ...resultadosFinais.map(item => ({
                kind: "requirement",
                ...item,
              })),
            ]),
            finalizada: true,
            concluidoEm: new Date(),
          })
          .where(eq(campanhasAuditorExecucoes.id, id));

        for (const result of resultadosFinais.filter(
          item => item.executed || item.requirementId === "CAMP-068"
        )) {
          const source = selecionados.find(
            item => item.id === result.requirementId
          )!;
          await db
            .update(campanhasAuditorRequisitos)
            .set({
              statusAtual: result.status,
              evidencia: limparObjeto({
                checks: result.testIds,
                details: result.evidence,
                executionId: id,
              }),
              ultimaVerificacao: new Date(),
              versaoSoftware: runtime.commitSha,
              atualizadoEm: new Date(),
            })
            .where(
              and(
                eq(campanhasAuditorRequisitos.id, source.id),
                eq(campanhasAuditorRequisitos.modulo, source.modulo)
              )
            );
        }

        return {
          id,
          escopo: input.escopo,
          modulo: input.escopo === "modulo" ? input.modulo : null,
          modo: "manual_seguro" as const,
          resumo: resumoFinal,
          checks: limparObjeto(checksNoEscopo),
          resultados: limparObjeto(resultadosFinais),
          versao: runtime,
          iniciadoEm,
          concluidoEm: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof Error
            ? sanitizarEvidenciaAuditor(error.message)
            : "falha técnica sem detalhe disponível";
        console.error("[CampanhasAuditor] execução não concluída:", message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "A auditoria não foi concluída. Consulte o log técnico sanitizado do servidor.",
        });
      }
    }),
});
