import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useVendedorAlertas } from "@/hooks/useVendedorAlertas";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";

// Retrabalhos
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Metricas from "./pages/Metricas";
import Retrabalhos from "./pages/retrabalhos/Retrabalhos";
import InserirRapido from "./pages/retrabalhos/InserirRapido";
import NovoRetrabalho from "./pages/retrabalhos/NovoRetrabalho";
import EditarRetrabalho from "./pages/retrabalhos/EditarRetrabalho";
import BibliotecaErros from "./pages/retrabalhos/BibliotecaErros";
import Reincidencia from "./pages/retrabalhos/Reincidencia";
import Relatorio from "./pages/retrabalhos/Relatorio";
import Insights from "./pages/retrabalhos/Insights";

// Operações
import Conhecimento from "./pages/operacoes/Conhecimento";
import BibliotecaArquivos from "./pages/operacoes/BibliotecaArquivos";
import SugestoesConhecimento from "./pages/operacoes/SugestoesConhecimento";
import Fornecedores from "./pages/operacoes/Fornecedores";
import Rotinas from "./pages/operacoes/Rotinas";
import Regulamentos from "./pages/operacoes/Regulamentos";
import Pops from "./pages/operacoes/Pops";
import PopRelatorio from "./pages/operacoes/PopRelatorio";

// Comercial
import TabelaPrecos from "./pages/comercial/TabelaPrecos";
import PerformanceComercial from "./pages/comercial/PerformanceComercial";
import AnaliseGeografica from "./pages/comercial/AnaliseGeografica";
import MetasComerciais from "./pages/comercial/MetasComerciais";
import CRM from "./pages/comercial/CRM";
import PlanosAcaoComercial from "./pages/comercial/PlanosAcaoComercial";
import DiagnosticoApi from "./pages/comercial/DiagnosticoApi";
import CrmAuditoria from "./pages/comercial/CrmAuditoria";
import InsightsIA from "./pages/comercial/InsightsIA";
// Financeiro
import Financeiro from "./pages/financeiro/Financeiro";
import Cargos from "./pages/financeiro/Cargos";
import AnaliseAtrasos from "./pages/financeiro/AnaliseAtrasos";
import GestaoAtrasos from "./pages/financeiro/GestaoAtrasos";

// Admin
import Admin from "./pages/admin/Admin";
import LogisticaDashboard from "./pages/logistica/LogisticaDashboard";
import Solicitacoes from "./pages/logistica/Solicitacoes";
import Transportadoras from "./pages/logistica/Transportadoras";
import ConsultaCobertura from "@/pages/logistica/ConsultaCobertura";
import MinhasCotacoes from "@/pages/logistica/MinhasCotacoes";
import ImportarCte from "@/pages/logistica/ImportarCte";
import Assertividade from "@/pages/logistica/Assertividade";
import Empacotamento from "@/pages/logistica/Empacotamento";
import InsightsLogistica from "@/pages/logistica/InsightsLogistica";
import Usuarios from "./pages/admin/Usuarios";
import SincronizacaoCache from "./pages/admin/SincronizacaoCache";
import Performance from "./pages/operacoes/Performance";
import CustoSolda from "./pages/operacoes/CustoSolda";
import CustoLed from "./pages/operacoes/CustoLed";
import MetasOperacionais from "./pages/operacoes/MetasOperacionais";
import AcessoNegado from "./pages/AcessoNegado";
import Auditoria from "./pages/Auditoria";
import LocalLogin from "./pages/LocalLogin";
import CargoseFuncoes from "./pages/operacoes/CargoseFuncoes";
import ProtectedRoute from "./components/ProtectedRoute";
import IdleTimeoutWarning from "./components/IdleTimeoutWarning";
// Qualidade
import AcoesCorretivas from "./pages/qualidade/AcoesCorretivas";
import PlanosAcao from "./pages/qualidade/PlanosAcao";
import DesempenhoColaborador from "./pages/qualidade/DesempenhoColaborador";
import Alertas from "./pages/qualidade/Alertas";

// Envolve uma página com a sidebar/topbar global. Não usar para páginas de
// tela cheia (login, 403, 404), que não devem ter navegação lateral.
function L({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/"><L><Dashboard /></L></Route>
      <Route path="/retrabalhos"><L><Retrabalhos /></L></Route>
      <Route path="/inserir"><L><InserirRapido /></L></Route>
      <Route path="/retrabalhos/novo"><L><NovoRetrabalho /></L></Route>
      <Route path="/retrabalhos/:id/editar"><L><EditarRetrabalho /></L></Route>
      <Route path="/biblioteca"><L><BibliotecaErros /></L></Route>
      <Route path="/reincidencia"><L><Reincidencia /></L></Route>
      <Route path="/relatorio"><L><Relatorio /></L></Route>
      <Route path="/insights"><L><Insights /></L></Route>
      <Route path="/metricas"><L><Metricas /></L></Route>
      {/* Operações */}
      <Route path="/conhecimento"><L><Conhecimento /></L></Route>
      <Route path="/biblioteca-arquivos"><L><BibliotecaArquivos /></L></Route>
      <Route path="/sugestoes-conhecimento"><L><SugestoesConhecimento /></L></Route>
      <Route path="/fornecedores"><L><Fornecedores /></L></Route>
      <Route path="/rotinas"><L><Rotinas /></L></Route>
      <Route path="/regulamentos"><L><Regulamentos /></L></Route>
      <Route path="/pops"><L><Pops /></L></Route>
      <Route path="/pops-relatorio">
        <ProtectedRoute pageKey="pops-relatorio">
          <L><PopRelatorio /></L>
        </ProtectedRoute>
      </Route>
      <Route path="/cargos-funcoes">
        <ProtectedRoute pageKey="cargos-funcoes">
          <L><CargoseFuncoes /></L>
        </ProtectedRoute>
      </Route>
      {/* Financeiro */}
      <Route path="/financeiro"><L><Financeiro /></L></Route>
      <Route path="/cargos"><L><Cargos /></L></Route>
      <Route path="/analise-atrasos"><L><AnaliseAtrasos /></L></Route>
      <Route path="/gestao-atrasos"><L><GestaoAtrasos /></L></Route>
      {/* Comercial */}
      <Route path="/tabela-precos"><L><TabelaPrecos /></L></Route>
      <Route path="/comercial/performance"><L><PerformanceComercial /></L></Route>
      <Route path="/comercial/geografia"><L><AnaliseGeografica /></L></Route>
      <Route path="/comercial/metas"><L><MetasComerciais /></L></Route>
      <Route path="/comercial/crm"><L><CRM /></L></Route>
      <Route path="/comercial/planos-acao"><L><PlanosAcaoComercial /></L></Route>
      <Route path="/comercial/diagnostico-api"><L><DiagnosticoApi /></L></Route>
      <Route path="/comercial/insights-ia"><L><InsightsIA /></L></Route>
      <Route path="/comercial/crm-auditoria">
        <ProtectedRoute pageKey="crm-auditoria">
          <L><CrmAuditoria /></L>
        </ProtectedRoute>
      </Route>
      {/* Administração — protegida por role */}
      <Route path="/admin">
        <ProtectedRoute pageKey="admin">
          <L><Admin /></L>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/usuarios">
        <ProtectedRoute pageKey="admin">
          <L><Usuarios /></L>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/sincronizacao-cache">
        <ProtectedRoute pageKey="admin">
          <L><SincronizacaoCache /></L>
        </ProtectedRoute>
      </Route>

      <Route path="/logistica"><L><LogisticaDashboard /></L></Route>
      <Route path="/logistica/dashboard"><L><LogisticaDashboard /></L></Route>
      <Route path="/logistica/solicitacoes"><L><Solicitacoes /></L></Route>
      <Route path="/logistica/transportadoras"><L><Transportadoras /></L></Route>
      <Route path="/logistica/consulta"><L><ConsultaCobertura /></L></Route>
      <Route path="/logistica/minhas-cotacoes"><L><MinhasCotacoes /></L></Route>
      <Route path="/logistica/importar-cte"><L><ImportarCte /></L></Route>
      <Route path="/logistica/assertividade"><L><Assertividade /></L></Route>
      <Route path="/logistica/empacotamento"><L><Empacotamento /></L></Route>
      <Route path="/logistica/insights-ia"><L><InsightsLogistica /></L></Route>

      <Route path="/operacoes/metas">
        <ProtectedRoute pageKey="operacoes-performance">
          <L><MetasOperacionais /></L>
        </ProtectedRoute>
      </Route>
      <Route path="/operacoes/performance">
        <ProtectedRoute pageKey="operacoes-performance">
          <L><Performance /></L>
        </ProtectedRoute>
      </Route>
      <Route path="/operacoes/custo-solda">
        <ProtectedRoute pageKey="operacoes-custo-solda">
          <L><CustoSolda /></L>
        </ProtectedRoute>
      </Route>
      <Route path="/operacoes/custo-led">
        <ProtectedRoute pageKey="operacoes-custo-led">
          <L><CustoLed /></L>
        </ProtectedRoute>
      </Route>
      {/* Auditoria */}
      <Route path="/auditoria">
        <ProtectedRoute pageKey="auditoria">
          <L><Auditoria /></L>
        </ProtectedRoute>
      </Route>
      {/* Qualidade */}
      <Route path="/qualidade/acoes-corretivas"><L><AcoesCorretivas /></L></Route>
      <Route path="/qualidade/planos-acao"><L><PlanosAcao /></L></Route>
      <Route path="/qualidade/desempenho"><L><DesempenhoColaborador /></L></Route>
      <Route path="/qualidade/alertas"><L><Alertas /></L></Route>
      {/* Acesso negado — tela cheia, sem sidebar */}
      <Route path="/403" component={AcessoNegado} />
      {/* Login local — tela cheia, sem sidebar */}
      <Route path="/login" component={LocalLogin} />
      {/* Legacy */}
      <Route path="/home"><L><Home /></L></Route>
      {/* Não encontrado — tela cheia, sem sidebar */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function VendedorAlertasWatcher() {
  const { user } = useAuth();
  useVendedorAlertas(user?.name);
  return null;
}

// Login é obrigatório para toda a aplicação: qualquer rota fora de /login
// exige sessão ativa, senão redireciona para a tela de login.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <DashboardLayoutSkeleton />;
  if (!user && location !== "/login") return <Redirect to="/login" />;
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AuthGate>
            <VendedorAlertasWatcher />
            <Router />
            <IdleTimeoutWarning />
          </AuthGate>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
