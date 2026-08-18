import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useVendedorAlertas } from "@/hooks/useVendedorAlertas";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";

// Retrabalhos
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/retrabalhos" component={Retrabalhos} />
      <Route path="/inserir" component={InserirRapido} />
      <Route path="/retrabalhos/novo" component={NovoRetrabalho} />
      <Route path="/retrabalhos/:id/editar" component={EditarRetrabalho} />
      <Route path="/biblioteca" component={BibliotecaErros} />
      <Route path="/reincidencia" component={Reincidencia} />
      <Route path="/relatorio" component={Relatorio} />
      <Route path="/insights" component={Insights} />
      {/* Operações */}
      <Route path="/conhecimento" component={Conhecimento} />
      <Route path="/biblioteca-arquivos" component={BibliotecaArquivos} />
      <Route path="/sugestoes-conhecimento" component={SugestoesConhecimento} />
      <Route path="/fornecedores" component={Fornecedores} />
      <Route path="/rotinas" component={Rotinas} />
      <Route path="/regulamentos" component={Regulamentos} />
      <Route path="/pops" component={Pops} />
      <Route path="/pops-relatorio">
        <ProtectedRoute pageKey="pops-relatorio">
          <PopRelatorio />
        </ProtectedRoute>
      </Route>
      <Route path="/cargos-funcoes">
        <ProtectedRoute pageKey="cargos-funcoes">
          <CargoseFuncoes />
        </ProtectedRoute>
      </Route>
      {/* Financeiro */}
      <Route path="/financeiro" component={Financeiro} />
      <Route path="/cargos" component={Cargos} />
      <Route path="/analise-atrasos" component={AnaliseAtrasos} />
      <Route path="/gestao-atrasos" component={GestaoAtrasos} />
      {/* Comercial */}
      <Route path="/tabela-precos" component={TabelaPrecos} />
      <Route path="/comercial/performance" component={PerformanceComercial} />
      <Route path="/comercial/geografia" component={AnaliseGeografica} />
      <Route path="/comercial/metas" component={MetasComerciais} />
      <Route path="/comercial/crm" component={CRM} />
      <Route path="/comercial/planos-acao" component={PlanosAcaoComercial} />
      <Route path="/comercial/diagnostico-api" component={DiagnosticoApi} />
      <Route path="/comercial/insights-ia" component={InsightsIA} />
      <Route path="/comercial/crm-auditoria">
        <ProtectedRoute pageKey="crm-auditoria">
          <CrmAuditoria />
        </ProtectedRoute>
      </Route>
      {/* Administração — protegida por role */}
      <Route path="/admin">
        <ProtectedRoute pageKey="admin">
          <Admin />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/usuarios">
        <ProtectedRoute pageKey="admin">
          <Usuarios />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/sincronizacao-cache">
        <ProtectedRoute pageKey="admin">
          <SincronizacaoCache />
        </ProtectedRoute>
      </Route>

      <Route path="/logistica" component={LogisticaDashboard} />
      <Route path="/logistica/dashboard" component={LogisticaDashboard} />
      <Route path="/logistica/solicitacoes" component={Solicitacoes} />
      <Route path="/logistica/transportadoras" component={Transportadoras} />
      <Route path="/logistica/consulta" component={ConsultaCobertura} />
      <Route path="/logistica/minhas-cotacoes" component={MinhasCotacoes} />
      <Route path="/logistica/importar-cte" component={ImportarCte} />
      <Route path="/logistica/assertividade" component={Assertividade} />
      <Route path="/logistica/empacotamento" component={Empacotamento} />
      <Route path="/logistica/insights-ia" component={InsightsLogistica} />

      <Route path="/operacoes/metas">
        <ProtectedRoute pageKey="operacoes-performance">
          <MetasOperacionais />
        </ProtectedRoute>
      </Route>
      <Route path="/operacoes/performance">
        <ProtectedRoute pageKey="operacoes-performance">
          <Performance />
        </ProtectedRoute>
      </Route>
      <Route path="/operacoes/custo-solda">
        <ProtectedRoute pageKey="operacoes-custo-solda">
          <CustoSolda />
        </ProtectedRoute>
      </Route>
      <Route path="/operacoes/custo-led">
        <ProtectedRoute pageKey="operacoes-custo-led">
          <CustoLed />
        </ProtectedRoute>
      </Route>
      {/* Auditoria */}
      <Route path="/auditoria">
        <ProtectedRoute pageKey="auditoria">
          <Auditoria />
        </ProtectedRoute>
      </Route>
      {/* Qualidade */}
      <Route path="/qualidade/acoes-corretivas" component={AcoesCorretivas} />
      <Route path="/qualidade/planos-acao" component={PlanosAcao} />
      <Route path="/qualidade/desempenho" component={DesempenhoColaborador} />
      <Route path="/qualidade/alertas" component={Alertas} />
      {/* Acesso negado */}
      <Route path="/403" component={AcessoNegado} />
      {/* Login local */}
      <Route path="/login" component={LocalLogin} />
      {/* Legacy */}
      <Route path="/home" component={Home} />
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
