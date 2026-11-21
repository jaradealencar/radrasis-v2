import { expect, test } from "@playwright/test";

test("exibe margem e resultado de Novos e Reativados em cards separados", async ({ page }) => {
  await page.goto("/e2e-roi-marketing.html");

  const cards = [
    ["Margem de Contribuição — Novos", /R\$\s*1,0 mil/],
    ["Margem de Contribuição — Reativados", /R\$\s*500/],
    ["Resultado após Marketing — Novos", /900,00/],
    ["Resultado após Marketing — Reativados", /300,00/],
  ] as const;

  for (const [label, valor] of cards) {
    await expect(page.getByText(label, { exact: true }).last()).toBeVisible();
    const card = page.getByText(label, { exact: true }).last().locator("xpath=../../..");
    await expect(card).toContainText(valor);
  }

  await expect(page.getByText("Margem de Contribuição (Novos+Reativados)", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Resultado após Marketing", { exact: true })).toHaveCount(0);
});
