import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import superjson from "superjson";
import MarketingCampanhasWhatsapp from "@/pages/financeiro/MarketingCampanhasWhatsapp";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <Router>
        <MarketingCampanhasWhatsapp />
      </Router>
      <Toaster />
    </QueryClientProvider>
  </trpc.Provider>,
);
