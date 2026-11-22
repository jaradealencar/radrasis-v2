import { expect, test } from "@playwright/test";

test("visualiza a fila fictícia e percorre acompanhar, pausar, retomar e iniciar", async ({ page }) => {
  await page.goto("/e2e-campanhas-whatsapp.html");

  await expect(page.getByRole("heading", { name: "Prévia · campanhas de WhatsApp" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar alertas do navegador" })).toBeVisible();
  await expect(page.getByText("3 de 17 lotes concluídos")).toBeVisible();
  const linhaCampanhaEmAndamento = page.getByRole("row", { name: /São Paulo 01/ });
  await expect(linhaCampanhaEmAndamento).toContainText(
    "300 aceitos · 1.400 pendentes · 0 incertos · 0 falhas"
  );

  await page.getByRole("checkbox", { name: "Restringir envios a dias e horários" }).check();
  await expect(page.getByLabel("Início")).toHaveValue("09:00");
  await expect(page.getByRole("button", { name: "Seg" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Acompanhar" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("São Paulo 01");
  await expect(dialog).toContainText("template-etapa-4");
  await expect(dialog).toContainText("1.700");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Pausar fila" }).first().click();
  await expect(page.getByRole("button", { name: "Retomar" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Retomar" }).first().click();
  await expect(page.getByRole("button", { name: "Pausar fila" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Revisar envio" }).click();
  await expect(dialog).toContainText("Campanha PR");
  await expect(dialog).toContainText("250");
  await expect(dialog).toContainText("Duração estimada");
  await expect(dialog).toContainText("23 min");
  await expect(dialog.getByRole("button", { name: /Iniciar envio/ })).toBeEnabled();
  await dialog.getByRole("button", { name: /Iniciar envio/ }).click();
  await expect(page.getByText("Fila iniciada em segundo plano.")).toBeVisible();
  await expect(dialog).toContainText("Campanha PR");
});
