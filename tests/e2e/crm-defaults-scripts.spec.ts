import { expect, test } from "@playwright/test";

type Script = { id: number; faixa: number; titulo: string; conteudo: string; conteudo_voz: string };

async function configurarApiCrm(page: import("@playwright/test").Page) {
  let script: Script | null = null;
  const chamadasGetPropostas: Array<{ dataInicio?: string; dataFim?: string }> = [];

  await page.route("**/api/auth/**", route => route.fulfill({ status: 200, json: null }));
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedimentos = url.pathname.replace("/api/trpc/", "").split(",");
    const entradaRaw = url.searchParams.get("input") ?? route.request().postData() ?? "{}";
    const entrada = JSON.parse(entradaRaw) as Record<string, { json?: Record<string, unknown> }>;
    const respostas = procedimentos.map((procedimento, indice) => {
      const dadosEntrada = entrada[String(indice)]?.json ?? {};
      let dados: unknown;

      if (procedimento.endsWith("getPropostas")) {
        chamadasGetPropostas.push({
          dataInicio: dadosEntrada.dataInicio as string | undefined,
          dataFim: dadosEntrada.dataFim as string | undefined,
        });
        dados = { propostas: [], stats: {} };
      } else if (
        procedimento.endsWith("getVendedores") ||
        procedimento.endsWith("midiasBiblioteca.list")
      ) {
        dados = [];
      } else if (procedimento.endsWith("getSugestoesContato")) {
        dados = { sugestoes: [] };
      } else if (procedimento.endsWith("getFaixaEtiquetas")) {
        dados = {
          1: { label: "Faixa 1", diasInicio: 1, diasFim: 2 },
          2: { label: "Faixa 2", diasInicio: 3, diasFim: 5 },
          3: { label: "Faixa 3", diasInicio: 6, diasFim: 10 },
        };
      } else if (procedimento.endsWith("getAuditoria")) {
        dados = {
          periodo: { inicio: "2026-11-21", fim: "2026-11-21" },
          vendedorFiltro: null,
          dias: [],
          vendedores: [],
          blocoA: [], blocoB: [], blocoC: [], blocoD: [], blocoE: [], blocoF: [], blocoG: "", blocoH: [],
          resumoExclusoes: { total: 0, comTodasFaixas: 0, semNenhumaFaixa: 0 },
        };
      } else if (procedimento.endsWith("listScripts")) {
        dados = script ? [script] : [];
      } else if (procedimento.endsWith("addScript")) {
        const titulo = String(dadosEntrada.titulo ?? "");
        const conteudo = String(dadosEntrada.conteudo ?? "");
        if (!titulo || !conteudo) throw new Error("addScript recebeu título ou texto vazio");
        script = { id: 1, faixa: Number(dadosEntrada.faixa ?? 0), titulo, conteudo, conteudo_voz: "" };
        dados = { id: script.id };
      } else {
        dados = [];
      }

      return { result: { data: { json: dados } } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(respostas) });
  });

  return chamadasGetPropostas;
}

test("abre o CRM com as cotações dos últimos 10 dias", async ({ page }) => {
  const chamadas = await configurarApiCrm(page);
  const errosPagina: string[] = [];
  page.on("pageerror", error => errosPagina.push(error.message));
  await page.goto("/e2e-crm.html");
  await page.waitForLoadState("networkidle");
  const esperado = await page.evaluate(() => {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 9);
    const chave = (data: Date) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    return [chave(inicio), chave(hoje)];
  });

  await expect(page.getByRole("heading", { name: "CRM de Propostas" })).toBeVisible();
  expect(errosPagina).toEqual([]);
  await expect.poll(() => chamadas.find(chamada => chamada.dataInicio && chamada.dataFim)).toEqual({
    dataInicio: esperado[0],
    dataFim: esperado[1],
  });
});

test("salva um script de vendas e o mostra na etapa escolhida", async ({ page }) => {
  await configurarApiCrm(page);
  await page.goto("/e2e-crm.html?scripts", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Novo script" }).click();
  await page.getByLabel("Título", { exact: true }).fill("Retorno após orçamento");
  await page.getByLabel("Texto do script").fill("Olá, conseguiu revisar a proposta?");
  await page.getByRole("button", { name: "Salvar script" }).click();

  await expect(page.getByText("Retorno após orçamento", { exact: true })).toBeVisible();
  await expect(page.getByText("Olá, conseguiu revisar a proposta?")).toBeVisible();
});
