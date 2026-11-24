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
    { uf: "MT", clientes: 7, os: 10, faturamento: 42000, ticketMedioPorCliente: 6000, clientesComPropostaAntesDaCompra: 4, propostasAntesDaCompra: 5, valorPropostasAntesDaCompra: 14200 },
    { uf: "GO", clientes: 4, os: 6, faturamento: 22000.2, ticketMedioPorCliente: 5500.05, clientesComPropostaAntesDaCompra: 2, propostasAntesDaCompra: 3, valorPropostasAntesDaCompra: 8200 },
  ],
  totalClientesPrimeiraCompra: 12,
  clientesPrimeiraCompraSemUf: 1,
  totalOsPrimeiraCompra: 17,
  faturamentoPrimeiraCompra: 66200.2,
  osPrimeiraCompraSemUf: 1,
  faturamentoPrimeiraCompraSemUf: 1200,
  clientesComPropostaAntesDaCompraSemUf: 0,
  propostasAntesDaCompraSemUf: 0,
  valorPropostasAntesDaCompraSemUf: 0,
  clientesComPropostaAntesDaCompra: 6,
  totalPropostasAntesDaCompra: 8,
  valorPropostasAntesDaCompra: 22400,
  propostasNovosClientes: [
    { uf: "MT", propostas: 5, clientes: 4, clientesConvertidos: 2, valorPropostas: 9000, propostasSemValor: 0 },
    { uf: "SP", propostas: 3, clientes: 3, clientesConvertidos: 1, valorPropostas: 22000, propostasSemValor: 0 },
  ],
  totalPropostasNovosClientes: 10,
  valorPropostasNovosClientes: 33000,
  propostasNovosClientesSemUf: 2,
  valorPropostasNovosClientesSemUf: 1500,
  propostasNovosClientesSemValor: 1,
  propostasNovosClientesComUfSemValor: 1,
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
  clientesPrimeiraCompra: [{ uf: "RS", clientes: 3, os: 4, faturamento: 4500, ticketMedioPorCliente: 1500, clientesComPropostaAntesDaCompra: 1, propostasAntesDaCompra: 2, valorPropostasAntesDaCompra: 2400 }],
  totalClientesPrimeiraCompra: 3,
  clientesPrimeiraCompraSemUf: 0,
  totalOsPrimeiraCompra: 4,
  faturamentoPrimeiraCompra: 4500,
  osPrimeiraCompraSemUf: 0,
  faturamentoPrimeiraCompraSemUf: 0,
  clientesComPropostaAntesDaCompraSemUf: 0,
  propostasAntesDaCompraSemUf: 0,
  valorPropostasAntesDaCompraSemUf: 0,
  clientesComPropostaAntesDaCompra: 1,
  totalPropostasAntesDaCompra: 2,
  valorPropostasAntesDaCompra: 2400,
  propostasNovosClientes: [{ uf: "GO", propostas: 2, clientes: 2, clientesConvertidos: 1, valorPropostas: 7200, propostasSemValor: 0 }],
  totalPropostasNovosClientes: 2,
  valorPropostasNovosClientes: 7200,
  propostasNovosClientesSemUf: 0,
  valorPropostasNovosClientesSemUf: 0,
  propostasNovosClientesSemValor: 0,
  propostasNovosClientesComUfSemValor: 0,
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

test("mantém CAC/ROI anual enquanto os relatórios por Estado seguem o período global", async ({ page }) => {
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
  await expect(roi.getByText("Aquisição — Janeiro a Dezembro/2026")).toBeVisible();
  const aquisicaoAno = roi.locator('[data-slot="card"]').filter({ hasText: "Aquisição — Janeiro a Dezembro/2026" });
  await expect(aquisicaoAno.getByRole("row", { name: /Janeiro \/ 2026/ })).toBeVisible();
  await expect(aquisicaoAno.getByRole("row", { name: /Novembro \/ 2026/ })).toBeVisible();
  const reativacaoAno = roi.locator('[data-slot="card"]').filter({ hasText: "Reativação — Janeiro a Dezembro/2026" });
  await expect(reativacaoAno.getByRole("row", { name: /Janeiro \/ 2026/ })).toBeVisible();
  await expect(reativacaoAno.getByRole("row", { name: /Novembro \/ 2026/ })).toBeVisible();
  await expect(page.getByText("Estados com melhor desempenho das campanhas")).toBeVisible();
  await expect(page.getByText("São Paulo (SP)").first()).toBeVisible();
  await expect(page.getByText(/12\.500,75/)).toBeVisible();
  await expect(page.getByText(/17 O\.S\. atribuídas no total/)).toBeVisible();

  await expect(page.getByText("Desempenho de novos clientes por Estado")).toBeVisible();
  const tabelaEstados = roi.locator('[data-slot="card"]').filter({ hasText: "Desempenho de novos clientes por Estado" });
  const linhaMt = tabelaEstados.getByRole("row", { name: /Mato Grosso \(MT\)/ });
  // MT: 7 novos clientes, 5 propostas, 10 O.S., faturamento 42.000,00, 2 convertidos, valor cotado 9.000,00, conversão 40,0%
  await expect(linhaMt.getByRole("cell").nth(1)).toHaveText("7");
  await expect(linhaMt.getByRole("cell").nth(2)).toHaveText("5");
  await expect(linhaMt.getByRole("cell").nth(3)).toHaveText("10");
  await expect(linhaMt.getByRole("cell").nth(4)).toContainText("42.000,00");
  await expect(linhaMt.getByRole("cell").nth(5)).toHaveText("2");
  await expect(linhaMt.getByRole("cell").nth(6)).toContainText("9.000,00");
  await expect(linhaMt.getByRole("cell").nth(7)).toHaveText("40.0%");
  const linhaGo = tabelaEstados.getByRole("row", { name: /Goiás \(GO\)/ });
  // GO: 4 novos clientes, 3 propostas, 6 O.S., faturamento 22.000,20, 0 convertidos, valor cotado 0,00, conversão 0,0%
  await expect(linhaGo.getByRole("cell").nth(1)).toHaveText("4");
  await expect(linhaGo.getByRole("cell").nth(2)).toHaveText("3");
  await expect(linhaGo.getByRole("cell").nth(3)).toHaveText("6");
  await expect(linhaGo.getByRole("cell").nth(4)).toContainText("22.000,20");
  await expect(linhaGo.getByRole("cell").nth(5)).toHaveText("0");
  await expect(linhaGo.getByRole("cell").nth(6)).toContainText("0,00");
  await expect(linhaGo.getByRole("cell").nth(7)).toHaveText("0.0%");
  const linhaSp = tabelaEstados.getByRole("row", { name: /São Paulo \(SP\)/ });
  // SP: 0 novos clientes, 3 propostas, 0 O.S., faturamento 0,00, 1 convertido, valor cotado 22.000,00, conversão 33,3%
  await expect(linhaSp.getByRole("cell").nth(1)).toHaveText("0");
  await expect(linhaSp.getByRole("cell").nth(2)).toHaveText("3");
  await expect(linhaSp.getByRole("cell").nth(3)).toHaveText("0");
  await expect(linhaSp.getByRole("cell").nth(4)).toContainText("0,00");
  await expect(linhaSp.getByRole("cell").nth(5)).toHaveText("1");
  await expect(linhaSp.getByRole("cell").nth(6)).toContainText("22.000,00");
  await expect(linhaSp.getByRole("cell").nth(7)).toHaveText("33.3%");
  const linhaTotal = tabelaEstados.getByRole("row", { name: /^Total/ });
  await expect(linhaTotal.getByRole("cell").nth(1)).toHaveText("12");
  await expect(linhaTotal.getByRole("cell").nth(2)).toHaveText("10");
  await expect(linhaTotal.getByRole("cell").nth(3)).toHaveText("17");
  await expect(linhaTotal.getByRole("cell").nth(4)).toContainText("66.200,20");
  await expect(linhaTotal.getByRole("cell").nth(5)).toHaveText("6");
  await expect(linhaTotal.getByRole("cell").nth(6)).toContainText("33.000,00");
  await expect(linhaTotal.getByRole("cell").nth(7)).toHaveText("60.0%");
  await expect(page.getByText(/taxas por UF são independentes/i)).toBeVisible();
  const resumo = tabelaEstados.locator("p").last();
  await expect(resumo).toContainText("10 propostas");
  await expect(resumo).toContainText("33.000,00");
  await expect(resumo).toContainText("última sincronização do histórico");
  await expect(resumo).toContainText("2 propostas");
  await expect(resumo).toContainText("1 proposta sem valor disponível");

  await page.getByRole("combobox", { name: "Mês da Performance Comercial" }).click();
  await page.getByRole("option", { name: "Outubro", exact: true }).click();
  await expect(page.getByLabel("Mês inicial do período de análise")).toHaveValue("10");
  await expect(page.getByLabel("Mês final do período de análise")).toHaveValue("10");
  await expect(competencia).toHaveValue("2026-11");
  await expect(roi.getByText(/Top 3 por receita.*01\/10\/2026 a 31\/10\/2026/)).toBeVisible();
  await expect(roi.getByText(/Desempenho de clientes.*01\/10\/2026 a 31\/10\/2026/)).toBeVisible();
  const aquisicaoOutubro = roi.locator('[data-slot="card"]').filter({ hasText: "Aquisição — Janeiro a Dezembro/2026" });
  await expect(aquisicaoOutubro.getByRole("row", { name: /Outubro \/ 2026.*1\.000,00/ })).toBeVisible();
  await expect(aquisicaoOutubro.getByRole("row", { name: /Novembro \/ 2026/ })).toBeVisible();
  await expect(reativacaoAno.getByRole("row", { name: /Novembro \/ 2026/ })).toBeVisible();
  const vendasOutubroPorEstado = tabelaEstados;
  await expect(vendasOutubroPorEstado.getByRole("row", { name: /Rio Grande do Sul \(RS\)/ })).toContainText("4.500,00");
  const propostasGo2025 = page.getByRole("row", { name: /\(GO\)/ });
  await expect(propostasGo2025).toContainText("7.200,00");
  await expect(propostasGo2025).toContainText("1");
  await expect(propostasGo2025).toContainText("50.0%");
  await expect(page.getByText(/Fontes indispon/)).toBeVisible();
  const resumoPipeline2025 = vendasOutubroPorEstado.locator("p").last();
  await expect(resumoPipeline2025).toContainText("2 propostas");
  await expect(resumoPipeline2025).toContainText("7.200,00");

  await page.getByRole("button", { name: "2025", exact: true }).click();
  await expect(roi.getByText(/Top 3 por receita.*01\/01\/2025 a 31\/12\/2025/)).toBeVisible();
  await expect(competencia.getByRole("option")).toHaveCount(12);
  await page.getByLabel("Mês inicial do período de análise").selectOption("12");
  await page.getByLabel("Ano final do período de análise").selectOption("2026");
  await page.getByLabel("Mês final do período de análise").selectOption("1");
  await expect(roi.getByText(/Top 3 por receita.*01\/12\/2025 a 31\/01\/2026/)).toBeVisible();
  await expect(roi.getByText(/Desempenho de clientes.*01\/12\/2025 a 31\/01\/2026/)).toBeVisible();
  await expect(roi.getByText("Aquisição — Janeiro a Dezembro/2026")).toBeVisible();
  await expect(roi.getByRole("row", { name: /Dezembro \/ 2025/ })).toHaveCount(0);
  await expect(roi.getByRole("row", { name: /Janeiro \/ 2026/ })).toHaveCount(3);
  await expect(roi.getByRole("row", { name: /Novembro \/ 2026/ })).toHaveCount(3);
  await expect(roi.getByRole("row", { name: /Dezembro \/ 2026/ })).toHaveCount(0);
  await expect(competencia.getByRole("option")).toHaveCount(11);
  await competencia.selectOption("2026-01");
  await roi.getByLabel("Valor investido em aquisição").fill("123,45");
  await roi.getByRole("button", { name: "Salvar e calcular CAC" }).click();
  await expect.poll(() => lancamentos).toEqual([{ ano: 2026, mes: 1, investimentoAquisicao: 123.45 }]);
  const reativacaoIntervalo = roi.locator('[data-slot="card"]').filter({ hasText: "Reativação — Janeiro a Dezembro/2026" });
  await reativacaoIntervalo.getByRole("row", { name: /Janeiro \/ 2026/ }).getByRole("button").click();
  const campoReativacao = reativacaoIntervalo.getByLabel("Investimento de reativação em Janeiro / 2026");
  await campoReativacao.fill("40,50");
  await campoReativacao.press("Enter");
  await expect.poll(() => lancamentos[1]).toEqual({ ano: 2026, mes: 1, investimentoReativacao: 40.5 });

  const baixar = page.waitForEvent("download");
  await roi.getByRole("button", { name: "Exportar Excel do período" }).click();
  const arquivo = await baixar;
  expect(arquivo.suggestedFilename()).toBe("roi-marketing-2026-01-a-2026-12.xlsx");
  const livro = XLSX.readFile((await arquivo.path())!);
  const linhas = XLSX.utils.sheet_to_json<{ Mês: string; Ano: number }>(livro.Sheets[livro.SheetNames[0]]);
  expect(linhas).toHaveLength(11);
  expect(linhas.map(linha => [linha.Mês, linha.Ano])).toEqual([
    ["Janeiro", 2026], ["Fevereiro", 2026], ["Março", 2026], ["Abril", 2026], ["Maio", 2026],
    ["Junho", 2026], ["Julho", 2026], ["Agosto", 2026], ["Setembro", 2026], ["Outubro", 2026], ["Novembro", 2026],
  ]);
  for (const procedure of ["marketingFinanceiro.rankingEstadosCampanhas", "marketingFinanceiro.getDistribuicaoEstadosNovos"]) {
    expect(inputsObservados).toEqual(expect.arrayContaining([
      { procedure, dataInicial: "2026-10-01", dataFinal: "2026-10-31" },
      { procedure, dataInicial: "2025-12-01", dataFinal: "2026-01-31" },
    ]));
  }
});
