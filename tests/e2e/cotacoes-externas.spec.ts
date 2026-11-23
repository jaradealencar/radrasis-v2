import { expect, test } from "@playwright/test";

type CotacaoExternaFornecedor = {
  id: number;
  cnpj: string;
  nomeFantasia: string;
  razaoSocial?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
  jaTrabalhamos: boolean;
  criadoPor?: string | null;
  createdAt: string;
  updatedAt: string;
  itens: Array<{
    id: number;
    codigoFornecedor?: string | null;
    descricao: string;
    unidade: string;
    precoUnitario: number;
    precoTotal?: number | null;
    quantidade?: number | null;
    dataCotacao?: string | null;
    validadeDias?: number | null;
    condicaoPagamento?: string | null;
    prazoEntrega?: string | null;
    arquivoOrigemUrl?: string | null;
    materiaPrimaId?: number | null;
    vinculadoAoItemNf: boolean;
    criadoPor?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

/** Mocka as chamadas tRPC do router cotacoesExternas via interceptação de rede. */
function mockTrpc(page: import("@playwright/test").Page, state: { cotacoes: CotacaoExternaFornecedor[] }) {
  page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    let procedimentos: string[];
    let entradaRaw: string;

    if (method === "GET") {
      procedimentos = url.pathname.replace("/api/trpc/", "").split(",");
      entradaRaw = url.searchParams.get("input") ?? "[]";
    } else {
      procedimentos = url.pathname.replace("/api/trpc/", "").split(",");
      entradaRaw = (route.request().postData() ?? "{}");
    }

    let entrada: any[];
    try {
      entrada = JSON.parse(entradaRaw);
    } catch {
      entrada = [];
    }

    const respostas = procedimentos.map((procedimento, indice) => {
      const dados = entrada[indice]?.json ?? {};

      if (procedimento === "cotacoesExternas.listarFornecedores") {
        return { result: { data: { json: state.cotacoes } } };
      }

      if (procedimento === "cotacoesExternas.criarFornecedor") {
        const novo: CotacaoExternaFornecedor = {
          id: state.cotacoes.length + 1,
          cnpj: dados.cnpj,
          nomeFantasia: dados.nomeFantasia,
          razaoSocial: dados.razaoSocial ?? null,
          telefone: dados.telefone ?? null,
          email: dados.email ?? null,
          cidade: dados.cidade ?? null,
          estado: dados.estado ?? null,
          observacoes: dados.observacoes ?? null,
          jaTrabalhamos: dados.jaTrabalhamos ?? false,
          criadoPor: "e2e",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          itens: [],
        };
        state.cotacoes.push(novo);
        return { result: { data: { json: { fornecedorId: novo.id, ok: true } } } };
      }

      return { result: { data: { json: null } } };
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(respostas),
    });
  });
}

test("lista cotações externas vazia inicialmente", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));

  mockTrpc(page, { cotacoes: [] });
  await page.goto("/e2e-cotacoes-externas.html", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByText("Nenhuma cotação externa cadastrada ainda.")
  ).toBeVisible();
  expect(erros).toEqual([]);
});

test("cadastra cotação de empresa nova e exibe na lista", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));

  const estado = { cotacoes: [] as CotacaoExternaFornecedor[] };
  mockTrpc(page, estado);

  await page.goto("/e2e-cotacoes-externas.html", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /Nova Cotação Externa/ }).click();

  await page.getByLabel(/CNPJ/).fill("11.222.333/0001-44");
  await page.getByLabel(/Nome Fantasia/).fill("FORNECEDOR NOVO LTDA");
  await page.getByLabel(/Razão Social/).fill("Fornecedor Novo LTDA");
  await page.getByLabel(/Cidade/).fill("São Paulo");
  await page.getByLabel(/Estado/).fill("SP");
  // Empresa que NUNCA trabalhamos — deixa o checkbox desmarcado

  await page.getByRole("button", { name: /Salvar Cotação/ }).click();

  // Deve aparecer na lista com selo de empresa nova
  await expect(page.getByText("FORNECEDOR NOVO LTDA")).toBeVisible();
  await expect(page.getByText("11.222.333/0001-44")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Empresa nova/ })
  ).toBeVisible();
  expect(erros).toEqual([]);
});

test("exibe KPIs de fornecedores cadastrados e empresas novas", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));

  mockTrpc(page, {
    cotacoes: [
      {
        id: 1,
        cnpj: "11.222.333/0001-44",
        nomeFantasia: "FORNECEDOR A LTDA",
        razaoSocial: "Fornecedor A LTDA",
        cidade: "São Paulo",
        estado: "SP",
        jaTrabalhamos: false,
        criadoPor: "e2e",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itens: [
          {
            id: 1,
            descricao: "Chapa Inox 430 1,00mm",
            unidade: "KG",
            precoUnitario: 28.5,
            precoTotal: 285,
            quantidade: 10,
            dataCotacao: "2026-01-15",
            vinculadoAoItemNf: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      {
        id: 2,
        cnpj: "22.333.444/0001-55",
        nomeFantasia: "FORNECEDOR B LTDA",
        jaTrabalhamos: true,
        criadoPor: "e2e",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itens: [],
      },
    ],
  });

  await page.goto("/e2e-cotacoes-externas.html", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("FORNECEDOR A LTDA")).toBeVisible();
  await expect(page.getByText("R$ 28,50")).toBeVisible();
  expect(erros).toEqual([]);
});
