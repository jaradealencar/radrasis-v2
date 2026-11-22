import { expect, test } from "@playwright/test";
import XLSX from "xlsx";
import { configVisaoGeral, relatorioVisaoGeral } from "../../client/src/e2e/marketingDados";

const campanhas = {
  janelaDias: 30,
  topEstados: [
    { uf: "SP", receitaAtribuida: 12500.75, totalOs: 8, clientesConvertidos: 6 },
    { uf: "MT", receitaAtribuida: 8300, totalOs: 5, clientesConvertidos: 4 },
    { uf: "GO", receitaAtribuida: 4200.5, totalOs: 3, clientesConvertidos: 3 },
  ],
  totalOsAtribuidas: 17,
  receitaTotalAtribuida: 25001.25,
  vendasSemEstado: 1,
  receitaSemEstado: 900,
};

const novos = {
  clientesPrimeiraCompra: [
    { uf: "MT", clientes: 7 },
    { uf: "GO", clientes: 4 },
  ],
  totalClientesPrimeiraCompra: 12,
  clientesPrimeiraCompraSemUf: 1,
  propostasNovosClientes: [
    { uf: "MT", propostas: 5, clientes: 4 },
    { uf: "SP", propostas: 3, clientes: 3 },
  ],
  totalPropostasNovosClientes: 10,
  propostasNovosClientesSemUf: 2,
  fontesIndisponiveis: [],
};

const campanhas2025 = {
  janelaDias: 30,
  topEstados: [{ uf: "PR", receitaAtribuida: 4500, totalOs: 2, clientesConvertidos: 2 }],
  totalOsAtribuidas: 2,
  receitaTotalAtribuida: 4500,
  vendasSemEstado: 0,
  receitaSemEstado: 0,
};

const novos2025 = {
  clientesPrimeiraCompra: [{ uf: "RS", clientes: 3 }],
  totalClientesPrimeiraCompra: 3,
  clientesPrimeiraCompraSemUf: 0,
  propostasNovosClientes: [{ uf: "GO", propostas: 2, clientes: 2 }],
  totalPropostasNovosClientes: 2,
  propostasNovosClientesSemUf: 0,
  fontesIndisponiveis: ["cache de enderecos do ERP"],
};

function relatorioAno(ano: number) {
  const base = relatorioVisaoGeral.meses[0];
  const meses = Array.from({ length: ano === 2026 ? 11 : 12 }, (_, index) => {
    const mes = index + 1;
    return {
      ...base, mes, ano,
      novo: { ...base.novo, qtdClientesUnicos: mes, faturamento: mes * 100 },
    };
  });
  return { ...relatorioVisaoGeral, meses };
}

test("filtra todo o ROI pelos controles de Performance e pelo intervalo de análise", async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.clock.setFixedTime(new Date("2026-11-22T12:00:00Z"));
  await page.route("**/api/auth/get-session**", route => route.fulfill({ json: {
    session: { id: "sessao-teste", userId: "admin-teste", expiresAt: "2027-01-01T00:00:00Z" },
    user: { id: "admin-teste", name: "Admin de teste", email: "admin@example.test", role: "admin" },
  } }));
  const lancamentos: Array<{ ano?: number; mes?: number; investimentoAquisicao?: number; investimentoReativacao?: number }> = [];
  const inputsObservados: Array<{ procedure: string; dataInicial?: string; dataFinal?: string }> = [];
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = url.pathname.replace("/api/trpc/", "").split(",");
    const inputBatch: Record<string, { json?: { ano?: number; mes?: number; investimentoAquisicao?: number; dataInicial?: string; dataFinal?: string } }> =
      JSON.parse(url.searchParams.get("input") ?? route.request().postData() ?? "{}");
    const payloads = procedures.map((procedure, index) => {
      const input = inputBatch[String(index)]?.json ?? {};
      inputsObservados.push({ procedure, dataInicial: input.dataInicial, dataFinal: input.dataFinal });
      const novembro = input.dataInicial === "2026-11-01" && input.dataFinal === "2026-11-30";
      let result: unknown = null;
      switch (procedure) {
        case "permissions.myPermissions": result = []; break;
        case "marketingFinanceiro.getConfig": result = configVisaoGeral; break;
        case "marketingFinanceiro.getFiltrosDisponiveis": result = { vendedores: [], cidades: [] }; break;
        case "marketingFinanceiro.getRelatorioAno": result = relatorioAno(input.ano!); break;
        case "marketingFinanceiro.rankingEstadosCampanhas": result = novembro ? campanhas : campanhas2025; break;
        case "marketingFinanceiro.getDistribuicaoEstadosNovos": result = novembro ? novos : novos2025; break;
        case "financeiro.upsertCustoMarketing": lancamentos.push(input); result = { ok: true }; break;
      }
      return { result: { data: { json: result } } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads) });
  });

  await page.goto("/comercial/performance", { waitUntil: "commit" });
  await page.getByRole("button", { name: "Inteligência de Clientes" }).click();
  await page.getByRole("button", { name: "Crescimento e Resultado" }).click();
  await page.getByRole("tab", { name: "ROI Marketing" }).click();
  const roi = page.getByRole("tabpanel", { name: "ROI Marketing", exact: true });
  const competencia = roi.getByRole("combobox", { name: "Mês de referência" });
  await expect(competencia).toHaveValue("2026-11");
  await expect(roi.getByText(/Top 3 por receita.*01\/11\/2026 a 30\/11\/2026/)).toBeVisible();
  await expect(roi.getByText("Aquisição — Novembro/2026")).toBeVisible();
  await expect(page.getByText("Estados com melhor desempenho das campanhas")).toBeVisible();
  await expect(page.getByText("São Paulo (SP)").first()).toBeVisible();
  await expect(page.getByText(/12\.500,75/)).toBeVisible();
  await expect(page.getByText(/17 O\.S\. atribuídas no total/)).toBeVisible();

  await expect(page.getByText("Clientes de primeira compra por Estado")).toBeVisible();
  await expect(page.getByRole("row", { name: /Mato Grosso \(MT\) 7/ })).toBeVisible();
  await expect(page.getByText("Propostas de clientes novos por Estado")).toBeVisible();
  await expect(page.getByRole("cell", { name: "São Paulo (SP)" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Mato Grosso \(MT\) 5 4/ })).toBeVisible();
  await expect(page.getByText(/10 propostas no total/)).toBeVisible();
  await expect(page.getByText(/2 propostas sem UF confiável/)).toBeVisible();

  await page.getByRole("combobox", { name: "Mês da Performance Comercial" }).click();
  await page.getByRole("option", { name: "Outubro", exact: true }).click();
  await expect(page.getByLabel("Mês inicial do período de análise")).toHaveValue("10");
  await expect(page.getByLabel("Mês final do período de análise")).toHaveValue("10");
  await expect(competencia).toHaveValue("2026-10");
  await expect(roi.getByText(/Top 3 por receita.*01\/10\/2026 a 31\/10\/2026/)).toBeVisible();
  await expect(roi.getByText(/Distribuição comercial.*01\/10\/2026 a 31\/10\/2026/)).toBeVisible();
  const aquisicaoOutubro = roi.locator('[data-slot="card"]').filter({ hasText: "Aquisição — Outubro/2026" });
  await expect(aquisicaoOutubro.getByRole("row", { name: /Outubro \/ 2026.*1\.000,00/ })).toBeVisible();
  await expect(roi.getByRole("row", { name: /Novembro \/ 2026/ })).toHaveCount(0);
  await expect(page.getByText(/4\.500,00/)).toBeVisible();
  await expect(page.getByRole("row", { name: /Rio Grande do Sul \(RS\) 3/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /\(GO\) 2 2/ })).toBeVisible();
  await expect(page.getByText(/Fontes indispon/)).toBeVisible();
  await expect(page.getByText(/2 propostas no total/)).toBeVisible();

  await page.getByRole("button", { name: "2025", exact: true }).click();
  await expect(roi.getByText(/Top 3 por receita.*01\/01\/2025 a 31\/12\/2025/)).toBeVisible();
  await expect(competencia.getByRole("option")).toHaveCount(12);
  await page.getByLabel("Mês inicial do período de análise").selectOption("12");
  await page.getByLabel("Ano final do período de análise").selectOption("2026");
  await page.getByLabel("Mês final do período de análise").selectOption("1");
  await expect(roi.getByText(/Top 3 por receita.*01\/12\/2025 a 31\/01\/2026/)).toBeVisible();
  await expect(roi.getByText(/Distribuição comercial.*01\/12\/2025 a 31\/01\/2026/)).toBeVisible();
  await expect(roi.getByText("Aquisição — Dezembro/2025 a Janeiro/2026")).toBeVisible();
  await expect(roi.getByRole("row", { name: /Dezembro \/ 2025/ })).toHaveCount(3);
  await expect(roi.getByRole("row", { name: /Janeiro \/ 2026/ })).toHaveCount(3);
  await expect(roi.getByRole("row", { name: /Fevereiro \/ 2026/ })).toHaveCount(0);
  const aquisicaoIntervalo = roi.locator('[data-slot="card"]').filter({ hasText: "Aquisição — Dezembro/2025 a Janeiro/2026" });
  await expect(aquisicaoIntervalo.getByRole("row", { name: /Total.*2\/2 meses/ })).toContainText("1.300,00");
  await expect(competencia.getByRole("option")).toHaveCount(2);
  await competencia.selectOption("2025-12");
  await roi.getByLabel("Valor investido em aquisição").fill("123,45");
  await roi.getByRole("button", { name: "Salvar e calcular CAC" }).click();
  await expect.poll(() => lancamentos).toEqual([{ ano: 2025, mes: 12, investimentoAquisicao: 123.45 }]);
  const reativacaoIntervalo = roi.locator('[data-slot="card"]').filter({ hasText: "Reativação — Dezembro/2025 a Janeiro/2026" });
  await reativacaoIntervalo.getByRole("row", { name: /Dezembro \/ 2025/ }).getByRole("button").click();
  const campoReativacao = reativacaoIntervalo.getByLabel("Investimento de reativação em Dezembro / 2025");
  await campoReativacao.fill("40,50");
  await campoReativacao.press("Enter");
  await expect.poll(() => lancamentos[1]).toEqual({ ano: 2025, mes: 12, investimentoReativacao: 40.5 });

  const baixar = page.waitForEvent("download");
  await roi.getByRole("button", { name: "Exportar Excel do período" }).click();
  const arquivo = await baixar;
  expect(arquivo.suggestedFilename()).toBe("roi-marketing-2025-12-a-2026-01.xlsx");
  const livro = XLSX.readFile((await arquivo.path())!);
  const linhas = XLSX.utils.sheet_to_json<{ Mês: string; Ano: number }>(livro.Sheets[livro.SheetNames[0]]);
  expect(linhas.map(linha => [linha.Mês, linha.Ano])).toEqual([["Dezembro", 2025], ["Janeiro", 2026]]);
  for (const procedure of ["marketingFinanceiro.rankingEstadosCampanhas", "marketingFinanceiro.getDistribuicaoEstadosNovos"]) {
    expect(inputsObservados).toEqual(expect.arrayContaining([
      { procedure, dataInicial: "2026-10-01", dataFinal: "2026-10-31" },
      { procedure, dataInicial: "2025-12-01", dataFinal: "2026-01-31" },
    ]));
  }
});
