import { expect, test } from "@playwright/test";

type Script = { id: number; faixa: number; titulo: string; conteudo: string; conteudo_voz: string };
const nomeEmpresaCompleto = "MIRANDA COMERCIO DE LETREIROS EXPRESS LTDA";

async function configurarApiCrm(page: import("@playwright/test").Page) {
  let script: Script | null = null;
  let agendamentoAtual: { status: string; etapaAtual: number; totalEtapas: number; proximoEnvioEm: string } | null = null;
  const chamadasGetPropostas: Array<{ dataInicio?: string; dataFim?: string }> = [];
  const agendamentos: Array<Record<string, unknown>> = [];

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
        dados = {
          propostas: [{
            id: "29603",
            sequencial: 29603,
            nomeCliente: nomeEmpresaCompleto,
            nomeContato: "Anderson Miranda",
            telefone: "65999999999",
            vendedor: "Vendedor E2E",
            valor: 5400,
            dataCriacao: "2026-11-19T12:00:00.000Z",
            diasAberto: 2,
            janela: "",
            clienteNovo: true,
            contato1: null,
            contato2: null,
            qtdContatos: 0,
            contato1NoPrazo: null,
            meta2Contatos: false,
            probabilidadeCompra: 6,
            probabilidadeExplicacao: [
              "Base: taxa geral da carteira 29% (280 orçamentos decididos)",
              "Histórico do cliente: 2/5 decididos, ajustado bayesianamente para 31%",
              "Faixa de tíquete \"R$ 2 mil–R$ 5 mil\": converte 26% (ajustado bayesianamente)",
              "Região Centro-Oeste: converte 32% (ajustado bayesianamente)",
            ],
            qtdComprasCliente: 0,
            diasSemComprar: null,
            cadenciaAutomatica: agendamentoAtual,
            totalCotacoes: 1,
            totalCompras: 0,
            orcamentosFechados: 0,
            taxaConversao: 0,
            orcamentosDesde: null,
            estadoCliente: "SP",
          }],
          stats: { totalAberto: 1, semContato: 1, com1Contato: 0, contatosHoje: 0 },
        };
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
      } else if (procedimento.endsWith("listarCampanhasFollowupAutomatico")) {
        dados = [{ id: 42, nome: "CRM - Follow-up aberto", etapas: 3 }];
      } else if (procedimento.endsWith("agendarFollowupAutomatico")) {
        agendamentos.push(dadosEntrada);
        agendamentoAtual = { status: "aguardando", etapaAtual: 1, totalEtapas: 3, proximoEnvioEm: "2026-11-23T12:30:00.000Z" };
        dados = { inscricaoId: 9, primeiroEnvioEm: agendamentoAtual.proximoEnvioEm, etapas: 3, workerAcordado: true };
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

  return { chamadasGetPropostas, agendamentos };
}

test("abre o CRM com as cotações dos últimos 10 dias", async ({ page }) => {
  const { chamadasGetPropostas: chamadas } = await configurarApiCrm(page);
  const errosPagina: string[] = [];
  page.on("pageerror", error => errosPagina.push(error.message));
  await page.goto("/e2e-crm.html", { waitUntil: "domcontentloaded" });
  const esperado = await page.evaluate(() => {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - 9);
    const chave = (data: Date) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    return [chave(inicio), chave(hoje)];
  });

  await expect(page.getByRole("heading", { name: "CRM de Propostas" })).toBeVisible();
  expect(errosPagina).toEqual([]);
  const nomeEmpresa = page.getByText(nomeEmpresaCompleto, { exact: true });
  await expect(nomeEmpresa).toBeVisible();
  await expect(nomeEmpresa).toHaveCSS("white-space", "normal");
  await expect(nomeEmpresa).toHaveCSS("text-overflow", "clip");
  await expect.poll(() => chamadas.find(chamada => chamada.dataInicio && chamada.dataFim)).toEqual({
    dataInicio: esperado[0],
    dataFim: esperado[1],
  });
});

test("abre a memória de cálculo da possibilidade de compra pelo clique e teclado", async ({ page }) => {
  await configurarApiCrm(page);
  await page.goto("/e2e-crm.html", { waitUntil: "domcontentloaded" });

  const possibilidade = page.getByRole("button", { name: "Ver memória de cálculo da possibilidade de compra (6%)" });
  await possibilidade.click();
  await expect(page.getByText("Memória do cálculo")).toBeVisible();
  await expect(page.getByText(/taxa geral da carteira 29%/)).toBeVisible();
  await expect(page.getByText(/Histórico do cliente: 2\/5/)).toBeVisible();
  await expect(page.getByText(/Faixa de tíquete/)).toBeVisible();
  await expect(page.getByText(/Região Centro-Oeste/)).toBeVisible();
  await expect(page.getByText("Possibilidade estimada")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("Memória do cálculo")).toBeHidden();
  await expect(possibilidade).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Memória do cálculo")).toBeVisible();
});

test("programa as três mensagens automáticas e exige confirmação individual de opt-in", async ({ page }) => {
  const { agendamentos } = await configurarApiCrm(page);
  await page.goto("/e2e-crm.html", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Programar follow-up" }).click();
  await expect(page.getByRole("heading", { name: "Programar follow-up automático" })).toBeVisible();
  const confirmar = page.getByLabel("Confirmo que este cliente autorizou receber mensagens da empresa pelo WhatsApp.");
  await expect(page.getByRole("button", { name: "Programar mensagens" })).toBeDisabled();
  expect(agendamentos).toHaveLength(0);
  await confirmar.check();
  await page.getByRole("button", { name: "Programar mensagens" }).click();

  await expect.poll(() => agendamentos.length).toBe(1);
  expect(agendamentos).toHaveLength(1);
  expect(agendamentos[0]).toMatchObject({ orcamentoId: "29603", campanhaId: 42, confirmarOptIn: true });
  await expect(page.getByText("Follow-up 1/3")).toBeVisible();
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
