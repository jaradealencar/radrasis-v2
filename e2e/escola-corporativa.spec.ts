import { expect, test } from "@playwright/test";

const studentLogin = "e2e.aluno@local.internal";
const adminLogin = "e2e.instrutor@local.internal";
const password = "School-E2E-only-Password-2026!";
const assessmentTitle = "Closer · Atendimento consultivo";

async function login(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail ou nome de usuário").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("aluno se matricula, retoma prova e instrutor aplica uma avaliação", async ({
  page,
  browser,
}) => {
  await login(page, studentLogin);
  await page.goto("/treinamento");

  await expect(
    page.getByRole("heading", { name: "Escola Corporativa" })
  ).toBeVisible();
  await expect(
    page
      .locator('[data-slot="card-title"]')
      .filter({ hasText: "Técnicas de Closer" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Matricular-se" })
  ).toBeVisible();
  await expect(
    page.getByText("Matricule-se nesta matéria para liberar as provas.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Praticar", exact: true })
  ).toBeDisabled();

  await page.getByRole("button", { name: "Matricular-se" }).click();
  await expect(page.getByText(/Matriculado ·/)).toBeVisible();
  await page.getByRole("button", { name: "Praticar", exact: true }).click();
  await expect(page.getByText(/Questão 1 de \d+/)).toBeVisible();
  await page
    .getByRole("button", { name: "Sair e retomar depois", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retomar prática" })
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Retomar prática" }).click();
  await expect(page.getByText(/Questão 1 de \d+/)).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminLogin);
  await adminPage.goto("/treinamento");
  await adminPage.getByRole("tab", { name: "Administrar conteúdo" }).click();

  await adminPage
    .locator("#assignment-assessment")
    .selectOption({ label: assessmentTitle });
  await expect(
    adminPage.getByRole("heading", { name: "Alunos matriculados" })
  ).toBeVisible();
  await adminPage.getByRole("checkbox", { name: /E2E Aluno/ }).check();

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const datePart = [
    dueDate.getFullYear(),
    String(dueDate.getMonth() + 1).padStart(2, "0"),
    String(dueDate.getDate()).padStart(2, "0"),
  ].join("-");
  await adminPage.locator("#assignment-deadline").fill(`${datePart}T23:59`);
  await adminPage.locator("#assignment-max-attempts").fill("2");
  await adminPage
    .getByRole("button", { name: "Aplicar prova", exact: true })
    .click();
  await expect(
    adminPage.getByText("2 tentativa(s) permitida(s)")
  ).toBeVisible();
  await adminContext.close();

  await page.reload();
  await page.getByRole("button", { name: "Iniciar prova formal" }).click();
  await expect(page.getByText(/Questão 1 de \d+/)).toBeVisible();
  await page
    .getByRole("button", { name: "Sair e retomar depois", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar prova" })
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continuar prova" }).click();
  await expect(page.getByText(/Questão 1 de \d+/)).toBeVisible();
});

test("painel do instrutor apresenta notas e ranking das provas formais", async ({
  page,
}) => {
  await login(page, adminLogin);
  await page.goto("/treinamento");
  await page.getByRole("tab", { name: "Administrar conteúdo" }).click();

  const studentPanelTitle = page
    .locator('[data-slot="card-title"]')
    .filter({ hasText: "Painel dos alunos" });
  const studentPanel = page
    .locator('[data-slot="card"]')
    .filter({ has: studentPanelTitle });
  await expect(studentPanelTitle).toBeVisible();
  await expect(studentPanel).toContainText("E2E Instrutor");
  await expect(studentPanel).toContainText("8.50/10");

  const rankingTitle = page
    .locator('[data-slot="card-title"]')
    .filter({ hasText: "Ranking das provas formais" });
  const ranking = page
    .locator('[data-slot="card"]')
    .filter({ has: rankingTitle });
  await expect(rankingTitle).toBeVisible();
  await expect(
    ranking.getByRole("heading", { name: assessmentTitle })
  ).toBeVisible();
});

test("instrutor edita alternativas e gabarito e revisa uma questão refeita com IA", async ({
  page,
}) => {
  await login(page, adminLogin);
  await page.goto("/treinamento");
  await page.getByRole("tab", { name: "Administrar conteúdo" }).click();
  await page
    .getByTestId("assessment-editor-selector")
    .selectOption({ label: assessmentTitle });

  const question = page.getByTestId("assessment-question-prazo_confirmado");
  await expect(question).toBeVisible();
  await expect(question.getByText("Gabarito: 1 certa(s)")).toBeVisible();

  await question
    .getByLabel("Texto da alternativa 2")
    .fill("Prometer a data que o cliente pediu sem consultar a produção.");
  await question.getByRole("button", { name: "Excluir alternativa 3" }).click();
  await question.getByRole("button", { name: "Adicionar alternativa" }).click();
  await question
    .getByLabel("Texto da alternativa 3")
    .fill("Usar um prazo do mês passado sem conferir a produção.");
  const answerKeys = question.getByRole("radio", { name: "Certa" });
  await answerKeys.nth(2).check();
  await expect(answerKeys.nth(2)).toBeChecked();
  await expect(answerKeys.nth(1)).not.toBeChecked();
  await expect(question.getByText("Gabarito: 1 certa(s)")).toBeVisible();

  await page.route(
    "**/api/trpc/treinamento.regenerateQuestionWithAI**",
    route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  prompt: "Situação refeita para validar a prévia da IA.",
                  config: {
                    allowPartialCredit: true,
                    explanation: "A resposta depende do motivo deste pedido.",
                    options: [
                      {
                        id: "a",
                        text: "Classificar pelo motivo deste pedido.",
                        correct: true,
                        feedback: "Considere a necessidade atual.",
                      },
                      {
                        id: "b",
                        text: "Classificar sempre pelo que ele fabrica.",
                        correct: false,
                        feedback: "O perfil, sozinho, não basta.",
                      },
                      {
                        id: "c",
                        text: "Criar um grupo novo para todo cliente híbrido.",
                        correct: false,
                        feedback: "O POP não cria um quarto grupo.",
                      },
                      {
                        id: "d",
                        text: "Usar o histórico sem perguntar sobre o pedido.",
                        correct: false,
                        feedback: "Investigue o pedido atual.",
                      },
                    ],
                  },
                },
              },
            },
          },
        ]),
      })
  );
  await question
    .getByLabel("Orientação para a IA (opcional)")
    .fill("Use uma situação curta de atendimento.");
  await question.getByRole("button", { name: "Refazer com IA" }).click();
  await expect(
    question.locator('textarea[id^="question-prompt-"]')
  ).toHaveValue("Situação refeita para validar a prévia da IA.");
  await expect(question.getByText("Gabarito: 1 certa(s)")).toBeVisible();

  await page
    .getByRole("button", { name: "Salvar avaliação e nova versão" })
    .click();
  await expect(page.getByText("Avaliação salva em nova versão.")).toBeVisible();
});

test("instrutor gera uma matéria a partir de um POP somente após pedir e salva como rascunho", async ({
  page,
}) => {
  await login(page, adminLogin);
  await page.goto("/treinamento");
  await page.getByRole("tab", { name: "Administrar conteúdo" }).click();

  let generationRequests = 0;
  await page.route("**/api/uploadthing**", async route => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === "POST" &&
      url.searchParams.get("actionType") === "upload"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            url: "http://127.0.0.1:4173/__e2e_upload/pop-file",
            key: "e2e-pop-file",
            customId: null,
            name: "Manual E2E.txt",
          },
        ]),
      });
      return;
    }
    await route.continue();
  });
  await page.route("**/__e2e_upload/pop-file", async route => {
    if (route.request().method() === "HEAD") {
      await route.fulfill({
        status: 200,
        headers: { "x-ut-range-start": "0" },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: "https://utfs.io/f/e2e-pop-file",
        appUrl: "https://utfs.io/f/e2e-pop-file",
        ufsUrl: "https://utfs.io/f/e2e-pop-file",
        fileHash: "e2e-file-hash",
        serverData: { name: "Manual E2E.txt" },
      }),
    });
  });
  await page.route("**/api/trpc/treinamento.generateFromPop**", async route => {
    generationRequests += 1;
    const questions = [
      {
        prompt: "O que fazer antes de montar uma cotação?",
        correct: "Confirmar o que o cliente precisa neste pedido.",
        wrong: [
          "Escolher um produto sem perguntar sobre a necessidade.",
          "Enviar um preço aproximado sem conferir o escopo.",
          "Usar a configuração do último pedido sem confirmar os dados.",
        ],
        explanation: "A cotação precisa refletir o pedido atual.",
      },
      {
        prompt: "O que registrar quando o cliente explica um problema?",
        correct: "Anotar a necessidade com as palavras usadas pelo cliente.",
        wrong: [
          "Escrever uma hipótese como se o cliente tivesse dito isso.",
          "Registrar apenas que o cliente pediu um orçamento.",
          "Trocar o relato por uma conclusão sem confirmar com o cliente.",
        ],
        explanation:
          "O registro deve separar fala do cliente de interpretação.",
      },
      {
        prompt: "Como classificar quem fabrica e também terceiriza?",
        correct: "Perguntar por que buscou outra opção neste pedido.",
        wrong: [
          "Colocar sempre no grupo de quem fabrica.",
          "Criar um quarto grupo sem investigar a necessidade.",
          "Usar apenas o histórico e ignorar o pedido atual.",
        ],
        explanation:
          "Em um perfil híbrido, o motivo deste pedido orienta a classificação.",
      },
      {
        prompt:
          "O cliente pede desconto em uma proposta já enxuta. O que fazer?",
        correct:
          "Explicar o menor preço e perguntar se fechará caso haja revisão.",
        wrong: [
          "Prometer um desconto antes de falar com o diretor comercial.",
          "Alterar material sem explicar o que muda na proposta.",
          "Garantir que o diretor aprovará outra condição.",
        ],
        explanation: "Uma revisão pode ser pedida, mas não pode ser garantida.",
      },
      {
        prompt: "Como informar um prazo de produção ao cliente?",
        correct: "Confirmar o prazo com a produção antes de responder.",
        wrong: [
          "Prometer a data que o cliente prefere sem consultar a equipe.",
          "Usar um prazo de outro modelo como se fosse igual.",
          "Tratar uma estimativa antiga como compromisso confirmado.",
        ],
        explanation: "O prazo depende do modelo e da capacidade atual.",
      },
    ].map((item, index) => ({
      key: `pop-${index + 1}`,
      type: "best_response",
      prompt: item.prompt,
      points: 1,
      position: (index + 1) * 10,
      config: {
        explanation: item.explanation,
        options: [item.correct, ...item.wrong].map((text, optionIndex) => ({
          id: `q${index + 1}-option-${optionIndex + 1}`,
          text,
          correct: optionIndex === 0,
          feedback:
            optionIndex === 0
              ? `Esta resposta segue o ponto ${index + 1} do material.`
              : `Revise o ponto ${index + 1}: essa atitude pode levar a uma decisão sem confirmar os dados.`,
        })),
      },
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          result: {
            data: {
              json: {
                subjectTitle: "Treinamento E2E POP",
                subjectDescription: "Matéria de teste criada a partir de POP.",
                lessonTitle: "Aula E2E POP",
                lessonSummary: "Resumo para verificar a prévia.",
                lessonContent:
                  "Conteúdo de teste para uma aula ainda não publicada.",
                assessmentTitle: "Avaliação E2E POP",
                assessmentDescription: "Avaliação em rascunho para revisão.",
                questions,
                sourceFile: {
                  fileName: "Manual E2E.txt",
                  url: "https://utfs.io/f/e2e-pop-file",
                  fileKey: "e2e-pop-file",
                  mimeType: "text/plain",
                  sizeBytes: 36,
                },
              },
            },
          },
        },
      ]),
    });
  });

  await page.getByLabel("Arquivo POP").setInputFiles({
    name: "Manual E2E.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Material de referência de teste para a Escola."),
  });
  await expect(
    page.getByText(
      "O arquivo só será enviado quando você clicar em Gerar rascunho."
    )
  ).toBeVisible();
  expect(generationRequests).toBe(0);
  await page.locator("#pop-question-count").selectOption("5");
  await page.getByRole("button", { name: "Gerar rascunho" }).click();
  await expect(page.getByText("Rascunho pronto para revisar")).toBeVisible();
  expect(generationRequests).toBe(1);
  await expect(page.getByLabel("Nome da matéria")).toHaveValue(
    "Treinamento E2E POP"
  );
  await expect(
    page.getByText("5 perguntas · POP: Manual E2E.txt")
  ).toBeVisible();

  await page.getByRole("button", { name: "Salvar como rascunho" }).click();
  await expect(page.getByText(/salvas como rascunho/)).toBeVisible();
});
