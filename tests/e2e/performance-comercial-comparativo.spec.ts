import { expect, test } from "@playwright/test";

function dadosAno(ano: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const mes = index + 1;
    const base = ano === new Date().getFullYear() - 1 ? 500 : 1000;
    return {
      label: `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][index]}/${String(ano).slice(-2)}`,
      mes,
      ano,
      cotacoes: base + mes,
      osGeradas: base / 10 + mes,
      taxaConversao: ano === 2025 ? 10 + mes : 20 + mes,
      valorOrcado: base * 1000 + mes,
      faturamento: base * 100 + mes,
      taxaFaturamento: ano === 2025 ? 5 + mes : 15 + mes,
      ticketMedio: base + mes * 10,
    };
  });
}

test("compara cada mês do ano atual com o mesmo mês do ano anterior e remove Mês Vigente", async ({ page }) => {
  const anoAtual = new Date().getFullYear();
  const anoAnterior = anoAtual - 1;

  await page.route("**/api/auth/**", route => route.fulfill({ status: 200, json: null }));
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = url.pathname.replace("/api/trpc/", "").split(",");
    const input = JSON.parse(url.searchParams.get("input") ?? "{}");
    const payloads = procedures.map((procedure, index) => {
      const argument = input[String(index)]?.json ?? {};
      let result: unknown = null;

      if (procedure.endsWith("getAno")) {
        result = dadosAno(argument.ano);
      } else if (procedure.endsWith("getMes")) {
        result = {
          cotacoes: 0, osGeradas: 0, taxaConversao: 0, valorOrcado: 0,
          faturamento: 0, taxaFaturamento: 0, ticketMedio: 0, custo: 0,
          resultado: 0, margemPct: 0, porVendedor: [],
        };
      } else if (procedure.endsWith("getResumoSilencioPropostas")) {
        result = { semContato: 0, totalAltoValor: 0, taxaSilencio: 0 };
      } else if (procedure.endsWith("getClientesNovos")) {
        result = { totalPuros: 0, totalReativados: 0, lista: [] };
      } else if (procedure.endsWith("getPropostasAltoValor")) {
        result = { propostas: [], orcamentosDesde: null };
      } else if (procedure.endsWith("getAuditoria")) {
        result = null;
      } else if (procedure.endsWith("getMultiMes")) {
        result = [];
      } else if (procedure.endsWith("getMetas") || procedure.endsWith("getClientesNovosAno") || procedure.endsWith("listClienteOverrides")) {
        result = [];
      } else if (procedure.endsWith("getContatados") || procedure.endsWith("whatsappImagem.get")) {
        result = {};
      } else {
        throw new Error(`Procedure tRPC inesperada no teste: ${procedure}`);
      }

      return { result: { data: { json: result } } };
    });

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads) });
  });

  await page.goto("/e2e-performance-comercial.html", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(`Comparativo Anual — ${anoAtual} (todos os meses)`)).toBeVisible();
  const janeiro = page.locator("tbody tr").filter({ hasText: `Jan/${String(anoAtual).slice(-2)}` });
  await expect(janeiro).toBeVisible();
  await expect(janeiro.locator("td").nth(1)).toContainText(`${anoAnterior}: 501`);
  await expect(janeiro.locator("td").nth(1)).toContainText("1.001");
  await expect(page.getByRole("button", { name: "Mês Vigente" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Inteligência de Clientes" })).toBeVisible();
});
