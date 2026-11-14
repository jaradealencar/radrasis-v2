import { expect, test, type Route } from "@playwright/test";

const propostaBase = {
  nomeCliente: "Cliente aberto de teste",
  nomeContato: "Contato de teste",
  vendedor: "Vendedora de teste",
  valor: 250,
  dataCriacao: new Date().toISOString(),
  diasAberto: 2,
  janela: "urgente",
  clienteNovo: false,
  contato1: null,
  contato2: null,
  qtdContatos: 0,
  contato1NoPrazo: null,
  meta2Contatos: false,
  probabilidadeCompra: null,
  probabilidadeExplicacao: ["Sem amostra de treino no ambiente de teste."],
  qtdComprasCliente: 0,
  diasSemComprar: null,
  ultimaCompraEm: null,
  totalCotacoes: 1,
  totalCompras: 0,
  orcamentosFechados: 0,
  taxaConversao: 0,
  orcamentosDesde: null,
  estadoCliente: null,
};

const propostasAbertas = [
  {
    ...propostaBase,
    id: "erp-30001",
    sequencial: 30001,
    nomeCliente: "Proposta aberta sem contatos",
  },
  {
    ...propostaBase,
    id: "erp-30002",
    sequencial: 30002,
    nomeCliente: "Proposta aberta com dois contatos",
    contato1: {
      data: new Date(Date.now() - 86_400_000).toISOString(),
      canal: "nao_retornou",
      obs: null,
    },
    contato2: {
      data: new Date().toISOString(),
      canal: "aguardando_resposta",
      obs: null,
    },
    qtdContatos: 2,
    meta2Contatos: true,
  },
];

const crmData = {
  propostas: propostasAbertas,
  stats: {
    totalAberto: propostasAbertas.length,
    totalFechado: 0,
    valorFechado: 0,
    pendentesFollowup: 1,
    propostasOntem: 0,
    contatosHoje: 0,
    semContato: 1,
    com1Contato: 0,
    com2Contatos: 1,
    urgente: 1,
    atencao: 0,
    risco: 0,
    critico: 0,
  },
  abertosAtualizadoEm: new Date().toISOString(),
  abertosSyncStatus: null,
  modeloProbabilidade: {
    status: "disponivel",
    propostasTreino: 300,
    propostasTreinoAte: new Date().toISOString(),
    propostasHistoricoAte: new Date().toISOString(),
    propostasHistoricoSemDesfecho: 0,
    clientesComIdadeCnpj: 0,
    clientesHistoricos: 2,
  },
};

function respostaProcedimento(path: string) {
  if (path === "crm.getPropostas") return crmData;
  if (path === "crm.getVendedores") return [{ nome: "Vendedora de teste" }];
  if (path === "crm.getSugestoesContato") return { sugestoes: [] };
  if (path === "crm.getFaixaEtiquetas") {
    return {
      1: { faixa: 1, label: "Faixa 1 (1-2 du)", diasInicio: 1, diasFim: 2 },
      2: { faixa: 2, label: "Faixa 2 (3-5 du)", diasInicio: 3, diasFim: 5 },
      3: { faixa: 3, label: "Faixa 3 (6-10 du)", diasInicio: 6, diasFim: 10 },
    };
  }
  if (path === "permissions.myPermissions") return ["comercial-crm"];
  if (path === "midiasBiblioteca.list") return { itens: [], galerias: [] };
  return [];
}

async function instalarMocks(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const paths = decodeURIComponent(url.pathname.split("/").pop() ?? "").split(",");
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(paths.map((path) => ({
      result: { data: { json: respostaProcedimento(path) } },
    }))),
  });
}

test("mantém propostas abertas e permite separar as pendentes sem esconder as já contatadas", async ({ page }) => {
  await page.route("**/api/auth/get-session**", async (route) => {
    const agora = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: "e2e-admin-session",
          userId: "e2e-admin",
          token: "e2e-session-token",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          createdAt: agora,
          updatedAt: agora,
        },
        user: {
          id: "e2e-admin",
          name: "Admin E2E",
          email: "admin-e2e@example.test",
          role: "admin",
          emailVerified: true,
          createdAt: agora,
          updatedAt: agora,
        },
      }),
    });
  });
  await page.route("**/api/trpc/**", instalarMocks);

  await page.goto("/comercial/crm");

  await expect(page.getByRole("heading", { name: "CRM de Propostas" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Propostas/ })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("#30001")).toBeVisible();
  await expect(page.getByText("#30002")).toBeVisible();
  await expect(page.getByText("Propostas abertas", { exact: true }).locator("..")).toContainText("2");

  const filtrarPendentes = page.getByRole("button", { name: /Pendentes de acompanhamento/ });
  await expect(filtrarPendentes).toBeVisible();
  await filtrarPendentes.click();

  await expect(page.getByText("#30001")).toBeVisible();
  await expect(page.getByText("#30002")).toBeHidden();
  await expect(page.getByRole("button", { name: /Todas as abertas/ })).toBeVisible();
});
