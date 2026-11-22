import { expect, test } from "@playwright/test";

const avaliacao = {
  id: 20,
  title: "Decisões no CRM",
  description: "Revise as informações antes de registrar a proposta.",
  allowPractice: true,
  allowFormal: false,
  version: 1,
  position: 0,
  hasActivePracticeAttempt: false,
  materials: [],
};

const frases = [
  {
    id: "dados-cliente",
    text: "Registre no CRM os dados que o cliente confirmou.",
    correctBoolean: true,
    feedback: "Use informações confirmadas pelo cliente.",
  },
  {
    id: "promessa-venda",
    text: "Prometa que o cliente final aprovará a proposta.",
    correctBoolean: false,
    feedback: "Não prometa uma decisão que depende de outra pessoa.",
  },
];

async function configurarTreinamento(page: import("@playwright/test").Page) {
  const respostasEnviadas: unknown[] = [];
  const agora = new Date().toISOString();
  await page.route("**/api/auth/**", route =>
    route.fulfill({
      status: 200,
      json: {
        session: {
          id: "e2e-session",
          token: "e2e-token",
          userId: "e2e-user",
          expiresAt: "2027-01-01T00:00:00.000Z",
          createdAt: agora,
          updatedAt: agora,
        },
        user: {
          id: "e2e-user",
          name: "Vendedor E2E",
          email: "vendedor-e2e@example.com",
          emailVerified: true,
          createdAt: agora,
          updatedAt: agora,
          role: "vendas",
        },
      },
    })
  );
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = url.pathname.replace("/api/trpc/", "").split(",");
    const rawInput =
      url.searchParams.get("input") ?? route.request().postData() ?? "{}";
    const input = JSON.parse(rawInput) as Record<
      string,
      { json?: Record<string, unknown> }
    >;
    const responses = procedures.map((procedure, index) => {
      const procedureInput = input[String(index)]?.json ?? {};
      let data: unknown = [];

      if (procedure.endsWith("permissions.myPermissions")) {
        data = [];
      } else if (procedure.endsWith("treinamento.catalog")) {
        data = [
          {
            id: 10,
            name: "Comercial",
            slug: "comercial",
            description: "",
            isPublished: true,
            archivedAt: null,
            subjects: [
              {
                id: 11,
                sectorId: 10,
                title: "Atendimento ao cliente",
                slug: "atendimento-cliente",
                description: "",
                isPublished: true,
                archivedAt: null,
              },
            ],
          },
        ];
      } else if (procedure.endsWith("treinamento.myProgress")) {
        data = [];
      } else if (procedure.endsWith("treinamento.subject")) {
        data = {
          id: 11,
          sectorId: 10,
          title: "Atendimento ao cliente",
          slug: "atendimento-cliente",
          description: "",
          sourceReference: null,
          isPublished: true,
          archivedAt: null,
          sector: { id: 10, name: "Comercial" },
          lessons: [],
          assessments: [avaliacao],
          isEnrolled: true,
          enrolledAt: agora,
          assignedExams: [],
        };
      } else if (procedure.endsWith("treinamento.history")) {
        data = [];
      } else if (procedure.endsWith("treinamento.startAttempt")) {
        data = {
          assessmentId: avaliacao.id,
          attemptId: 200,
          assignmentStudentId: null,
          initialQuestionIndex: 0,
          currentQuestionAnswered: false,
          mode: "practice",
          title: avaliacao.title,
          version: 1,
          progresso: {
            perguntasRespondidas: 0,
            totalPerguntas: 1,
            questoesRestantes: 1,
            percentualConcluido: 0,
            percentualRestante: 100,
            pontosGanhos: 0,
            pontosPossiveisRespondidos: 0,
            percentualAcerto: null,
          },
          questions: [
            {
              key: "crm-informacoes",
              type: "yes_no_matrix",
              prompt: "Para cada frase, marque Sim ou Não.",
              points: 2,
              config: { statements: frases },
            },
          ],
        };
      } else if (procedure.endsWith("treinamento.submitAnswer")) {
        respostasEnviadas.push(procedureInput.response);
        data = {
          questionComplete: true,
          nextQuestion: null,
          progresso: {
            perguntasRespondidas: 1,
            totalPerguntas: 1,
            questoesRestantes: 0,
            percentualConcluido: 100,
            percentualRestante: 0,
            pontosGanhos: 1,
            pontosPossiveisRespondidos: 2,
            percentualAcerto: 50,
          },
          feedback: {
            isCorrect: false,
            expectedAnswer: "Responda cada frase pelo critério do POP.",
            explanation: "Registre fatos confirmados e não prometa decisões de terceiros.",
            details: [],
            corrections: [
              {
                id: "promessa-venda",
                text: frases[1].text,
                selectedAnswer: "Sim",
                expectedAnswer: "Não",
                feedback: frases[1].feedback,
              },
            ],
            scorePercent: 50,
          },
        };
      }

      return { result: { data: { json: data } } };
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responses),
    });
  });

  return respostasEnviadas;
}

test("responde e revisa cada frase da questão Sim ou Não", async ({ page }) => {
  const respostas = await configurarTreinamento(page);
  const errosPagina: string[] = [];
  page.on("pageerror", error => errosPagina.push(error.message));

  await page.goto("/e2e-treinamento.html");
  await expect(
    page.getByRole("heading", { name: "Escola Corporativa" })
  ).toBeVisible();
  await expect(page.getByText("Atendimento ao cliente").first()).toBeVisible();
  await page.getByRole("button", { name: "Praticar" }).click();

  for (const frase of frases) {
    const grupo = page.getByRole("group", { name: frase.text });
    await grupo.getByLabel("Sim").check();
  }
  await page.getByRole("button", { name: "Responder" }).click();

  await expect(
    page.getByText("Correção: a resposta esperada é Não.")
  ).toBeVisible();
  await expect(page.getByText(frases[1].feedback)).toBeVisible();
  expect(respostas).toEqual([["sim", "sim"]]);
  expect(errosPagina).toEqual([]);
});
