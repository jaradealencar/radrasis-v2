import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import MarketingEstadosCampanhas from "@/pages/financeiro/MarketingEstadosCampanhas";
import MarketingEstadosNovos from "@/pages/financeiro/MarketingEstadosNovos";
import MarketingVisaoGeral from "@/pages/financeiro/MarketingVisaoGeral";
import { trpc } from "@/lib/trpc";
import type { RouterOutputs } from "@/lib/trpc";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

const configVisaoGeral: RouterOutputs["marketingFinanceiro"]["getConfig"] = {
  mesesInatividadeReativacao: 6,
  percentualMargemFallback: 51,
  cacMaximo: null,
  custoReativacaoMaximo: null,
  roiMinimoPct: null,
  ticketMedioMinimo: null,
  metaClientesNovosMes: null,
  metaClientesReativadosMes: null,
  aumentoMaximoCacMensalPct: null,
  janelaAtribuicaoDias: 30,
  direcionadorRateio: "faturamento",
  custosFinanceirosIncluemMarketing: false,
};

const relatorioVisaoGeral = {
  meses: [{
    mes: 1,
    ano: 2025,
    mesParcial: false,
    investimentoAquisicao: 100,
    investimentoReativacao: 200,
    investimentoTotal: 300,
    novo: {
      qtdOs: 2,
      qtdClientesUnicos: 2,
      faturamento: 2000,
      margem: { margemTotal: 1000, origem: "real", pctPedidosComMargemReal: 100, qtdPedidos: 2 },
      investimento: 100,
      margemContribuicao: 1000,
      resultado: 900,
      roiPct: 900,
      roas: 20,
      cacPonderado: 50,
    },
    recorrenteAtivo: {
      qtdOs: 1,
      qtdClientesUnicos: 1,
      faturamento: 1000,
      margem: { margemTotal: 300, origem: "real", pctPedidosComMargemReal: 100, qtdPedidos: 1 },
    },
    reativado: {
      qtdOs: 1,
      qtdClientesUnicos: 1,
      faturamento: 1000,
      margem: { margemTotal: 500, origem: "real", pctPedidosComMargemReal: 100, qtdPedidos: 1 },
      investimento: 200,
      margemContribuicao: 500,
      resultado: 300,
      roiPct: 150,
      roas: 5,
      custoReativacaoPonderado: 200,
    },
    naoClassificado: {
      qtdOs: 0,
      qtdClientesUnicos: 0,
      faturamento: 0,
      margem: { margemTotal: 0, origem: "sem-dado", pctPedidosComMargemReal: null, qtdPedidos: 0 },
    },
    faturamentoTotalValido: 4000,
    consolidado: {
      investimento: 300,
      margemContribuicao: 1500,
      faturamento: 1500,
      resultado: 1200,
      roiPct: 400,
      roas: null,
    },
  }],
  reativacaoAnual: { clientesReativadosUnicosAno: 1, eventosReativacaoAno: 1 },
  config: configVisaoGeral,
  origem: "local",
} as RouterOutputs["marketingFinanceiro"]["getRelatorioAno"];

function MarketingVisaoGeralE2E() {
  return (
    <MarketingVisaoGeral
      ano={2025}
      relatorio={relatorioVisaoGeral}
      config={configVisaoGeral}
      mesFiltro={null}
      onDrillDown={() => {}}
    />
  );
}

function RoiMarketingFixture() {
  const [periodo, setPeriodo] = useState<"2026" | "2025">("2026");
  const dataInicial = periodo === "2026" ? "2026-01-01" : "2025-01-01";
  const dataFinal = periodo === "2026" ? "2026-11-30" : "2025-12-31";

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <MarketingVisaoGeralE2E />
      <nav aria-label="Período de análise" className="flex gap-2">
        <button type="button" aria-pressed={periodo === "2026"} onClick={() => setPeriodo("2026")}>2026</button>
        <button type="button" aria-pressed={periodo === "2025"} onClick={() => setPeriodo("2025")}>2025</button>
      </nav>
      <MarketingEstadosCampanhas dataInicial={dataInicial} dataFinal={dataFinal} />
      <MarketingEstadosNovos dataInicial={dataInicial} dataFinal={dataFinal} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <RoiMarketingFixture />
    </QueryClientProvider>
  </trpc.Provider>,
);
