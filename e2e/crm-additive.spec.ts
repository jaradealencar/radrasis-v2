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
    nomeCliente: "Cliente novo sem compras",
    clienteNovo: true,
    totalCotacoes: 2,
    taxaConversao: 0,
    probabilidadeCompra: null,
    probabilidadeExplicacao: ["Sem estimativa confiável: clientes sem compras anteriores precisam de calibração temporal própria."],
  },
  {
    ...propostaBase,
    id: "erp-30002",
    sequencial: 30002,
    nomeCliente: "Cliente recorrente com dois contatos",
    qtdComprasCliente: 4,
    totalCompras: 4,
    totalCotacoes: 27,
    orcamentosFechados: 0,
    taxaConversao: 0,
    probabilidadeCompra: 15,
    probabilidadeExplicacao: ["Teto pela conversão registrada do cliente: 0.0% + 15 p.p., até 15%."],
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

function respostaProcedimento(path: string, input: any = {}) {
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
  if (path === "performanceComercial.getMes") {
    return {
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      cotacoes: 2,
      osGeradas: 1,
      valorOrcado: 30000,
      faturamento: 10000,
      custo: 5000,
      resultado: 5000,
      taxaConversao: 50,
      taxaFaturamento: 33.3,
      ticketMedio: 10000,
      margemPct: 50,
      clientesUnicos: 1,
      clientesComRecompra: 0,
      porVendedor: [{ vendedor: "Álvaro Teste", cotacoes: 2, valorOrcado: 30000, osGeradas: 1, faturamento: 10000, custo: 5000, resultado: 5000, taxaConversao: 50, taxaFaturamento: 33.3, ticketMedio: 10000, margemPct: 50 }],
    };
  }
  if (path === "performanceComercial.getAno") {
    const ano = Number(input?.ano ?? 2026);
    const base = ano === new Date().getFullYear() - 1
      ? { cotacoes: 111, osGeradas: 11, taxaConversao: 10, valorOrcado: 111000, faturamento: 22000, taxaFaturamento: 20, ticketMedio: 2000 }
      : { cotacoes: 222, osGeradas: 22, taxaConversao: 20, valorOrcado: 222000, faturamento: 44000, taxaFaturamento: 40, ticketMedio: 4000 };
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return meses.map((nome, index) => ({
      label: `${nome}/${String(ano).slice(-2)}`,
      mes: index + 1,
      ano,
      ...base,
      custo: 0,
      resultado: 0,
      margemPct: 0,
      clientesUnicos: 0,
      clientesComRecompra: 0,
      porVendedor: [],
    }));
  }
  if (path === "performanceComercial.getVisaoGeralClientes") {
    return {
      visaoGeral: {
        clientesCompradoresPeriodo: 1,
        primeiraCompraObservada: 1,
        recompraNoPeriodo: 0,
        ticketMedioPedido: 1000,
        qtdPedidosValidos: 1,
        concentracaoTop20PctReceitaPct: 100,
        concentracaoTop20PctClientes: 1,
        margemContribuicaoPct: 50,
        margemContribuicaoCobertura: "completa",
        classificacoes: { intervalo_acima_habitual: 0, reducao_volume: 0 },
        amostraPequena: true,
        topClientesPorValor: [],
      },
      dicionarioMetricas: [],
    };
  }
  if (path === "performanceComercial.getTempoOrcamentoPedido" || path === "performanceComercial.getRecompraNovosReativados") return null;
  if (path === "performanceComercial.getConversaoPorFaixaTicket") {
    return [
      { faixa: "Até R$330", ganhos: 1, perdidos: 1, taxaConversaoPct: 50 },
      { faixa: "R$335~750", ganhos: 1, perdidos: 2, taxaConversaoPct: 33.3 },
      { faixa: "R$760~1.300", ganhos: 1, perdidos: 3, taxaConversaoPct: 25 },
      { faixa: "R$1.301~5.490", ganhos: 1, perdidos: 4, taxaConversaoPct: 20 },
      { faixa: "R$5.500~8.000", ganhos: 1, perdidos: 5, taxaConversaoPct: 16.7 },
      { faixa: "R$8.010~12.000", ganhos: 1, perdidos: 6, taxaConversaoPct: 14.3 },
      { faixa: "R$12k+", ganhos: 1, perdidos: 9, taxaConversaoPct: 10 },
    ];
  }
  if (path === "performanceComercial.getEvolucaoConversaoPorFaixaTicket") {
    const atual = new Date();
    const chaveAtual = atual.getFullYear() * 12 + atual.getMonth();
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const faixas = ["Até R$330", "R$335~750", "R$760~1.300", "R$1.301~5.490", "R$5.500~8.000", "R$8.010~12.000", "R$12k+"];
    return Array.from({ length: 12 }, (_, i) => {
      const chave = chaveAtual - 11 + i;
      const mesIndex = (chave % 12 + 12) % 12;
      const ano = Math.floor(chave / 12);
      const deslocamento = chave - chaveAtual;
      const taxaBaixaFaixa = deslocamento >= -3 && deslocamento <= -1 ? 20 : deslocamento >= -6 && deslocamento <= -4 ? 10 : 15;
      return {
        chave,
        mes: `${meses[mesIndex]}/${String(ano).slice(-2)}`,
        faixas: faixas.map((faixa, indice) => {
          const taxa = indice === faixas.length - 1 ? taxaBaixaFaixa : 50 - indice * 5;
          const ganhos = taxa;
          const perdidos = 100 - taxa;
          return { faixa, ganhos, perdidos, emAberto: 3, decididos: ganhos + perdidos, taxaConversaoPct: taxa };
        }),
      };
    });
  }
  if (path === "performanceComercial.getProbabilidadeVendedores") {
    const bucket = {
      monitoradas: 2,
      decididas: 2,
      ganhos: 1,
      perdas: 1,
      semDesfecho: 0,
      abertas: 0,
      perdasPresumidas: 0,
      abertasNaValidade: 0,
      abertasSemData: 0,
      semHistorico: 0,
      semStatus: 0,
      statusAmbiguo: 0,
      statusNaoReconhecido: 0,
      conflitos: 0,
      fontesDesfecho: { mubisys: 1, crm: 0, ambos: 1, conflitos: 0 },
      decididasConsiderandoVencidas: 2,
      conversaoConsiderandoVencidasPct: 50,
      ganhosEsperados: 0.8,
      valorGanhoReal: 10000,
      valorGanhoEsperado: 27000,
      valorCarteiraEsperado: 27000,
      conversaoRealPct: 50,
      conversaoEsperadaPct: 40,
      desvioGanhos: 0.2,
      pipelinePonderado: 0,
      benchmarkColegas: {
        comparaveis: 2,
        cobertas: 2,
        coberturaPct: 100,
        conversaoPct: 60,
        ganhosEsperados: 1.2,
        valorEsperado: 27000,
        valorRealCoberto: 10000,
        diferencaGanhos: 0.2,
        diferencaValor: 17000,
      },
    };
    return {
      periodo: { mes: new Date().getMonth() + 1, ano: new Date().getFullYear() },
      cobertura: {
        propostasNoHistorico: 2,
        propostasMonitoradas: 2,
        propostasCorrespondidas: 2,
        propostasSemScore: 0,
        snapshotsSemHistorico: 0,
        snapshotsComHistoricoAmbiguo: 0,
        snapshotsSemIdMubiSys: 0,
        snapshotsConsiderados: 2,
        percentual: 100,
      },
      total: bucket,
      versoes: [{ versao: "logit-platt-segmented-v3", propostas: 2 }],
      statusNaoReconhecidos: [],
      vendedores: [{ vendedor: "Álvaro Teste", geral: bucket, novos: bucket, antigos: bucket, semCoorteConhecida: bucket }],
    };
  }
  return [];
}

async function instalarMocks(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const paths = decodeURIComponent(url.pathname.split("/").pop() ?? "").split(",");
  const rawInput = url.searchParams.get("input");
  const inputs = rawInput ? JSON.parse(rawInput) : {};
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(paths.map((path, index) => ({
      result: { data: { json: respostaProcedimento(path, inputs[index]?.json ?? inputs[index] ?? {}) } },
    }))),
  });
}

test("mantém propostas abertas e não inventa score para cliente novo sem calibração própria", async ({ page }) => {
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
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(7);
  await expect(tabs.nth(0)).toContainText("Fila de trabalho");
  await expect(tabs.nth(1)).toContainText("Propostas");
  await expect(tabs.nth(2)).toContainText("Desempenho");
  await expect(tabs.nth(3)).toContainText("Agenda de Hoje");
  await expect(tabs.nth(4)).toContainText("Reativar clientes");
  await expect(tabs.nth(5)).toContainText("Histórico");
  await expect(tabs.nth(6)).toContainText("Auditoria");
  await expect(tabs.nth(0)).toHaveAttribute("data-state", "active");

  await tabs.nth(1).click();
  await expect(page.getByText("#30001")).toBeVisible();
  const clienteNovoRow = page.getByRole("row").filter({ hasText: "#30001" });
  const alturaLinhaNova = await clienteNovoRow.evaluate((row) => row.getBoundingClientRect().height);
  expect(alturaLinhaNova).toBeLessThan(160);
  await expect(page.getByText("Cliente novo sem compras")).toBeVisible();
  await expect(page.getByText("2 cotações", { exact: true })).toBeVisible();
  await expect(page.getByText("0% conv.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("S/D", { exact: true }).first()).toBeVisible();

  const filtrosAvancados = page.locator("details").filter({ hasText: "Filtros avançados" });
  await expect(filtrosAvancados).toHaveJSProperty("open", false);
  await filtrosAvancados.locator("summary").click();
  await expect(filtrosAvancados).toHaveJSProperty("open", true);

  await expect(page.getByText("#30002")).toBeVisible();
  await expect(page.getByText(`27 cota\u00e7\u00f5es`, { exact: true })).toBeVisible();
  await expect(page.getByText("15%", { exact: true })).toBeVisible();
  await expect(page.getByText("Propostas abertas", { exact: true }).locator("..")).toContainText("2");

  const filtrarPendentes = page.getByRole("button", { name: /Pendentes de acompanhamento/ });
  await expect(filtrarPendentes).toBeVisible();
  await filtrarPendentes.click();

  await expect(page.getByText("#30001")).toBeVisible();
  await expect(page.getByText("#30002")).toBeHidden();
  await expect(page.getByRole("button", { name: /Todas as abertas/ })).toBeVisible();
});

test("mantém os indicadores gerais e remove a tabela vendedor na previsão", async ({ page }) => {
  await page.route("**/api/auth/get-session**", async (route) => {
    const agora = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: { id: "e2e-admin-session", userId: "e2e-admin", token: "e2e-session-token", expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), createdAt: agora, updatedAt: agora },
        user: { id: "e2e-admin", name: "Admin E2E", email: "admin-e2e@example.test", role: "admin", emailVerified: true, createdAt: agora, updatedAt: agora },
      }),
    });
  });
  await page.route("**/api/trpc/**", instalarMocks);

  await page.goto("/comercial/performance");

  const painel = page.getByText("Conversão observada x probabilidade").locator("..").locator("..").locator("..");
  await expect(painel).toBeVisible();
  await expect(page.getByText("Vendedor na previsão", { exact: true })).toHaveCount(0);
  await expect(painel.getByText("Propostas decididas: realizado x expectativa")).toBeVisible();
  await expect(painel.getByText(/1 ganhos x 0,8 esperados/)).toBeVisible();
  await expect(painel.getByText("R$ 10.000,00").first()).toBeVisible();
  await expect(painel.getByText("R$ 27.000,00").first()).toBeVisible();
  await expect(painel.getByText("Desfechos confirmados", { exact: true })).toBeVisible();
  await expect(painel.getByText(/Vencidas presumidas: 0/)).toBeVisible();
  await expect(painel.getByText(/Versões do modelo: logit-platt-segmented-v3 \(2\)/)).toBeVisible();
  const resultadoPorVendedor = painel.locator("details").filter({ hasText: "Resultado por vendedor e perfil de cliente" });
  await resultadoPorVendedor.locator("summary").click();
  await expect(resultadoPorVendedor.getByRole("row").filter({ hasText: "Clientes novos" })).toBeVisible();
  await expect(resultadoPorVendedor.getByRole("row").filter({ hasText: "Clientes antigos" })).toBeVisible();
  await expect(page.getByText(/Real menos esperado:\s*-R\$\s*17\.000,00/)).toBeVisible();
  await expect(painel.getByText("Gargalos operacionais da carteira aberta")).toBeVisible();
  await expect(painel.getByText(/Versões do modelo: logit-platt-segmented-v3 \(2\)/)).toBeVisible();
});

test("compara os indicadores ao ano anterior e acompanha a evolução por faixa de tíquete", async ({ page }) => {
  await page.route("**/api/auth/get-session**", async (route) => {
    const agora = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: { id: "e2e-admin-session", userId: "e2e-admin", token: "e2e-session-token", expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), createdAt: agora, updatedAt: agora },
        user: { id: "e2e-admin", name: "Admin E2E", email: "admin-e2e@example.test", role: "admin", emailVerified: true, createdAt: agora, updatedAt: agora },
      }),
    });
  });
  await page.route("**/api/trpc/**", instalarMocks);
  await page.goto("/comercial/performance");

  const anoAtual = new Date().getFullYear();
  await expect(page.getByRole("button", { name: "Mês Vigente" })).toHaveCount(0);
  const linhaJan = page.getByRole("row", { name: new RegExp(`Jan/${String(anoAtual).slice(-2)}`) });
  await expect(linhaJan).toBeVisible();
  for (const valorAnterior of [
    `${anoAtual - 1}: 111`,
    `${anoAtual - 1}: 11`,
    `${anoAtual - 1}: 10%`,
    `${anoAtual - 1}: R$ 111.000`,
    `${anoAtual - 1}: R$ 22.000`,
    `${anoAtual - 1}: 20%`,
    `${anoAtual - 1}: R$ 2.000`,
  ]) {
    await expect(linhaJan).toContainText(valorAnterior);
  }

  await page.getByRole("button", { name: "Inteligência de Clientes" }).click();
  await expect(page.getByRole("heading", { name: "Evolução da conversão por faixa de tíquete" })).toBeVisible();
  await page.getByLabel("Faixa do gráfico").selectOption("R$12k+");
  const linhaFaixa = page.getByRole("row").filter({ hasText: "+10,0 p.p." });
  await expect(linhaFaixa).toContainText("20,0%");
  await expect(linhaFaixa).toContainText("10,0%");
  await expect(linhaFaixa).toContainText("+10,0 p.p.");
});
