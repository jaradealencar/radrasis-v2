import { expect, test } from "@playwright/test";

const campanha = {
  id: 88,
  nome: "NPS — satisfação pós-entrega",
  descricao: "Amostra mensal única por cliente.",
  categoria: "nps",
  tipo: "recorrente",
  regraCadencia: "dias_corridos",
  diaFixoMes: null,
  frequenciaDias: 30,
  quarentenaDias: 0,
  status: "ativa",
  periodoInicio: null,
  periodoFim: null,
  wtsTemplateId: null,
  motorCadenciaAtivo: false,
  prioridadeCadencia: 100,
  intervaloMinimoSegundos: 3,
  intervaloMaximoSegundos: 8,
  intervaloMinimoEntreCampanhasDias: 30,
};

test("cria e abre a campanha NPS com janela e cadência fixas", async ({ page }) => {
  let criada = false;
  const chamadasCriacao: string[] = [];

  await page.route("**/api/auth/**", route => route.fulfill({ status: 200, json: null }));
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedimentos = url.pathname.replace("/api/trpc/", "").split(",");
    const entradaRaw = url.searchParams.get("input") ?? route.request().postData() ?? "{}";
    const entrada = JSON.parse(entradaRaw) as Record<string, { json?: Record<string, unknown> }>;
    const respostas = procedimentos.map((procedimento, indice) => {
      const dadosEntrada = entrada[String(indice)]?.json ?? {};
      let dados: unknown;

      if (procedimento.endsWith("criarCampanhaNps")) {
        criada = true;
        chamadasCriacao.push(procedimento);
        dados = campanha;
      } else if (procedimento.endsWith("listar")) {
        dados = {
          hoje: "2026-11-22",
          campanhas: criada ? [{ ...campanha, ultimoEnvio: null, proximoEnvio: null, clientesPendentes: 0, clientesAguardando: 0 }] : [],
          resumo: { ativas: criada ? 1 : 0, pendentesHoje: 0, daSemana: 0 },
        };
      } else if (procedimento.endsWith("listarCategorias")) {
        dados = [{ chave: "nps", label: "NPS", ativo: true, ordem: 0, emUso: 1 }];
      } else if (procedimento.endsWith("contagemAudiencias")) {
        dados = criada ? { 88: { paraContatar: 12, emEspera: 0 } } : {};
      } else if (procedimento.endsWith("clientesCacheStatus")) {
        dados = { obsoleto: false, total: 0, atualizadoEm: null };
      } else if (procedimento.endsWith("obterConfiguracaoCadencia")) {
        dados = {
          campanha,
          etapas: [],
          versaoAtual: 1,
          inscricoes: [],
          enviosPendentesConciliacao: 0,
          enviosPendentes: [],
          saudeErp: { ok: true, detalhes: [] },
        };
      } else if (procedimento.endsWith("obterProgramacaoFila")) {
        dados = { campanha, fila: null, envios: [] };
      } else if (procedimento.endsWith("listarInscricoesCadencia")) {
        dados = { itens: [], total: 0 };
      } else if (procedimento.endsWith("listarFontesDaCampanha") ||
        procedimento.endsWith("listarFontes") ||
        procedimento.endsWith("listScripts") ||
        procedimento.endsWith("listArquivos")) {
        dados = [];
      } else {
        dados = [];
      }

      return { result: { data: { json: dados } } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(respostas) });
  });

  await page.goto("/e2e-campanhas-nps.html", { waitUntil: "domcontentloaded" });
  const janelaEsperada = await page.evaluate(() => {
    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Campo_Grande",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [ano, mes, dia] = hoje.split("-").map(Number);
    const anterior = new Date(Date.UTC(ano, mes - 2, 16));
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, 15)).padStart(2, "0")}`;
    const br = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
    return `${br(anterior.toISOString().slice(0, 10))} a ${br(fim)}`;
  });
  await expect(page.getByRole("button", { name: "Campanha NPS" })).toBeVisible();
  await page.getByRole("button", { name: "Campanha NPS" }).click();

  await expect.poll(() => chamadasCriacao).toHaveLength(1);
  await expect(page.getByText("Janela mensal do NPS")).toBeVisible();
  await expect(page.getByText(janelaEsperada)).toBeVisible();
  await expect(page.getByText(/status do MubiSys é ENTREGUE/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Intervalo (dias entre envios)" })).toBeDisabled();
  await expect(page.getByText(/A quarentena não se aplica ao NPS/)).toBeVisible();
});
