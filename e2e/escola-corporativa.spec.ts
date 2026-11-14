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
    page.getByRole("heading", { name: "Técnicas de Closer" })
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

  await expect(
    page.getByRole("heading", { name: "Painel dos alunos" })
  ).toBeVisible();
  await expect(page.getByText("E2E Instrutor", { exact: true })).toBeVisible();
  await expect(page.getByText("8.50/10", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ranking das provas formais" })
  ).toBeVisible();
  await expect(page.getByText(assessmentTitle, { exact: true })).toBeVisible();
});
