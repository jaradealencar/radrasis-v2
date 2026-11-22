import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { Link, Route, Switch } from "wouter";
import superjson from "superjson";
import DashboardLayout from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import MarketingCampanhasWhatsapp from "@/pages/financeiro/MarketingCampanhasWhatsapp";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";

const fakeTrpcFetch: typeof fetch = async requestInput => {
  const requestUrl = requestInput instanceof Request
    ? new URL(requestInput.url)
    : new URL(String(requestInput), window.location.origin);
  const procedures = requestUrl.pathname.replace("/api/trpc/", "").split(",");
  const results = procedures.map(procedure => {
    if (procedure.endsWith("permissions.myPermissions")) return ["comercial-performance"];
    if (procedure.endsWith("alertas.countAtivos")) return { total: 0 };
    if (procedure.endsWith("routines.pending")) return [];
    if (procedure.endsWith("campanhasWhatsapp.listar")) {
      return { hoje: "2026-11-22", campanhas: [], resumo: { ativas: 0, pendentesHoje: 0, daSemana: 0 } };
    }
    if (procedure.endsWith("campanhasWhatsapp.listarCategorias")) return [];
    if (procedure.endsWith("campanhasWhatsapp.contagemAudiencias")) return {};
    if (procedure.endsWith("campanhasWhatsapp.clientesCacheStatus")) return { obsoleto: false };
    return null;
  });
  return new Response(JSON.stringify(results.map(result => ({ result: { data: { json: result } } }))), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, fetch: fakeTrpcFetch })],
});

function CampanhasWhatsappMenuFixture() {
  return (
    <Switch>
      <Route path="/e2e-campanhas-whatsapp-menu.html">
        <DashboardLayout>
          <main className="space-y-3 p-6">
            <h1>Performance Comercial de teste</h1>
            <Link href="/comercial/campanhas-whatsapp">Abrir rota direta para o teste de acesso</Link>
          </main>
        </DashboardLayout>
      </Route>
      <Route path="/comercial/performance">
        <DashboardLayout><main className="p-6"><h1>Performance Comercial de teste</h1></main></DashboardLayout>
      </Route>
      <Route path="/comercial/campanhas-whatsapp">
        <ProtectedRoute pageKey="comercial-performance" allowedRoles={["admin", "master", "gestor"]}>
          <DashboardLayout><MarketingCampanhasWhatsapp /></DashboardLayout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <CampanhasWhatsappMenuFixture />
      <Toaster />
    </QueryClientProvider>
  </trpc.Provider>,
);
