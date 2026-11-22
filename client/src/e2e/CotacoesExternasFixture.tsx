import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import CotacoesExternas from "@/pages/comercial/CotacoesExternas";
import { trpc } from "@/lib/trpc";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});

const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

function CotacoesExternasE2E() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <main className="mx-auto max-w-7xl space-y-6 p-6">
          <CotacoesExternas />
        </main>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<CotacoesExternasE2E />);
