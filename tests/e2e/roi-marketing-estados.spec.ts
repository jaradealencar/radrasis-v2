import { expect, test } from "@playwright/test";

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

test("mostra UFs, contagens e receita das campanhas e dos novos clientes", async ({ page }) => {
  const inputsObservados: Array<{ procedure: string; dataInicial?: string; dataFinal?: string }> = [];
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = url.pathname.replace("/api/trpc/", "").split(",");
    const inputBatch: Record<string, { json?: { dataInicial?: string; dataFinal?: string } }> = JSON.parse(url.searchParams.get("input") ?? "{}");
    const payloads = procedures.map((procedure, index) => {
      const input = inputBatch[String(index)]?.json ?? {};
      inputsObservados.push({ procedure, dataInicial: input.dataInicial, dataFinal: input.dataFinal });
      const periodo2025 = input.dataInicial === "2025-01-01" && input.dataFinal === "2025-12-31";
      const result = procedure.endsWith("rankingEstadosCampanhas") ? (periodo2025 ? campanhas2025 : campanhas)
        : procedure.endsWith("getDistribuicaoEstadosNovos") ? (periodo2025 ? novos2025 : novos)
          : null;
      if (result == null) throw new Error(`Procedure tRPC inesperada no teste: ${procedure}`);
      return { result: { data: { json: result } } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads) });
  });

  await page.goto("/e2e-roi-marketing.html", { waitUntil: "commit" });
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

  await page.getByRole("button", { name: "2025" }).click();
  await expect(page.getByText(/4\.500,00/)).toBeVisible();
  await expect(page.getByRole("row", { name: /Rio Grande do Sul \(RS\) 3/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /\(GO\) 2 2/ })).toBeVisible();
  await expect(page.getByText(/Fontes indispon/)).toBeVisible();
  await expect(page.getByText(/2 propostas no total/)).toBeVisible();

  expect(inputsObservados).toEqual(expect.arrayContaining([
    { procedure: expect.stringContaining("rankingEstadosCampanhas"), dataInicial: "2025-01-01", dataFinal: "2025-12-31" },
    { procedure: expect.stringContaining("getDistribuicaoEstadosNovos"), dataInicial: "2025-01-01", dataFinal: "2025-12-31" },
  ]));
});
