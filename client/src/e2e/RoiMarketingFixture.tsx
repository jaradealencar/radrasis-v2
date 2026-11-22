import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import MarketingVisaoGeral from "@/pages/financeiro/MarketingVisaoGeral";
import { trpc } from "@/lib/trpc";
import { configVisaoGeral, relatorioVisaoGeral } from "./marketingDados";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

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

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <main className="mx-auto max-w-7xl space-y-6 p-6"><MarketingVisaoGeralE2E /></main>
    </QueryClientProvider>
  </trpc.Provider>,
);
