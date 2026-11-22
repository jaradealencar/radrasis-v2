import { expect, test } from "@playwright/test";

test("revisa calendários e pausa/retoma a fila com 1.700 contatos fictícios", async ({ page }) => {
  await page.goto("/e2e-campanhas-whatsapp.html", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /prévia.*campanhas de whatsapp/i })).toBeVisible();

  const quadro = page.getByRole("region", { name: "Quadro Kanban das campanhas" });
  await expect(quadro).toBeVisible();
  await expect(page.getByTestId("kanban-coluna-revisar")).toContainText("Campanha PR");
  await expect(page.getByTestId("kanban-coluna-andamento")).toContainText("São Paulo 01");
  await expect(page.getByTestId("kanban-coluna-atencao")).toContainText("Acesso negado pela WTS.Chat");
  await expect(page.getByTestId("kanban-coluna-agendado")).toContainText("SP 02");
  await expect(page.getByTestId("kanban-coluna-concluido")).toContainText("Campanha Finalizada");
  await expect(page.getByTestId("campanha-card-101")).toContainText("3 de 17 lotes concluídos");
  await page.getByRole("button", { name: "Lista" }).click();

  const saoPaulo = page.getByRole("row").filter({ hasText: "São Paulo 01" });
  await expect(saoPaulo).toContainText("4º de 6");
  await expect(saoPaulo).toContainText("3 de 17 lotes concluídos");
  await expect(saoPaulo).toContainText("300 aceitos");
  await expect(saoPaulo).toContainText("1.400 pendentes");

  await saoPaulo.getByRole("button", { name: "Pausar fila" }).click();
  await expect(saoPaulo).toContainText("Pausado");
  await saoPaulo.getByRole("button", { name: "Retomar" }).click();
  await expect(saoPaulo).toContainText("Em andamento");
  await expect(saoPaulo).toContainText("3 de 17 lotes concluídos");

  await saoPaulo.getByRole("button", { name: "Calendário" }).click();
  const calendario = page.getByRole("dialog");
  await expect(calendario.getByText("6º envio")).toBeVisible();
  await expect(calendario.getByText("19/04/2027")).toBeVisible();
  await expect(calendario.getByRole("button", { name: "Revisar envio" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await saoPaulo.getByRole("button", { name: "Acompanhar" }).click();
  const revisao = page.getByRole("dialog");
  await expect(revisao).toContainText("São Paulo 01");
  await expect(revisao).toContainText("template-etapa-4");
  await expect(revisao).toContainText("5511999990000");
  await expect(revisao).toContainText("1.700");
  await page.keyboard.press("Escape");

  const pendente = page.getByRole("row").filter({ hasText: "Campanha PR" });
  await pendente.getByRole("button", { name: "Revisar envio" }).click();
  await expect(page.getByRole("dialog")).toContainText("250");
  await expect(page.getByRole("button", { name: /iniciar envio/i })).toBeEnabled();
  await page.getByRole("button", { name: /iniciar envio/i }).click();
  await expect(page.getByRole("dialog")).toContainText("100 aceitos");
  await page.keyboard.press("Escape");
  await expect(pendente).toContainText("Em andamento");
  await expect(pendente).toContainText("1 de 3 lotes concluídos");
});
