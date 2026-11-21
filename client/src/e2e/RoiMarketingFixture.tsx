import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import MarketingEstadosCampanhas from "@/pages/financeiro/MarketingEstadosCampanhas";
import MarketingEstadosNovos from "@/pages/financeiro/MarketingEstadosNovos";
import { trpc } from "@/lib/trpc";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

function RoiMarketingFixture() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <MarketingEstadosCampanhas ano={2026} />
      <MarketingEstadosNovos ano={2026} />
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
