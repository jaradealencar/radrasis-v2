import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { Router } from "wouter";
import CRM from "@/pages/comercial/CRM";
import CrmScripts from "@/pages/comercial/CrmScripts";
import { trpc } from "@/lib/trpc";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

function CrmFixture() {
  const scriptsPage = new URLSearchParams(window.location.search).has("scripts");
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Router>{scriptsPage ? <CrmScripts /> : <CRM />}</Router>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<CrmFixture />);
