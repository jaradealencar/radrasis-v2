import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  trainingAssessments,
  trainingAssessmentMaterials,
  trainingAttemptAnswers,
  trainingAttempts,
  trainingExamAssignmentStudents,
  trainingExamAssignments,
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
const TRAINING_MATERIAL_MAX_BYTES = 32 * 1024 * 1024;
const TRAINING_MATERIAL_EXTENSIONS =
  /\.(pdf|docx?|pptx?|xlsx?|txt|png|jpe?g|webp)$/i;

const questionOptionSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(2000),
  correct: z.boolean().optional(),
  value: z.number().int().min(-1000).max(1000).optional(),
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
    leftItems: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          text: z.string().min(1).max(2000),
        })
      )
      .max(20)
      .optional(),
    rightItems: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          text: z.string().min(1).max(2000),
        })
      )
      .max(20)
      .optional(),
    correctPairs: z
      .array(
        z.object({
          leftId: z.string().min(1).max(80),
          rightId: z.string().min(1).max(80),
        })
      )
      .max(20)
      .optional(),
    blanks: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          acceptedAnswers: z.array(z.string().min(1).max(500)).min(1).max(20),
        })
      )
      .max(20)
      .optional(),
    correctBoolean: z.boolean().optional(),
    acceptedAnswers: z.array(z.string().min(1).max(500)).max(30).optional(),
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
type AssignmentAttemptReport = {
  id: number;
  mode: string;
  status: string;
  score: string | null;
  startedAt: Date;
  completedAt: Date | null;
};
type AssignmentStudentReport = {
  id: number;
  assignmentId: number;
  userId: string;
  name: string;
  assignedAt: Date;
  attempts: AssignmentAttemptReport[];
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

function isUploadThingFileUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedHost = ["ufs.sh", "utfs.io", "uploadthing.com"].some(
      domain => host === domain || host.endsWith(`.${domain}`)
    );
    return (
      url.protocol === "https:" &&
      allowedHost &&
      /^\/f\/[^/]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
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
  if (question.type === "matching") {
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      config: {
        leftItems: config.leftItems ?? [],
        rightItems: config.rightItems ?? [],
      },
    };
  }
  if (question.type === "sum") {
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      config: {
        options: config.options?.map(({ id, text, value }) => ({
          id,
          text,
          value: value ?? 0,
        })),
      },
    };
  }
  if (question.type === "fill_blank") {
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      config: { blanks: config.blanks?.map(({ id }) => ({ id })) ?? [] },
    };
  }
  if (question.type === "true_false") {
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      config: {
        options: [
          { id: "true", text: "Verdadeiro" },
          { id: "false", text: "Falso" },
        ],
      },
    };
  }
  if (question.type === "short_answer") {
    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      config: {},
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
  if (question.type === "matching") {
    const leftItems = config.leftItems ?? [];
    const rightItems = config.rightItems ?? [];
    const pairs = config.correctPairs ?? [];
    const leftIds = leftItems.map(item => item.id);
    const rightIds = rightItems.map(item => item.id);
    if (
      leftItems.length < 2 ||
      rightItems.length !== leftItems.length ||
      pairs.length !== leftItems.length ||
      new Set(leftIds).size !== leftIds.length ||
      new Set(rightIds).size !== rightIds.length ||
      new Set(pairs.map(pair => pair.leftId)).size !== pairs.length ||
      new Set(pairs.map(pair => pair.rightId)).size !== pairs.length ||
      pairs.some(
        pair =>
          !leftIds.includes(pair.leftId) || !rightIds.includes(pair.rightId)
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A questÃ£o ${question.key} precisa de pares vÃ¡lidos, sem repetiÃ§Ã£o, para todos os itens.`,
      });
    }
  }
  if (question.type === "sum") {
    const options = config.options ?? [];
    if (
      options.length < 2 ||
      new Set(options.map(option => option.id)).size !== options.length ||
      options.some(
        option => option.value === undefined || option.correct === undefined
      ) ||
      !options.some(option => option.correct)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A questÃ£o ${question.key} precisa de itens numerados e ao menos um item correto.`,
      });
    }
  }
  if (question.type === "fill_blank") {
    const blanks = config.blanks ?? [];
    if (
      !blanks.length ||
      new Set(blanks.map(blank => blank.id)).size !== blanks.length ||
      blanks.some(
        blank =>
          !blank.acceptedAnswers.length ||
          !question.prompt.includes(`{{${blank.id}}}`)
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A questÃ£o ${question.key} deve usar {{id}} no enunciado e cadastrar uma resposta aceita por lacuna.`,
      });
    }
  }
  if (
    question.type === "true_false" &&
    typeof config.correctBoolean !== "boolean"
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A questÃ£o ${question.key} precisa definir correctBoolean como true ou false.`,
    });
  }
  if (
    question.type === "short_answer" &&
    !(config.acceptedAnswers ?? []).some(answer => answer.trim().length > 0)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A questÃ£o ${question.key} precisa de ao menos uma resposta curta aceita.`,
    });
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

function normalizeAnswer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
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
  } else if (question.type === "matching") {
    const leftItems = config.leftItems ?? [];
    const rightItems = config.rightItems ?? [];
    const correctByLeft = new Map(
      (config.correctPairs ?? []).map(pair => [pair.leftId, pair.rightId])
    );
    const correctCount = leftItems.reduce(
      (count, item, index) =>
        count + Number(selected[index] === correctByLeft.get(item.id)),
      0
    );
    fraction = config.allowPartialCredit
      ? correctCount / Math.max(1, leftItems.length)
      : correctCount === leftItems.length
        ? 1
        : 0;
    const rightById = new Map(rightItems.map(item => [item.id, item.text]));
    const leftById = new Map(leftItems.map(item => [item.id, item.text]));
    expectedAnswer = (config.correctPairs ?? [])
      .map(
        pair =>
          `${leftById.get(pair.leftId) ?? pair.leftId} → ${rightById.get(pair.rightId) ?? pair.rightId}`
      )
      .join("; ");
    details = [`Associações corretas: ${correctCount} de ${leftItems.length}.`];
  } else if (question.type === "sum") {
    const options = config.options ?? [];
    const uniqueSelection = new Set(selected);
    const selectedOptions = options.filter(option =>
      uniqueSelection.has(option.id)
    );
    const actualSum = selectedOptions.reduce(
      (sum, option) => sum + (option.value ?? 0),
      0
    );
    const correctOptions = options.filter(option => option.correct);
    const correctSum = correctOptions.reduce(
      (sum, option) => sum + (option.value ?? 0),
      0
    );
    fraction =
      uniqueSelection.size === selected.length && actualSum === correctSum
        ? 1
        : 0;
    expectedAnswer = `Somatório correto: ${correctSum}.`;
    details = correctOptions.map(option => `${option.value}: ${option.text}`);
  } else if (question.type === "fill_blank") {
    const blanks = config.blanks ?? [];
    const correctCount = blanks.reduce((count, blank, index) => {
      const answer = normalizeAnswer(selected[index] ?? "");
      return (
        count +
        Number(
          blank.acceptedAnswers.some(
            accepted => normalizeAnswer(accepted) === answer
          )
        )
      );
    }, 0);
    fraction = config.allowPartialCredit
      ? correctCount / Math.max(1, blanks.length)
      : correctCount === blanks.length
        ? 1
        : 0;
    expectedAnswer = blanks
      .map(blank => `${blank.id}: ${blank.acceptedAnswers[0]}`)
      .join("; ");
    details = [`Lacunas corretas: ${correctCount} de ${blanks.length}.`];
  } else if (question.type === "true_false") {
    const expected = String(config.correctBoolean);
    fraction = selected[0]?.toLowerCase() === expected ? 1 : 0;
    expectedAnswer = config.correctBoolean ? "Verdadeiro" : "Falso";
  } else if (question.type === "short_answer") {
    const answer = normalizeAnswer(selected[0] ?? "");
    const acceptedAnswers = config.acceptedAnswers ?? [];
    fraction = acceptedAnswers.some(
      accepted => normalizeAnswer(accepted) === answer
    )
      ? 1
      : 0;
    expectedAnswer = acceptedAnswers.join(" / ");
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
  } else if (question.type === "matching") {
    const rightText = new Map(
      (question.config.rightItems ?? []).map(item => [item.id, item.text])
    );
    selected = (question.config.leftItems ?? []).map((item, index) => {
      const responseIds = Array.isArray(response) ? response : [];
      return `${item.text} → ${rightText.get(String(responseIds[index] ?? "")) ?? "Sem associação"}`;
    });
  } else if (question.type === "fill_blank") {
    selected = Array.isArray(response) ? response.map(String) : [];
  } else if (question.type === "true_false") {
    selected = String(response) === "true" ? "Verdadeiro" : "Falso";
  } else if (question.type === "short_answer") {
    selected = String(response ?? "");
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
      const [lessons, assessments, enrollment, assignedExams] =
        await Promise.all([
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
          db
            .select({
              assignmentStudentId: trainingExamAssignmentStudents.id,
              assignmentId: trainingExamAssignments.id,
              assessmentId: trainingAssessments.id,
              title: trainingAssessments.title,
              deadlineAt: trainingExamAssignments.dueAt,
              maxAttempts: trainingExamAssignments.maxAttempts,
              assignedAt: trainingExamAssignmentStudents.assignedAt,
            })
            .from(trainingExamAssignmentStudents)
            .innerJoin(
              trainingExamAssignments,
              eq(
                trainingExamAssignmentStudents.assignmentId,
                trainingExamAssignments.id
              )
            )
            .innerJoin(
              trainingAssessments,
              eq(trainingExamAssignments.assessmentId, trainingAssessments.id)
            )
            .where(
              and(
                eq(trainingExamAssignmentStudents.userId, ctx.user.id),
                eq(trainingAssessments.subjectId, subject.id)
              )
            )
            .orderBy(asc(trainingExamAssignments.dueAt)),
        ]);
      const visibleAssignedExams = enrollment[0] ? assignedExams : [];
      const assessmentIds = assessments.map(assessment => assessment.id);
      const subjectMaterials =
        enrollment[0] && assessmentIds.length
          ? await db
              .select({
                id: trainingAssessmentMaterials.id,
                assessmentId: trainingAssessmentMaterials.assessmentId,
                name: trainingAssessmentMaterials.name,
                url: trainingAssessmentMaterials.url,
                mimeType: trainingAssessmentMaterials.mimeType,
                sizeBytes: trainingAssessmentMaterials.sizeBytes,
                createdAt: trainingAssessmentMaterials.createdAt,
              })
              .from(trainingAssessmentMaterials)
              .where(
                inArray(trainingAssessmentMaterials.assessmentId, assessmentIds)
              )
              .orderBy(asc(trainingAssessmentMaterials.createdAt))
          : [];
      const materialsByAssessment = new Map<number, typeof subjectMaterials>();
      for (const material of subjectMaterials) {
        const current = materialsByAssessment.get(material.assessmentId) ?? [];
        current.push(material);
        materialsByAssessment.set(material.assessmentId, current);
      }
      const visibleAssignmentStudentIds = visibleAssignedExams.map(
        assignment => assignment.assignmentStudentId
      );
      const assignedAttempts = visibleAssignmentStudentIds.length
        ? await db
            .select({
              id: trainingAttempts.id,
              assignmentStudentId: trainingAttempts.assignmentStudentId,
              status: trainingAttempts.status,
              score: trainingAttempts.score,
              startedAt: trainingAttempts.startedAt,
              completedAt: trainingAttempts.completedAt,
            })
            .from(trainingAttempts)
            .where(
              inArray(
                trainingAttempts.assignmentStudentId,
                visibleAssignmentStudentIds
              )
            )
            .orderBy(desc(trainingAttempts.startedAt))
        : [];
      return {
        ...subject,
        sector,
        lessons,
        assessments: assessments.map(assessment => ({
          ...assessment,
          materials: materialsByAssessment.get(assessment.id) ?? [],
        })),
        isEnrolled: Boolean(enrollment[0]),
        enrolledAt: enrollment[0]?.enrolledAt ?? null,
        assignedExams: visibleAssignedExams.map(assignment => ({
          ...assignment,
          attempts: assignedAttempts
            .filter(
              attempt =>
                attempt.assignmentStudentId === assignment.assignmentStudentId
            )
            .map(
              ({ assignmentStudentId: _assignmentStudentId, ...attempt }) =>
                attempt
            ),
        })),
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

  enrolledStudents: trainingEditorProcedure
    .input(z.object({ subjectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select({
          userId: trainingEnrollments.userId,
          name: userTable.name,
          enrolledAt: trainingEnrollments.enrolledAt,
        })
        .from(trainingEnrollments)
        .innerJoin(userTable, eq(trainingEnrollments.userId, userTable.id))
        .where(eq(trainingEnrollments.subjectId, input.subjectId))
        .orderBy(asc(userTable.name));
    }),

  listAssessmentMaterials: trainingEditorProcedure
    .input(z.object({ assessmentId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select({
          id: trainingAssessmentMaterials.id,
          assessmentId: trainingAssessmentMaterials.assessmentId,
          name: trainingAssessmentMaterials.name,
          url: trainingAssessmentMaterials.url,
          mimeType: trainingAssessmentMaterials.mimeType,
          sizeBytes: trainingAssessmentMaterials.sizeBytes,
          createdAt: trainingAssessmentMaterials.createdAt,
        })
        .from(trainingAssessmentMaterials)
        .where(eq(trainingAssessmentMaterials.assessmentId, input.assessmentId))
        .orderBy(asc(trainingAssessmentMaterials.createdAt));
    }),

  addAssessmentMaterial: trainingEditorProcedure
    .input(
      z.object({
        assessmentId: z.number().int().positive(),
        name: z.string().trim().min(1).max(255),
        url: z.string().url().max(2000),
        fileKey: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(150),
        sizeBytes: z.number().int().min(1).max(TRAINING_MATERIAL_MAX_BYTES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!TRAINING_MATERIAL_EXTENSIONS.test(input.name))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Envie PDF, Word, PowerPoint, Excel, TXT ou uma imagem PNG/JPG/WEBP.",
        });
      if (!isUploadThingFileUrl(input.url))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O material precisa estar armazenado no UploadThing.",
        });

      const db = await getDatabase();
      const [assessment] = await db
        .select({ id: trainingAssessments.id })
        .from(trainingAssessments)
        .where(eq(trainingAssessments.id, input.assessmentId))
        .limit(1);
      if (!assessment)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Avaliação não encontrada.",
        });

      const [material] = await db
        .insert(trainingAssessmentMaterials)
        .values({ ...input, uploadedBy: ctx.user.id })
        .returning({ id: trainingAssessmentMaterials.id });
      return { ok: true, materialId: material.id };
    }),

  createExamAssignment: trainingEditorProcedure
    .input(
      z.object({
        assessmentId: z.number().int().positive(),
        dueAt: z.date(),
        maxAttempts: z.number().int().min(1).max(20),
        userIds: z
          .array(z.string().min(1).max(128))
          .min(1)
          .max(200)
          .refine(ids => new Set(ids).size === ids.length, {
            message: "Selecione cada aluno uma única vez.",
          }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.dueAt.getTime() <= Date.now())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O prazo da prova precisa estar no futuro.",
        });
      const db = await getDatabase();
      return db.transaction(async tx => {
        const [assessment] = await tx
          .select({
            id: trainingAssessments.id,
            subjectId: trainingAssessments.subjectId,
            allowFormal: trainingAssessments.allowFormal,
          })
          .from(trainingAssessments)
          .where(
            and(
              eq(trainingAssessments.id, input.assessmentId),
              eq(trainingAssessments.isPublished, true),
              isNull(trainingAssessments.archivedAt)
            )
          )
          .limit(1);
        if (!assessment || !assessment.allowFormal)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Publique uma avaliação formal antes de aplicá-la.",
          });

        const [subject] = await tx
          .select({ id: trainingSubjects.id })
          .from(trainingSubjects)
          .innerJoin(
            trainingSectors,
            eq(trainingSubjects.sectorId, trainingSectors.id)
          )
          .where(
            and(
              eq(trainingSubjects.id, assessment.subjectId),
              eq(trainingSubjects.isPublished, true),
              isNull(trainingSubjects.archivedAt),
              eq(trainingSectors.isPublished, true),
              isNull(trainingSectors.archivedAt)
            )
          )
          .limit(1);
        if (!subject)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A matéria da avaliação não está publicada.",
          });

        const enrolled = await tx
          .select({ userId: trainingEnrollments.userId })
          .from(trainingEnrollments)
          .where(
            and(
              eq(trainingEnrollments.subjectId, subject.id),
              inArray(trainingEnrollments.userId, input.userIds)
            )
          );
        if (enrolled.length !== input.userIds.length)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Todos os alunos selecionados precisam estar matriculados nesta matéria.",
          });

        const [assignment] = await tx
          .insert(trainingExamAssignments)
          .values({
            assessmentId: assessment.id,
            dueAt: input.dueAt,
            maxAttempts: input.maxAttempts,
            createdBy: ctx.user.id,
          })
          .returning({ id: trainingExamAssignments.id });
        await tx.insert(trainingExamAssignmentStudents).values(
          enrolled.map(student => ({
            assignmentId: assignment.id,
            userId: student.userId,
          }))
        );
        return {
          ok: true,
          assignmentId: assignment.id,
          assigned: enrolled.length,
        };
      });
    }),

  assignmentReport: trainingEditorProcedure
    .input(
      z.object({ subjectId: z.number().int().positive().optional() }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDatabase();
      const assignmentRows = await db
        .select({
          id: trainingExamAssignments.id,
          assessmentId: trainingAssessments.id,
          assessmentTitle: trainingAssessments.title,
          subjectId: trainingSubjects.id,
          subjectTitle: trainingSubjects.title,
          dueAt: trainingExamAssignments.dueAt,
          maxAttempts: trainingExamAssignments.maxAttempts,
          createdAt: trainingExamAssignments.createdAt,
        })
        .from(trainingExamAssignments)
        .innerJoin(
          trainingAssessments,
          eq(trainingExamAssignments.assessmentId, trainingAssessments.id)
        )
        .innerJoin(
          trainingSubjects,
          eq(trainingAssessments.subjectId, trainingSubjects.id)
        )
        .where(
          input?.subjectId
            ? eq(trainingSubjects.id, input.subjectId)
            : undefined
        )
        .orderBy(desc(trainingExamAssignments.createdAt));
      if (!assignmentRows.length) return [];

      const assignmentIds = assignmentRows.map(assignment => assignment.id);
      const students = await db
        .select({
          id: trainingExamAssignmentStudents.id,
          assignmentId: trainingExamAssignmentStudents.assignmentId,
          userId: trainingExamAssignmentStudents.userId,
          name: userTable.name,
          assignedAt: trainingExamAssignmentStudents.assignedAt,
        })
        .from(trainingExamAssignmentStudents)
        .innerJoin(
          userTable,
          eq(trainingExamAssignmentStudents.userId, userTable.id)
        )
        .where(
          inArray(trainingExamAssignmentStudents.assignmentId, assignmentIds)
        )
        .orderBy(asc(userTable.name));
      const studentById = new Map<number, AssignmentStudentReport>(
        students.map(student => [student.id, { ...student, attempts: [] }])
      );
      const studentIds = students.map(student => student.id);
      if (studentIds.length) {
        const attempts = await db
          .select({
            id: trainingAttempts.id,
            assignmentStudentId: trainingAttempts.assignmentStudentId,
            mode: trainingAttempts.mode,
            status: trainingAttempts.status,
            score: trainingAttempts.score,
            startedAt: trainingAttempts.startedAt,
            completedAt: trainingAttempts.completedAt,
          })
          .from(trainingAttempts)
          .where(inArray(trainingAttempts.assignmentStudentId, studentIds))
          .orderBy(desc(trainingAttempts.startedAt));
        for (const attempt of attempts) {
          if (attempt.assignmentStudentId == null) continue;
          studentById.get(attempt.assignmentStudentId)?.attempts.push({
            id: attempt.id,
            mode: attempt.mode,
            status: attempt.status,
            score: attempt.score,
            startedAt: attempt.startedAt,
            completedAt: attempt.completedAt,
          });
        }
      }
      const studentsByAssignment = new Map<number, AssignmentStudentReport[]>();
      for (const student of studentById.values()) {
        const assignmentStudents =
          studentsByAssignment.get(student.assignmentId) ?? [];
        assignmentStudents.push(student);
        studentsByAssignment.set(student.assignmentId, assignmentStudents);
      }
      return assignmentRows.map(assignment => ({
        ...assignment,
        students: (studentsByAssignment.get(assignment.id) ?? []).map(student =>
          studentById.get(student.id)
        ),
      }));
    }),

  leaderboardReport: trainingEditorProcedure
    .input(
      z.object({ subjectId: z.number().int().positive().optional() }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [
        eq(trainingAttempts.mode, "formal"),
        eq(trainingAttempts.status, "completed"),
      ];
      if (input?.subjectId)
        conditions.push(eq(trainingSubjects.id, input.subjectId));

      const rows = await db
        .select({
          userId: trainingAttempts.userId,
          userName: userTable.name,
          assessmentId: trainingAssessments.id,
          assessment: trainingAssessments.title,
          subject: trainingSubjects.title,
          sector: trainingSectors.name,
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
        .where(and(...conditions))
        .orderBy(asc(trainingAssessments.title), asc(userTable.name));

      const exams = new Map<
        number,
        {
          assessmentId: number;
          assessment: string;
          subject: string;
          sector: string;
          students: Map<
            string,
            {
              userId: string;
              userName: string;
              score: number;
              completedAt: Date | null;
              startedAt: Date;
              completedAttempts: number;
            }
          >;
        }
      >();

      for (const row of rows) {
        let exam = exams.get(row.assessmentId);
        if (!exam) {
          exam = {
            assessmentId: row.assessmentId,
            assessment: row.assessment,
            subject: row.subject,
            sector: row.sector,
            students: new Map(),
          };
          exams.set(row.assessmentId, exam);
        }

        const score = Number(row.score ?? 0);
        const current = exam.students.get(row.userId);
        if (!current) {
          exam.students.set(row.userId, {
            userId: row.userId,
            userName: row.userName,
            score,
            completedAt: row.completedAt,
            startedAt: row.startedAt,
            completedAttempts: 1,
          });
          continue;
        }

        current.completedAttempts += 1;
        const candidateTime = (row.completedAt ?? row.startedAt).getTime();
        const currentBestTime = (
          current.completedAt ?? current.startedAt
        ).getTime();
        if (
          score > current.score ||
          (score === current.score && candidateTime < currentBestTime)
        ) {
          current.score = score;
          current.completedAt = row.completedAt;
          current.startedAt = row.startedAt;
        }
      }

      return [...exams.values()].map(exam => {
        const rankedStudents = [...exam.students.values()].sort(
          (a, b) =>
            b.score - a.score ||
            (a.completedAt ?? a.startedAt).getTime() -
              (b.completedAt ?? b.startedAt).getTime() ||
            a.userName.localeCompare(b.userName, "pt-BR")
        );
        let rank = 0;
        let previousScore: number | undefined;
        const students = rankedStudents.map((student, index) => {
          if (student.score !== previousScore) rank = index + 1;
          previousScore = student.score;
          return { ...student, rank };
        });
        return {
          assessmentId: exam.assessmentId,
          assessment: exam.assessment,
          subject: exam.subject,
          sector: exam.sector,
          students,
        };
      });
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
        assignmentStudentId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.mode === "formal" && !input.assignmentStudentId)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta prova formal precisa ser aplicada pelo instrutor.",
        });
      if (input.mode === "practice" && input.assignmentStudentId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A matrícula em uma prova vale somente para o modo formal.",
        });
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
      const attemptState = await db.transaction(async tx => {
        let assignmentStudentId: number | null = null;
        if (input.mode === "formal") {
          const [recipient] = await tx
            .select()
            .from(trainingExamAssignmentStudents)
            .where(
              and(
                eq(
                  trainingExamAssignmentStudents.id,
                  input.assignmentStudentId!
                ),
                eq(trainingExamAssignmentStudents.userId, ctx.user.id)
              )
            )
            .for("update")
            .limit(1);
          if (!recipient)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Esta prova não foi aplicada para você.",
            });
          const [assignment] = await tx
            .select()
            .from(trainingExamAssignments)
            .where(eq(trainingExamAssignments.id, recipient.assignmentId))
            .limit(1);
          if (!assignment || assignment.assessmentId !== assessment.id)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "A atribuição não corresponde a esta avaliação.",
            });
          assignmentStudentId = recipient.id;

          const existingAttempts = await tx
            .select()
            .from(trainingAttempts)
            .where(eq(trainingAttempts.assignmentStudentId, recipient.id))
            .orderBy(desc(trainingAttempts.startedAt));
          const activeAttempt = existingAttempts.find(
            attempt => attempt.status === "in_progress"
          );
          if (activeAttempt)
            return {
              attempt: activeAttempt,
              assignmentStudentId,
              resumed: true,
            };
          if (assignment.dueAt.getTime() < Date.now())
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "O prazo desta prova terminou.",
            });
          if (existingAttempts.length >= assignment.maxAttempts)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Você já usou todas as tentativas desta prova.",
            });
        }

        const [createdAttempt] = await tx
          .insert(trainingAttempts)
          .values({
            userId: ctx.user.id,
            assessmentId: assessment.id,
            assignmentStudentId,
            mode: input.mode,
            assessmentVersion: assessment.version,
            snapshot,
          })
          .returning();
        return {
          attempt: createdAttempt,
          assignmentStudentId,
          resumed: false,
        };
      });
      const attemptSnapshot = attemptState.resumed
        ? (attemptState.attempt.snapshot as unknown as AssessmentSnapshot)
        : snapshot;
      let initialQuestionIndex = 0;
      let currentQuestionAnswered = false;
      let activeNegotiationNodeId: string | undefined;
      if (attemptState.resumed) {
        const answers = await db
          .select()
          .from(trainingAttemptAnswers)
          .where(eq(trainingAttemptAnswers.attemptId, attemptState.attempt.id))
          .orderBy(
            asc(trainingAttemptAnswers.createdAt),
            asc(trainingAttemptAnswers.id)
          );
        const firstUnanswered = attemptSnapshot.questions.findIndex(
          question => {
            const questionAnswers = answers.filter(
              answer => answer.questionKey === question.key
            );
            return question.type === "negotiation"
              ? !questionAnswers.some(answer => answer.isTerminal)
              : questionAnswers.length === 0;
          }
        );
        if (firstUnanswered === -1) {
          initialQuestionIndex = Math.max(
            0,
            attemptSnapshot.questions.length - 1
          );
          currentQuestionAnswered = true;
        } else {
          initialQuestionIndex = firstUnanswered;
          const currentQuestion =
            attemptSnapshot.questions[initialQuestionIndex];
          if (currentQuestion.type === "negotiation") {
            const previousSteps = answers.filter(
              answer => answer.questionKey === currentQuestion.key
            );
            const previousStep = previousSteps.at(-1);
            if (previousStep) {
              const response = previousStep.response as {
                nodeId: string;
                optionId: string;
              };
              activeNegotiationNodeId =
                getNegotiationOption(
                  currentQuestion,
                  response.nodeId,
                  response.optionId
                ).option.nextNodeId ?? undefined;
            }
          }
        }
      }
      return {
        assessmentId: assessment.id,
        attemptId: attemptState.attempt.id,
        assignmentStudentId: attemptState.assignmentStudentId,
        initialQuestionIndex,
        currentQuestionAnswered,
        mode: attemptState.attempt.mode as Mode,
        title: attemptSnapshot.title,
        version: attemptState.attempt.assessmentVersion,
        questions: attemptSnapshot.questions.map((question, index) =>
          publicQuestion(
            question,
            index === initialQuestionIndex ? activeNegotiationNodeId : undefined
          )
        ),
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

      if (question.type === "matching") {
        const leftItems = question.config.leftItems ?? [];
        const rightIds = new Set(
          (question.config.rightItems ?? []).map(item => item.id)
        );
        if (
          !Array.isArray(input.response) ||
          input.response.length !== leftItems.length ||
          input.response.some(id => !rightIds.has(id)) ||
          new Set(input.response).size !== input.response.length
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Preencha cada associação usando uma opção diferente.",
          });
      }
      if (question.type === "sum") {
        const optionIds = new Set(
          (question.config.options ?? []).map(option => option.id)
        );
        if (
          !Array.isArray(input.response) ||
          input.response.some(id => !optionIds.has(id)) ||
          new Set(input.response).size !== input.response.length
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione cada item do somatório uma única vez.",
          });
      }
      if (question.type === "fill_blank") {
        const blanks = question.config.blanks ?? [];
        if (
          !Array.isArray(input.response) ||
          input.response.length !== blanks.length ||
          input.response.some(answer => !answer.trim())
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Preencha todas as lacunas antes de responder.",
          });
      }
      if (
        question.type === "true_false" &&
        (typeof input.response !== "string" ||
          !["true", "false"].includes(input.response))
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escolha verdadeiro ou falso.",
        });
      if (
        question.type === "short_answer" &&
        (typeof input.response !== "string" || !input.response.trim())
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Digite uma resposta antes de continuar.",
        });

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
