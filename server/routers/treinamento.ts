import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  trainingAssessments,
  trainingAttemptAnswers,
  trainingAttempts,
  trainingEnrollments,
  trainingLessons,
  trainingLessonProgress,
  trainingLessonVersions,
  trainingQuestionTypes,
  trainingQuestions,
  trainingSectors,
  trainingSubjects,
  user as userTable,
  type TrainingQuestionConfig,
  type TrainingQuestionType,
} from "../../drizzle/schema";
import { canRoleAccessPage, getDb } from "../db/db";
import { protectedProcedure, requireRole, router } from "../_core/trpc";

const MODE = ["practice", "formal"] as const;
type Mode = (typeof MODE)[number];

const questionOptionSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(2000),
  correct: z.boolean().optional(),
  feedback: z.string().max(4000).optional(),
  score: z.number().min(0).max(100).optional(),
  nextNodeId: z.string().max(80).nullable().optional(),
  criteriaScores: z.record(z.string(), z.number().min(0).max(100)).optional(),
});
const nodeSchema = z.object({
  id: z.string().min(1).max(80),
  clientText: z.string().min(1).max(4000),
  options: z.array(questionOptionSchema).min(2).max(12),
});
const configSchema = z
  .object({
    options: z.array(questionOptionSchema).optional(),
    allowPartialCredit: z.boolean().optional(),
    steps: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          text: z.string().min(1).max(2000),
        })
      )
      .optional(),
    correctOrder: z.array(z.string().min(1).max(80)).optional(),
    nodes: z.array(nodeSchema).optional(),
    explanation: z.string().max(10000).optional(),
    expectedAnswer: z.string().max(4000).optional(),
    finalFeedback: z.string().max(10000).optional(),
  })
  .passthrough();

const questionInputSchema = z.object({
  key: z.string().min(1).max(80),
  type: z.enum(trainingQuestionTypes),
  prompt: z.string().min(1).max(10000),
  config: configSchema,
  points: z.number().int().min(1).max(100).default(1),
  position: z.number().int().min(0).max(10000).default(0),
});
type QuestionInput = z.infer<typeof questionInputSchema>;

type SnapshotQuestion = QuestionInput;
type AssessmentSnapshot = {
  title: string;
  version: number;
  subjectId: number;
  questions: SnapshotQuestion[];
};

function getDatabase() {
  return getDb().then(db => {
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Banco indisponível",
      });
    return db;
  });
}

async function requireEnrollment(
  db: Awaited<ReturnType<typeof getDatabase>>,
  userId: string,
  subjectId: number
) {
  const [enrollment] = await db
    .select({ id: trainingEnrollments.id })
    .from(trainingEnrollments)
    .where(
      and(
        eq(trainingEnrollments.userId, userId),
        eq(trainingEnrollments.subjectId, subjectId)
      )
    )
    .limit(1);
  if (!enrollment)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Matricule-se nesta matéria antes de acessar as provas.",
    });
}

const trainingProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await canRoleAccessPage(ctx.user.role, "treinamento"))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não tem acesso à Escola Corporativa.",
    });
  }
  return next({ ctx });
});
const trainingEditorProcedure = trainingProcedure.use(
  requireRole("admin", "master", "gestor")
);

function publicQuestion(
  question: SnapshotQuestion,
  negotiationNodeId?: string
) {
  const config = question.config;
  if (question.type === "negotiation") {
    const nodes = config.nodes ?? [];
    const node = nodes.find(
      item => item.id === (negotiationNodeId ?? nodes[0]?.id)
    );
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      config: node
        ? {
            nodeId: node.id,
            clientText: node.clientText,
            options: node.options.map(({ id, text }) => ({ id, text })),
          }
        : null,
    };
  }
  if (question.type === "ordering") {
    const steps = [...(config.steps ?? [])];
    for (let i = steps.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [steps[i], steps[j]] = [steps[j], steps[i]];
    }
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      config: { steps },
    };
  }
  return {
    key: question.key,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    config: {
      options: config.options?.map(({ id, text }) => ({ id, text })),
      allowPartialCredit: config.allowPartialCredit ?? false,
    },
  };
}

function validateQuestion(question: QuestionInput) {
  const config = question.config;
  if (
    ["multiple_choice", "multiple_select", "best_response"].includes(
      question.type
    )
  ) {
    const options = config.options ?? [];
    if (
      options.length < 2 ||
      options.filter(option => option.correct).length < 1
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A questão ${question.key} precisa de alternativas e ao menos uma resposta correta.`,
      });
    }
    if (new Set(options.map(option => option.id)).size !== options.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A questão ${question.key} tem IDs de alternativa repetidos.`,
      });
    }
    if (
      question.type !== "multiple_select" &&
      options.filter(option => option.correct).length !== 1
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A questão ${question.key} deve ter uma única resposta correta.`,
      });
    }
  }
  if (question.type === "ordering") {
    const ids = (config.steps ?? []).map(step => step.id);
    if (
      ids.length < 2 ||
      new Set(ids).size !== ids.length ||
      ids.length !== (config.correctOrder ?? []).length ||
      new Set(config.correctOrder ?? []).size !== ids.length ||
      ids.some(id => !config.correctOrder?.includes(id))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A questão ${question.key} precisa de etapas e ordem correta com os mesmos itens.`,
      });
    }
  }
  if (question.type === "negotiation") {
    const nodes = config.nodes ?? [];
    if (!nodes.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A simulação ${question.key} precisa de nós de conversa.`,
      });
    }
    const ids = new Set(nodes.map(node => node.id));
    if (
      ids.size !== nodes.length ||
      nodes.some(
        node =>
          new Set(node.options.map(option => option.id)).size !==
            node.options.length ||
          node.options.some(
            option => option.nextNodeId && !ids.has(option.nextNodeId)
          )
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A simulação ${question.key} tem caminhos inválidos.`,
      });
    }
    const byId = new Map(nodes.map(node => [node.id, node]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A simulação ${question.key} não pode conter ciclos.`,
        });
      if (visited.has(id)) return;
      visiting.add(id);
      for (const option of byId.get(id)?.options ?? [])
        if (option.nextNodeId) visit(option.nextNodeId);
      visiting.delete(id);
      visited.add(id);
    };
    visit(nodes[0].id);
    if (visited.size !== nodes.length)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Todos os caminhos da simulação ${question.key} devem ser alcançáveis.`,
      });
  }
}

function evaluateQuestion(question: SnapshotQuestion, response: unknown) {
  const config = question.config;
  const selected = Array.isArray(response)
    ? response.map(String)
    : [String(response ?? "")];
  let fraction = 0;
  let expectedAnswer = "";
  let details: string[] = [];
  if (
    question.type === "multiple_choice" ||
    question.type === "best_response"
  ) {
    const correct = config.options?.find(option => option.correct);
    fraction = selected[0] === correct?.id ? 1 : 0;
    expectedAnswer = correct?.text ?? "";
    details = (config.options ?? []).map(
      option =>
        `${option.correct ? "Resposta esperada" : "Alternativa menos adequada"}: ${option.text}${option.feedback ? ` — ${option.feedback}` : ""}`
    );
  } else if (question.type === "multiple_select") {
    const options = config.options ?? [];
    const correct = options.filter(option => option.correct);
    const correctChosen = selected.filter(id =>
      correct.some(option => option.id === id)
    ).length;
    const incorrectChosen = selected.filter(
      id => !correct.some(option => option.id === id)
    ).length;
    fraction = config.allowPartialCredit
      ? Math.max(
          0,
          Math.min(
            1,
            (correctChosen - incorrectChosen) / Math.max(1, correct.length)
          )
        )
      : correctChosen === correct.length && incorrectChosen === 0
        ? 1
        : 0;
    expectedAnswer = correct.map(option => option.text).join("; ");
    details = options.map(
      option =>
        `${option.correct ? "Correta" : "Não é a escolha esperada"}: ${option.text}${option.feedback ? ` — ${option.feedback}` : ""}`
    );
  } else if (question.type === "ordering") {
    const correct = config.correctOrder ?? [];
    fraction =
      selected.length === correct.length &&
      selected.every((id, i) => id === correct[i])
        ? 1
        : 0;
    const byId = new Map(
      (config.steps ?? []).map(step => [step.id, step.text])
    );
    expectedAnswer = correct.map(id => byId.get(id) ?? id).join(" → ");
    details = [
      "Compare a sequência com a ordem de atendimento apresentada no módulo do WhatsApp.",
    ];
  }
  return {
    isCorrect: fraction === 1,
    fraction,
    pointsAwarded: question.points * fraction,
    expectedAnswer,
    explanation:
      config.explanation ??
      "Revise o conteúdo da aula e conecte a decisão ao que o cliente informou.",
    details,
  };
}

function getQuestion(snapshot: AssessmentSnapshot, questionKey: string) {
  const question = snapshot.questions.find(item => item.key === questionKey);
  if (!question)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Questão não encontrada nesta versão.",
    });
  return question;
}

function getNegotiationOption(
  question: SnapshotQuestion,
  nodeId: string,
  optionId: string
) {
  const node = question.config.nodes?.find(item => item.id === nodeId);
  if (!node)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Etapa da simulação inválida.",
    });
  const option = node.options.find(item => item.id === optionId);
  if (!option)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Resposta da simulação inválida.",
    });
  return { node, option };
}

function questionFeedback(
  question: SnapshotQuestion,
  answers: Array<typeof trainingAttemptAnswers.$inferSelect>
) {
  if (question.type === "negotiation") {
    const steps = answers.map(answer => {
      const response = answer.response as {
        nodeId?: string;
        optionId?: string;
      };
      const { node, option } = getNegotiationOption(
        question,
        response.nodeId ?? "",
        response.optionId ?? ""
      );
      return {
        prompt: node.clientText,
        selected: option.text,
        feedback: option.feedback ?? "",
        criteriaScores: option.criteriaScores ?? {},
      };
    });
    const sums: Record<string, number[]> = {};
    for (const step of steps)
      for (const [name, score] of Object.entries(step.criteriaScores))
        (sums[name] ??= []).push(score);
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      selected: steps,
      expectedAnswer:
        question.config.finalFeedback ??
        "A condução é avaliada pelos critérios configurados para o cenário.",
      explanation: question.config.explanation ?? "",
      criteria: Object.fromEntries(
        Object.entries(sums).map(([name, scores]) => [
          name,
          Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        ])
      ),
    };
  }
  const last = answers[answers.length - 1];
  const response = last?.response;
  const result = evaluateQuestion(question, response);
  let selected: string | string[] = "";
  if (question.type === "ordering") {
    const textById = new Map(
      (question.config.steps ?? []).map(step => [step.id, step.text])
    );
    selected = Array.isArray(response)
      ? response.map(id => textById.get(String(id)) ?? String(id))
      : [];
  } else {
    const textById = new Map(
      (question.config.options ?? []).map(option => [option.id, option.text])
    );
    selected = Array.isArray(response)
      ? response.map(id => textById.get(String(id)) ?? String(id))
      : (textById.get(String(response ?? "")) ?? "");
  }
  return {
    key: question.key,
    type: question.type,
    prompt: question.prompt,
    selected,
    expectedAnswer: result.expectedAnswer,
    explanation: result.explanation,
    details: result.details,
  };
}

export const treinamentoRouter = router({
  catalog: trainingProcedure.query(async () => {
    const db = await getDatabase();
    const [sectors, subjects] = await Promise.all([
      db
        .select()
        .from(trainingSectors)
        .where(
          and(
            eq(trainingSectors.isPublished, true),
            isNull(trainingSectors.archivedAt)
          )
        )
        .orderBy(asc(trainingSectors.position), asc(trainingSectors.name)),
      db
        .select()
        .from(trainingSubjects)
        .where(
          and(
            eq(trainingSubjects.isPublished, true),
            isNull(trainingSubjects.archivedAt)
          )
        )
        .orderBy(asc(trainingSubjects.position), asc(trainingSubjects.title)),
    ]);
    const allowed = new Set(sectors.map(sector => sector.id));
    return sectors.map(sector => ({
      ...sector,
      subjects: subjects.filter(
        subject =>
          subject.sectorId === sector.id && allowed.has(subject.sectorId)
      ),
    }));
  }),

  subject: trainingProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [subject] = await db
        .select()
        .from(trainingSubjects)
        .where(
          and(
            eq(trainingSubjects.id, input.id),
            eq(trainingSubjects.isPublished, true),
            isNull(trainingSubjects.archivedAt)
          )
        )
        .limit(1);
      if (!subject)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Matéria não encontrada.",
        });
      const [sector] = await db
        .select()
        .from(trainingSectors)
        .where(
          and(
            eq(trainingSectors.id, subject.sectorId),
            eq(trainingSectors.isPublished, true),
            isNull(trainingSectors.archivedAt)
          )
        )
        .limit(1);
      if (!sector)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Setor não encontrado.",
        });
      const [lessons, assessments, enrollment] = await Promise.all([
        db
          .select()
          .from(trainingLessons)
          .where(
            and(
              eq(trainingLessons.subjectId, subject.id),
              eq(trainingLessons.isPublished, true),
              isNull(trainingLessons.archivedAt)
            )
          )
          .orderBy(asc(trainingLessons.position)),
        db
          .select({
            id: trainingAssessments.id,
            title: trainingAssessments.title,
            description: trainingAssessments.description,
            allowPractice: trainingAssessments.allowPractice,
            allowFormal: trainingAssessments.allowFormal,
            version: trainingAssessments.version,
            position: trainingAssessments.position,
          })
          .from(trainingAssessments)
          .where(
            and(
              eq(trainingAssessments.subjectId, subject.id),
              eq(trainingAssessments.isPublished, true),
              isNull(trainingAssessments.archivedAt)
            )
          )
          .orderBy(asc(trainingAssessments.position)),
        db
          .select({ enrolledAt: trainingEnrollments.enrolledAt })
          .from(trainingEnrollments)
          .where(
            and(
              eq(trainingEnrollments.userId, ctx.user.id),
              eq(trainingEnrollments.subjectId, subject.id)
            )
          )
          .limit(1),
      ]);
      return {
        ...subject,
        sector,
        lessons,
        assessments,
        isEnrolled: Boolean(enrollment[0]),
        enrolledAt: enrollment[0]?.enrolledAt ?? null,
      };
    }),

  enrollSubject: trainingProcedure
    .input(z.object({ subjectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [subject] = await db
        .select({ id: trainingSubjects.id })
        .from(trainingSubjects)
        .innerJoin(
          trainingSectors,
          eq(trainingSubjects.sectorId, trainingSectors.id)
        )
        .where(
          and(
            eq(trainingSubjects.id, input.subjectId),
            eq(trainingSubjects.isPublished, true),
            isNull(trainingSubjects.archivedAt),
            eq(trainingSectors.isPublished, true),
            isNull(trainingSectors.archivedAt)
          )
        )
        .limit(1);
      if (!subject)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Matéria indisponível para matrícula.",
        });

      await db
        .insert(trainingEnrollments)
        .values({ userId: ctx.user.id, subjectId: subject.id })
        .onConflictDoNothing({
          target: [trainingEnrollments.userId, trainingEnrollments.subjectId],
        });
      return { ok: true };
    }),

  markLessonComplete: trainingProcedure
    .input(z.object({ lessonId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [lesson] = await db
        .select({
          id: trainingLessons.id,
          subjectId: trainingLessons.subjectId,
          version: trainingLessons.version,
        })
        .from(trainingLessons)
        .innerJoin(
          trainingSubjects,
          eq(trainingLessons.subjectId, trainingSubjects.id)
        )
        .innerJoin(
          trainingSectors,
          eq(trainingSubjects.sectorId, trainingSectors.id)
        )
        .where(
          and(
            eq(trainingLessons.id, input.lessonId),
            eq(trainingLessons.isPublished, true),
            isNull(trainingLessons.archivedAt),
            eq(trainingSubjects.isPublished, true),
            isNull(trainingSubjects.archivedAt),
            eq(trainingSectors.isPublished, true),
            isNull(trainingSectors.archivedAt)
          )
        )
        .limit(1);
      if (!lesson)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aula não encontrada.",
        });
      await db
        .insert(trainingLessonProgress)
        .values({
          userId: ctx.user.id,
          lessonId: lesson.id,
          lessonVersion: lesson.version,
        })
        .onConflictDoUpdate({
          target: [
            trainingLessonProgress.userId,
            trainingLessonProgress.lessonId,
          ],
          set: { lessonVersion: lesson.version, completedAt: new Date() },
        });
      return { ok: true };
    }),

  myProgress: trainingProcedure.query(async ({ ctx }) => {
    const db = await getDatabase();
    const [sectors, subjects, lessons, assessments, attempts, completions] =
      await Promise.all([
        db
          .select({ id: trainingSectors.id })
          .from(trainingSectors)
          .where(
            and(
              eq(trainingSectors.isPublished, true),
              isNull(trainingSectors.archivedAt)
            )
          ),
        db
          .select()
          .from(trainingSubjects)
          .where(
            and(
              eq(trainingSubjects.isPublished, true),
              isNull(trainingSubjects.archivedAt)
            )
          ),
        db
          .select({
            id: trainingLessons.id,
            subjectId: trainingLessons.subjectId,
            version: trainingLessons.version,
          })
          .from(trainingLessons)
          .where(
            and(
              eq(trainingLessons.isPublished, true),
              isNull(trainingLessons.archivedAt)
            )
          ),
        db
          .select({
            id: trainingAssessments.id,
            subjectId: trainingAssessments.subjectId,
            version: trainingAssessments.version,
          })
          .from(trainingAssessments)
          .where(
            and(
              eq(trainingAssessments.isPublished, true),
              isNull(trainingAssessments.archivedAt)
            )
          ),
        db
          .select()
          .from(trainingAttempts)
          .where(eq(trainingAttempts.userId, ctx.user.id))
          .orderBy(desc(trainingAttempts.startedAt)),
        db
          .select({
            lessonId: trainingLessonProgress.lessonId,
            lessonVersion: trainingLessonProgress.lessonVersion,
          })
          .from(trainingLessonProgress)
          .where(eq(trainingLessonProgress.userId, ctx.user.id)),
      ]);
    const doneLessons = new Map(
      completions.map(row => [row.lessonId, row.lessonVersion])
    );
    const visibleSectors = new Set(sectors.map(sector => sector.id));
    return subjects
      .filter(subject => visibleSectors.has(subject.sectorId))
      .map(subject => {
        const subjectLessons = lessons.filter(
          lesson => lesson.subjectId === subject.id
        );
        const subjectAssessments = assessments.filter(
          assessment => assessment.subjectId === subject.id
        );
        const subjectAttempts = attempts.filter(attempt =>
          subjectAssessments.some(
            assessment => assessment.id === attempt.assessmentId
          )
        );
        const completedAssessments = new Set(
          subjectAttempts
            .filter(
              attempt =>
                attempt.status === "completed" &&
                subjectAssessments.some(
                  assessment =>
                    assessment.id === attempt.assessmentId &&
                    assessment.version === attempt.assessmentVersion
                )
            )
            .map(attempt => attempt.assessmentId)
        );
        const completedLessons = subjectLessons.filter(
          lesson => doneLessons.get(lesson.id) === lesson.version
        ).length;
        const totalParts = subjectLessons.length + subjectAssessments.length;
        const completeParts = completedLessons + completedAssessments.size;
        const scored = subjectAttempts.filter(
          attempt => attempt.status === "completed" && attempt.score != null
        );
        return {
          subjectId: subject.id,
          completedLessons,
          totalLessons: subjectLessons.length,
          completedLessonIds: subjectLessons
            .filter(lesson => doneLessons.get(lesson.id) === lesson.version)
            .map(lesson => lesson.id),
          completedAssessments: completedAssessments.size,
          totalAssessments: subjectAssessments.length,
          progressPercent: totalParts
            ? Math.round((completeParts / totalParts) * 100)
            : 0,
          attemptCount: subjectAttempts.filter(
            attempt => attempt.status === "completed"
          ).length,
          lastScore: scored[0]?.score == null ? null : Number(scored[0].score),
          bestScore: scored.length
            ? Math.max(...scored.map(attempt => Number(attempt.score)))
            : null,
        };
      });
  }),

  history: trainingProcedure
    .input(z.object({ subjectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      return db
        .select({
          id: trainingAttempts.id,
          assessmentId: trainingAttempts.assessmentId,
          assessmentTitle: trainingAssessments.title,
          mode: trainingAttempts.mode,
          status: trainingAttempts.status,
          score: trainingAttempts.score,
          assessmentVersion: trainingAttempts.assessmentVersion,
          startedAt: trainingAttempts.startedAt,
          completedAt: trainingAttempts.completedAt,
        })
        .from(trainingAttempts)
        .innerJoin(
          trainingAssessments,
          eq(trainingAttempts.assessmentId, trainingAssessments.id)
        )
        .where(
          and(
            eq(trainingAttempts.userId, ctx.user.id),
            eq(trainingAssessments.subjectId, input.subjectId)
          )
        )
        .orderBy(desc(trainingAttempts.startedAt));
    }),

  reviewAttempt: trainingProcedure
    .input(z.object({ attemptId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const canReviewOthers = ["admin", "master", "gestor"].includes(
        ctx.user.role
      );
      const [attempt] = await db
        .select()
        .from(trainingAttempts)
        .where(
          canReviewOthers
            ? eq(trainingAttempts.id, input.attemptId)
            : and(
                eq(trainingAttempts.id, input.attemptId),
                eq(trainingAttempts.userId, ctx.user.id)
              )
        )
        .limit(1);
      if (!attempt)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tentativa não encontrada.",
        });
      if (attempt.userId === ctx.user.id) {
        const [assessment] = await db
          .select({ subjectId: trainingAssessments.subjectId })
          .from(trainingAssessments)
          .where(eq(trainingAssessments.id, attempt.assessmentId))
          .limit(1);
        if (!assessment)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Avaliação não encontrada.",
          });
        await requireEnrollment(db, ctx.user.id, assessment.subjectId);
      }
      if (attempt.status !== "completed")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "O feedback fica disponível após concluir a tentativa.",
        });
      const snapshot = attempt.snapshot as unknown as AssessmentSnapshot;
      const answers = await db
        .select()
        .from(trainingAttemptAnswers)
        .where(eq(trainingAttemptAnswers.attemptId, attempt.id))
        .orderBy(
          asc(trainingAttemptAnswers.createdAt),
          asc(trainingAttemptAnswers.id)
        );
      const grouped = new Map<string, typeof answers>();
      for (const answer of answers)
        grouped.set(answer.questionKey, [
          ...(grouped.get(answer.questionKey) ?? []),
          answer,
        ]);
      return {
        attemptId: attempt.id,
        title: snapshot.title,
        mode: attempt.mode,
        version: attempt.assessmentVersion,
        score: Number(attempt.score ?? 0),
        scoreMeaning:
          "A nota representa o desempenho nesta tentativa, e não uma medida definitiva da capacidade profissional.",
        feedback: snapshot.questions.map(question =>
          questionFeedback(question, grouped.get(question.key) ?? [])
        ),
      };
    }),

  startAttempt: trainingProcedure
    .input(
      z.object({
        assessmentId: z.number().int().positive(),
        mode: z.enum(MODE),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [assessment] = await db
        .select()
        .from(trainingAssessments)
        .where(
          and(
            eq(trainingAssessments.id, input.assessmentId),
            eq(trainingAssessments.isPublished, true),
            isNull(trainingAssessments.archivedAt)
          )
        )
        .limit(1);
      if (
        !assessment ||
        (input.mode === "practice" && !assessment.allowPractice) ||
        (input.mode === "formal" && !assessment.allowFormal)
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Avaliação indisponível neste modo.",
        });
      }
      const [subject] = await db
        .select()
        .from(trainingSubjects)
        .where(
          and(
            eq(trainingSubjects.id, assessment.subjectId),
            eq(trainingSubjects.isPublished, true),
            isNull(trainingSubjects.archivedAt)
          )
        )
        .limit(1);
      if (!subject)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Matéria indisponível.",
        });
      await requireEnrollment(db, ctx.user.id, subject.id);
      const [sector] = await db
        .select({ id: trainingSectors.id })
        .from(trainingSectors)
        .where(
          and(
            eq(trainingSectors.id, subject.sectorId),
            eq(trainingSectors.isPublished, true),
            isNull(trainingSectors.archivedAt)
          )
        )
        .limit(1);
      if (!sector)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Setor indisponível.",
        });
      const questions = await db
        .select()
        .from(trainingQuestions)
        .where(eq(trainingQuestions.assessmentId, assessment.id))
        .orderBy(asc(trainingQuestions.position), asc(trainingQuestions.id));
      if (!questions.length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Esta avaliação ainda não tem questões.",
        });
      const snapshot: AssessmentSnapshot = {
        title: assessment.title,
        version: assessment.version,
        subjectId: subject.id,
        questions: questions.map(question => ({
          key: question.questionKey,
          type: question.type,
          prompt: question.prompt,
          config: question.config,
          points: question.points,
          position: question.position,
        })),
      };
      const [attempt] = await db
        .insert(trainingAttempts)
        .values({
          userId: ctx.user.id,
          assessmentId: assessment.id,
          mode: input.mode,
          assessmentVersion: assessment.version,
          snapshot,
        })
        .returning({ id: trainingAttempts.id });
      return {
        assessmentId: assessment.id,
        attemptId: attempt.id,
        mode: input.mode,
        title: assessment.title,
        version: assessment.version,
        questions: snapshot.questions.map(question => publicQuestion(question)),
      };
    }),

  submitAnswer: trainingProcedure
    .input(
      z.object({
        attemptId: z.number().int().positive(),
        questionKey: z.string().min(1).max(80),
        response: z.union([
          z.string(),
          z.array(z.string()),
          z.object({ nodeId: z.string(), optionId: z.string() }),
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [attempt] = await db
        .select()
        .from(trainingAttempts)
        .where(
          and(
            eq(trainingAttempts.id, input.attemptId),
            eq(trainingAttempts.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!attempt || attempt.status !== "in_progress")
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tentativa indisponível.",
        });
      const snapshot = attempt.snapshot as unknown as AssessmentSnapshot;
      await requireEnrollment(db, ctx.user.id, snapshot.subjectId);
      const question = getQuestion(snapshot, input.questionKey);
      const isPractice = attempt.mode === "practice";
      const existing = await db
        .select()
        .from(trainingAttemptAnswers)
        .where(
          and(
            eq(trainingAttemptAnswers.attemptId, attempt.id),
            eq(trainingAttemptAnswers.questionKey, question.key)
          )
        )
        .orderBy(
          asc(trainingAttemptAnswers.createdAt),
          asc(trainingAttemptAnswers.id)
        );
      if (question.type !== "negotiation" && !isPractice && existing.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta resposta formal já foi registrada.",
        });
      }

      if (question.type === "negotiation") {
        if (typeof input.response === "string" || Array.isArray(input.response))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Escolha uma alternativa da simulação.",
          });
        if (existing.some(answer => answer.isTerminal))
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este cenário já foi concluído.",
          });
        const expectedNodeId = existing.length
          ? getNegotiationOption(
              question,
              String(
                (existing[existing.length - 1].response as { nodeId: string })
                  .nodeId
              ),
              String(
                (existing[existing.length - 1].response as { optionId: string })
                  .optionId
              )
            ).option.nextNodeId
          : question.config.nodes?.[0]?.id;
        if (!expectedNodeId || input.response.nodeId !== expectedNodeId)
          throw new TRPCError({
            code: "CONFLICT",
            message: "A conversa avançou. Reabra a etapa atual da simulação.",
          });
        const { node, option } = getNegotiationOption(
          question,
          input.response.nodeId,
          input.response.optionId
        );
        const isTerminal = !option.nextNodeId;
        const ratio = (option.score ?? (option.correct ? 100 : 0)) / 100;
        await db.insert(trainingAttemptAnswers).values({
          attemptId: attempt.id,
          questionKey: question.key,
          stepKey: node.id,
          response: input.response,
          pointsAwarded: String(ratio),
          isCorrect: ratio === 1,
          isTerminal,
        });
        return {
          questionComplete: isTerminal,
          nextQuestion: option.nextNodeId
            ? publicQuestion(question, option.nextNodeId)
            : null,
          feedback: isPractice
            ? {
                isCorrect: ratio === 1,
                selectedText: option.text,
                explanation: option.feedback ?? "",
                expectedAnswer:
                  node.options.find(
                    item => (item.score ?? (item.correct ? 100 : 0)) === 100
                  )?.text ?? "",
                criteria: option.criteriaScores ?? {},
              }
            : null,
        };
      }

      const grade = evaluateQuestion(question, input.response);
      await db.insert(trainingAttemptAnswers).values({
        attemptId: attempt.id,
        questionKey: question.key,
        response: input.response,
        pointsAwarded: String(grade.pointsAwarded),
        isCorrect: grade.isCorrect,
      });
      return {
        questionComplete: true,
        nextQuestion: null,
        feedback: isPractice
          ? {
              isCorrect: grade.isCorrect,
              expectedAnswer: grade.expectedAnswer,
              explanation: grade.explanation,
              details: grade.details,
              scorePercent: Math.round(grade.fraction * 100),
            }
          : null,
      };
    }),

  completeAttempt: trainingProcedure
    .input(z.object({ attemptId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [attempt] = await db
        .select()
        .from(trainingAttempts)
        .where(
          and(
            eq(trainingAttempts.id, input.attemptId),
            eq(trainingAttempts.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!attempt)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tentativa não encontrada.",
        });
      if (attempt.status === "completed")
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta tentativa já foi concluída.",
        });
      const snapshot = attempt.snapshot as unknown as AssessmentSnapshot;
      await requireEnrollment(db, ctx.user.id, snapshot.subjectId);
      const answers = await db
        .select()
        .from(trainingAttemptAnswers)
        .where(eq(trainingAttemptAnswers.attemptId, attempt.id))
        .orderBy(
          asc(trainingAttemptAnswers.createdAt),
          asc(trainingAttemptAnswers.id)
        );
      const grouped = new Map<string, typeof answers>();
      for (const answer of answers)
        grouped.set(answer.questionKey, [
          ...(grouped.get(answer.questionKey) ?? []),
          answer,
        ]);
      const missing = snapshot.questions.filter(question => {
        const questionAnswers = grouped.get(question.key) ?? [];
        return question.type === "negotiation"
          ? !questionAnswers.some(answer => answer.isTerminal)
          : !questionAnswers.length;
      });
      if (missing.length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Responda todas as questões antes de concluir.",
        });
      let pointsEarned = 0;
      let pointsPossible = 0;
      for (const question of snapshot.questions) {
        const questionAnswers = grouped.get(question.key) ?? [];
        pointsPossible += question.points;
        if (question.type === "negotiation") {
          const ratios = questionAnswers.map(answer =>
            Number(answer.pointsAwarded)
          );
          pointsEarned +=
            question.points *
            (ratios.length
              ? ratios.reduce((a, b) => a + b, 0) / ratios.length
              : 0);
        } else {
          pointsEarned +=
            attempt.mode === "practice"
              ? Math.max(
                  0,
                  ...questionAnswers.map(answer => Number(answer.pointsAwarded))
                )
              : Number(questionAnswers[0]?.pointsAwarded ?? 0);
        }
      }
      const score = pointsPossible
        ? Math.round((pointsEarned / pointsPossible) * 10000) / 100
        : 0;
      await db
        .update(trainingAttempts)
        .set({
          status: "completed",
          score: String(score),
          pointsEarned: String(pointsEarned),
          pointsPossible: String(pointsPossible),
          completedAt: new Date(),
        })
        .where(eq(trainingAttempts.id, attempt.id));
      return {
        attemptId: attempt.id,
        title: snapshot.title,
        mode: attempt.mode,
        version: attempt.assessmentVersion,
        score,
        pointsEarned: Math.round(pointsEarned * 100) / 100,
        pointsPossible,
        feedback: snapshot.questions.map(question =>
          questionFeedback(question, grouped.get(question.key) ?? [])
        ),
        scoreMeaning:
          "A nota representa o desempenho nesta tentativa, e não uma medida definitiva da capacidade profissional.",
      };
    }),

  adminCatalog: trainingEditorProcedure.query(async () => {
    const db = await getDatabase();
    const [sectors, subjects, lessons, assessments, questions] =
      await Promise.all([
        db
          .select()
          .from(trainingSectors)
          .orderBy(asc(trainingSectors.position), asc(trainingSectors.name)),
        db
          .select()
          .from(trainingSubjects)
          .orderBy(asc(trainingSubjects.position), asc(trainingSubjects.title)),
        db
          .select()
          .from(trainingLessons)
          .orderBy(asc(trainingLessons.position), asc(trainingLessons.title)),
        db
          .select()
          .from(trainingAssessments)
          .orderBy(
            asc(trainingAssessments.position),
            asc(trainingAssessments.title)
          ),
        db
          .select()
          .from(trainingQuestions)
          .orderBy(asc(trainingQuestions.position), asc(trainingQuestions.id)),
      ]);
    return { sectors, subjects, lessons, assessments, questions };
  }),

  saveSector: trainingEditorProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(1).max(128),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(160),
        description: z.string().max(4000).default(""),
        position: z.number().int().min(0).max(10000).default(0),
        isPublished: z.boolean().default(false),
        archived: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const values = {
        name: input.name,
        slug: input.slug,
        description: input.description,
        position: input.position,
        isPublished: input.isPublished && !input.archived,
        archivedAt: input.archived ? new Date() : null,
        updatedAt: new Date(),
      };
      if (input.id)
        await db
          .update(trainingSectors)
          .set(values)
          .where(eq(trainingSectors.id, input.id));
      else await db.insert(trainingSectors).values(values);
      return { ok: true };
    }),

  saveSubject: trainingEditorProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        sectorId: z.number().int().positive(),
        title: z.string().min(1).max(180),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(200),
        description: z.string().max(8000).default(""),
        sourceReference: z.string().max(256).optional(),
        position: z.number().int().min(0).max(10000).default(0),
        isPublished: z.boolean().default(false),
        archived: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const values = {
        sectorId: input.sectorId,
        title: input.title,
        slug: input.slug,
        description: input.description,
        sourceReference: input.sourceReference || null,
        position: input.position,
        isPublished: input.isPublished && !input.archived,
        archivedAt: input.archived ? new Date() : null,
        updatedAt: new Date(),
      };
      if (input.id) {
        const [existing] = await db
          .select({ version: trainingSubjects.version })
          .from(trainingSubjects)
          .where(eq(trainingSubjects.id, input.id))
          .limit(1);
        await db
          .update(trainingSubjects)
          .set({ ...values, version: (existing?.version ?? 0) + 1 })
          .where(eq(trainingSubjects.id, input.id));
      } else await db.insert(trainingSubjects).values(values);
      return { ok: true };
    }),

  saveLesson: trainingEditorProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        subjectId: z.number().int().positive(),
        title: z.string().min(1).max(180),
        summary: z.string().max(4000).default(""),
        content: z.string().min(1).max(40000),
        position: z.number().int().min(0).max(10000).default(0),
        isPublished: z.boolean().default(false),
        archived: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const baseValues = {
        subjectId: input.subjectId,
        title: input.title,
        summary: input.summary,
        content: input.content,
        position: input.position,
        isPublished: input.isPublished && !input.archived,
        archivedAt: input.archived ? new Date() : null,
        updatedAt: new Date(),
      };
      await db.transaction(async tx => {
        let lessonId = input.id;
        let version = 1;
        if (lessonId) {
          const [existing] = await tx
            .select({ version: trainingLessons.version })
            .from(trainingLessons)
            .where(eq(trainingLessons.id, lessonId))
            .limit(1);
          if (!existing)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Aula não encontrada.",
            });
          version = existing.version + 1;
          await tx
            .update(trainingLessons)
            .set({ ...baseValues, version })
            .where(eq(trainingLessons.id, lessonId));
        } else {
          const [created] = await tx
            .insert(trainingLessons)
            .values({ ...baseValues, version })
            .returning({ id: trainingLessons.id });
          lessonId = created.id;
        }
        await tx.insert(trainingLessonVersions).values({
          lessonId: lessonId!,
          version,
          title: input.title,
          summary: input.summary,
          content: input.content,
          createdBy: ctx.user.id,
        });
      });
      return { ok: true };
    }),

  lessonVersions: trainingEditorProcedure
    .input(z.object({ lessonId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select({
          version: trainingLessonVersions.version,
          title: trainingLessonVersions.title,
          summary: trainingLessonVersions.summary,
          content: trainingLessonVersions.content,
          createdAt: trainingLessonVersions.createdAt,
          author: userTable.name,
        })
        .from(trainingLessonVersions)
        .leftJoin(userTable, eq(trainingLessonVersions.createdBy, userTable.id))
        .where(eq(trainingLessonVersions.lessonId, input.lessonId))
        .orderBy(desc(trainingLessonVersions.version));
    }),

  saveAssessment: trainingEditorProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        subjectId: z.number().int().positive(),
        title: z.string().min(1).max(180),
        description: z.string().max(8000).default(""),
        allowPractice: z.boolean().default(true),
        allowFormal: z.boolean().default(true),
        position: z.number().int().min(0).max(10000).default(0),
        isPublished: z.boolean().default(false),
        archived: z.boolean().default(false),
        questions: z.array(questionInputSchema).max(100),
      })
    )
    .mutation(async ({ input }) => {
      if (!input.allowPractice && !input.allowFormal)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Habilite pelo menos um modo de avaliação.",
        });
      const keys = new Set<string>();
      for (const question of input.questions) {
        if (keys.has(question.key))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "As chaves das questões devem ser únicas nesta avaliação.",
          });
        keys.add(question.key);
        validateQuestion(question);
      }
      const db = await getDatabase();
      await db.transaction(async tx => {
        const values = {
          subjectId: input.subjectId,
          title: input.title,
          description: input.description,
          allowPractice: input.allowPractice,
          allowFormal: input.allowFormal,
          position: input.position,
          isPublished: input.isPublished && !input.archived,
          archivedAt: input.archived ? new Date() : null,
          updatedAt: new Date(),
        };
        let assessmentId = input.id;
        let version = 1;
        if (assessmentId) {
          const [existing] = await tx
            .select({ version: trainingAssessments.version })
            .from(trainingAssessments)
            .where(eq(trainingAssessments.id, assessmentId))
            .limit(1);
          if (!existing)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Avaliação não encontrada.",
            });
          version = existing.version + 1;
          await tx
            .update(trainingAssessments)
            .set({ ...values, version })
            .where(eq(trainingAssessments.id, assessmentId));
          await tx
            .delete(trainingQuestions)
            .where(eq(trainingQuestions.assessmentId, assessmentId));
        } else {
          const [created] = await tx
            .insert(trainingAssessments)
            .values(values)
            .returning({ id: trainingAssessments.id });
          assessmentId = created.id;
        }
        if (input.questions.length)
          await tx.insert(trainingQuestions).values(
            input.questions.map(question => ({
              assessmentId: assessmentId!,
              questionKey: question.key,
              type: question.type,
              prompt: question.prompt,
              config: question.config as TrainingQuestionConfig,
              points: question.points,
              position: question.position,
              updatedAt: new Date(),
            }))
          );
      });
      return { ok: true };
    }),

  resultsReport: trainingEditorProcedure
    .input(
      z.object({ subjectId: z.number().int().positive().optional() }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDatabase();
      const where = input?.subjectId
        ? eq(trainingSubjects.id, input.subjectId)
        : undefined;
      return db
        .select({
          attemptId: trainingAttempts.id,
          userId: trainingAttempts.userId,
          userName: userTable.name,
          sector: trainingSectors.name,
          subject: trainingSubjects.title,
          assessment: trainingAssessments.title,
          mode: trainingAttempts.mode,
          status: trainingAttempts.status,
          version: trainingAttempts.assessmentVersion,
          score: trainingAttempts.score,
          startedAt: trainingAttempts.startedAt,
          completedAt: trainingAttempts.completedAt,
        })
        .from(trainingAttempts)
        .innerJoin(userTable, eq(trainingAttempts.userId, userTable.id))
        .innerJoin(
          trainingAssessments,
          eq(trainingAttempts.assessmentId, trainingAssessments.id)
        )
        .innerJoin(
          trainingSubjects,
          eq(trainingAssessments.subjectId, trainingSubjects.id)
        )
        .innerJoin(
          trainingSectors,
          eq(trainingSubjects.sectorId, trainingSectors.id)
        )
        .where(where)
        .orderBy(desc(trainingAttempts.startedAt))
        .limit(500);
    }),
});

export type { TrainingQuestionType, Mode as TrainingMode };
