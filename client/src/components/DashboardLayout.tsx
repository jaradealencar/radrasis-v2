import { useAuth } from "@/_core/hooks/useAuth";
import { Home } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  LogIn,
  MapPin,
  Package,
  Boxes,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  Tag,
  TrendingUp,
  Truck,
  Users,
  DollarSign,
  Lightbulb,
  Target,
  CheckCircle2,
  GitBranch,
  Bell,
  UserCheck,
  FolderOpen,
  Settings2,
  Wallet,
  Receipt,
  PieChart,
  Menu,
  X,
  Handshake,
  Zap,
  Search,
  FlaskConical,
  Activity,
} from "lucide-react";
import { ReactNode, useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { trpc } from "@/lib/trpc";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  pageKey?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Retrabalhos",
    items: [
      { label: "Painel", href: "/", icon: <LayoutDashboard size={15} />, pageKey: "painel" },
      { label: "Retrabalhos", href: "/retrabalhos", icon: <ClipboardList size={15} />, pageKey: "retrabalhos" },
      { label: "Inserção (Retrab. e CNQ)", href: "/inserir", icon: <PlusCircle size={15} />, pageKey: "inserir" },
      { label: "Biblioteca de Erros e CNQ", href: "/biblioteca", icon: <BookOpen size={15} />, pageKey: "biblioteca" },
      { label: "Reincidências", href: "/reincidencia", icon: <AlertTriangle size={15} />, pageKey: "reincidencia" },
      { label: "Relatório (Retrab. e CNQ)", href: "/relatorio", icon: <BarChart3 size={15} />, pageKey: "relatorio" },
      { label: "Insights IA", href: "/insights", icon: <Brain size={15} />, pageKey: "insights" },
      { label: "Auditoria", href: "/auditoria", icon: <ShieldCheck size={15} />, pageKey: "auditoria" },
    ],
  },
  {
    label: "Operações",
    items: [
      { label: "Visão de Performance", href: "/operacoes/performance", icon: <TrendingUp size={15} />, pageKey: "operacoes-performance" },
      { label: "Base de Conhecimento", href: "/conhecimento", icon: <BookOpen size={15} />, pageKey: "conhecimento" },
      { label: "Biblioteca de Arquivos", href: "/biblioteca-arquivos", icon: <FolderOpen size={15} />, pageKey: "biblioteca-arquivos" },
      { label: "Sugestões de Conhecimento", href: "/sugestoes-conhecimento", icon: <Lightbulb size={15} />, pageKey: "sugestoes-conhecimento" },
      { label: "Fornecedores", href: "/fornecedores", icon: <Building2 size={15} />, pageKey: "fornecedores" },
      { label: "Rotinas", href: "/rotinas", icon: <CalendarCheck size={15} />, pageKey: "rotinas" },
      { label: "Políticas e Docs", href: "/regulamentos", icon: <ScrollText size={15} />, pageKey: "regulamentos" },
      { label: "POPs", href: "/pops", icon: <FileText size={15} />, pageKey: "pops" },
      { label: "Relatório de POPs", href: "/pops-relatorio", icon: <TrendingUp size={15} />, pageKey: "pops-relatorio" },
      { label: "Cargos e Funções", href: "/cargos-funcoes", icon: <Briefcase size={15} />, pageKey: "cargos-funcoes" },
      { label: "Custo de Solda", href: "/operacoes/custo-solda", icon: <DollarSign size={15} />, pageKey: "operacoes-custo-solda" },
      { label: "Custos de LED", href: "/operacoes/custo-led", icon: <Zap size={15} />, pageKey: "operacoes-custo-led" },
    ],
  },
  {
    label: "Produção",
    items: [
      { label: "PCP - Controle de Produção", href: "/pcp", icon: <Activity size={15} />, pageKey: "pcp" },
      { label: "Gestão de Atrasos", href: "/gestao-atrasos", icon: <AlertTriangle size={15} />, pageKey: "gestao-atrasos" },
      { label: "Análise de Atrasos", href: "/analise-atrasos", icon: <AlertTriangle size={15} />, pageKey: "analise-atrasos" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Painel Financeiro", href: "/financeiro", icon: <Wallet size={15} />, pageKey: "financeiro" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Tabela de Preços", href: "/tabela-precos", icon: <Tag size={15} />, pageKey: "tabela-preco" },
      { label: "Performance Comercial", href: "/comercial/performance", icon: <TrendingUp size={15} />, pageKey: "comercial-performance" },
      { label: "Metas Comerciais", href: "/comercial/metas", icon: <Target size={15} />, pageKey: "comercial-metas" },
      { label: "CRM de Propostas", href: "/comercial/crm", icon: <Handshake size={15} />, pageKey: "comercial-crm" },
      { label: "Planos de Ação Comercial", href: "/comercial/planos-acao", icon: <Lightbulb size={15} />, pageKey: "comercial-planos-acao" },
      { label: "Diagnóstico de Dados", href: "/comercial/diagnostico-api", icon: <FlaskConical size={15} />, pageKey: "comercial-performance" },
      { label: "Auditoria do CRM", href: "/comercial/crm-auditoria", icon: <Activity size={15} />, pageKey: "crm-auditoria" },
    ],
  },
  {
    label: "Qualidade",
    items: [
      { label: "Planos de Ação", href: "/qualidade/planos-acao", icon: <GitBranch size={15} />, pageKey: "qualidade-planos" },
      { label: "Desempenho por Colaborador", href: "/qualidade/desempenho", icon: <UserCheck size={15} />, pageKey: "qualidade-desempenho" },
    ],
  },
  {
    label: "Logística",
    items: [
      { label: "Dashboard", href: "/logistica", icon: <LayoutDashboard size={15} />, pageKey: "logistica-dashboard" },
      { label: "Solicitações de Frete", href: "/logistica/solicitacoes", icon: <Package size={15} />, pageKey: "logistica-solicitacoes" },
      { label: "Transportadoras", href: "/logistica/transportadoras", icon: <Truck size={15} />, pageKey: "logistica-transportadoras" },
      { label: "Consulta de Cobertura", href: "/logistica/consulta", icon: <MapPin size={15} />, pageKey: "logistica-consulta" },
      { label: "Minhas Cotações", href: "/logistica/minhas-cotacoes", icon: <Package size={15} />, pageKey: "logistica-minhas-cotacoes" },
      { label: "CT-e", href: "/logistica/importar-cte", icon: <FileText size={15} />, pageKey: "logistica-cte" },
      { label: "Assertividade IA", href: "/logistica/assertividade", icon: <TrendingUp size={15} />, pageKey: "logistica-assertividade" },
      { label: "Empacotamento", href: "/logistica/empacotamento", icon: <Boxes size={15} />, pageKey: "logistica-empacotamento" },
      { label: "Insights de IA", href: "/logistica/insights-ia", icon: <Brain size={15} />, pageKey: "logistica-insights-ia" },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  master: "Master",
  admin: "Administrador",
  vendas: "Vendas",
  logistica: "Logística",
  producao: "Produção",
  financeiro: "Financeiro",
  gestor: "Gestor",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const { localUser, canAccess } = useLocalAuth();
  const utils = trpc.useUtils();
  const { data: alertasCounts } = trpc.alertas.countAtivos.useQuery(undefined, { refetchInterval: 60000 });
  const { data: rotinasPendentes } = trpc.routines.pending.useQuery(undefined, { refetchInterval: 120000 });
  const logoutLocalMut = trpc.localAuth.logout.useMutation({
    onSuccess: () => {
      utils.localAuth.me.invalidate();
      window.location.href = "/";
    },
  });
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fechar sidebar ao navegar
  useEffect(() => { setSidebarOpen(false); setSearchQuery(""); }, [location]);

  // Fechar sidebar ao pressionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const activeUser = localUser ?? user;
  const activeRole = localUser?.role ?? (user?.role === "admin" ? "admin" : "user");
  const handleLogout = () => {
    if (localUser) logoutLocalMut.mutate();
  };

  // Filtrar itens por busca — DEVE estar antes do return condicional (regra dos hooks)
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    const results: NavItem[] = [];
    for (const section of navSections) {
      for (const item of section.items) {
        if (!item.pageKey || canAccess(item.pageKey)) {
          if (item.label.toLowerCase().includes(q)) {
            results.push(item);
          }
        }
      }
    }
    return results;
  }, [searchQuery, canAccess]);

  if (loading && !localUser) return <DashboardLayoutSkeleton />;

  const initials = (activeUser?.name ?? "U")
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebarLink = (href: string, icon: ReactNode, label: string, badge?: number) => {
    const isActive = href === "/" ? location === "/" : location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link
        key={href}
        href={href}
        className="flex items-center gap-2.5 py-2.5 text-sm transition-all duration-150 no-underline"
        style={{
          paddingLeft: isActive ? "calc(1.25rem - 3px)" : "1.25rem",
          paddingRight: "1rem",
          color: isActive ? "oklch(0.75 0.15 240)" : "oklch(0.60 0.01 240)",
          background: isActive ? "oklch(0.52 0.18 240 / 0.12)" : "transparent",
          borderLeft: isActive ? "3px solid oklch(0.52 0.18 240)" : "3px solid transparent",
          display: "flex",
        }}
      >
        <span style={{ color: isActive ? "oklch(0.62 0.18 240)" : "oklch(0.45 0.01 240)" }}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {badge && badge > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: "oklch(0.55 0.22 25)", color: "white" }}>{badge > 99 ? "99+" : badge}</span>
        ) : null}
        {isActive && !(badge && badge > 0) && <ChevronRight size={11} style={{ color: "oklch(0.52 0.18 240)" }} />}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <div>
          <div className="font-black text-lg leading-tight tracking-tight text-white">
            LETREIROS<br />
            <span style={{ color: "oklch(0.62 0.18 240)" }}>EXPRESS</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest mt-1.5" style={{ color: "oklch(0.40 0.01 240)" }}>
            Portal de Gestão
          </div>
        </div>
        {/* Botão fechar — só mobile */}
        <button
          className="lg:hidden p-2 rounded-lg flex-shrink-0"
          style={{ color: "oklch(0.60 0.01 240)", background: "oklch(0.20 0.015 245)" }}
          onClick={() => setSidebarOpen(false)}
        >
          <X size={16} />
        </button>
      </div>

      {/* Barra de busca */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2.5 pointer-events-none" style={{ color: "oklch(0.45 0.01 240)" }} />
          <input
            type="text"
            placeholder="Buscar no menu..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-7 pr-3 py-2 rounded-lg outline-none transition-colors"
            style={{
              background: "oklch(0.18 0.015 245)",
              border: "1px solid oklch(0.28 0.02 245)",
              color: "oklch(0.80 0.005 240)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 p-0.5 rounded"
              style={{ color: "oklch(0.45 0.01 240)" }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {filteredSections !== null ? (
          // Modo busca: mostrar resultados flat
          <div className="mb-2">
            {filteredSections.length === 0 ? (
              <div className="px-5 py-4 text-xs" style={{ color: "oklch(0.45 0.01 240)" }}>
                Nenhum item encontrado
              </div>
            ) : (
              <>
                <div className="px-5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(0.38 0.01 240)" }}>
                  Resultados ({filteredSections.length})
                </div>
                {filteredSections.map(item => sidebarLink(
                  item.href,
                  item.icon,
                  item.label,
                  item.href === "/qualidade/alertas" ? (alertasCounts?.total ?? 0)
                  : item.href === "/rotinas" ? (rotinasPendentes?.length ?? 0)
                  : undefined
                ))}
              </>
            )}
          </div>
        ) : (
          // Modo normal: mostrar seções
          navSections.map((section) => {
            const visibleItems = section.items.filter(item => {
              if (!item.pageKey) return true;
              return canAccess(item.pageKey);
            });
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label} className="mb-2">
                <div
                  className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "oklch(0.38 0.01 240)" }}
                >
                  {section.label}
                </div>
                {visibleItems.map((item) => sidebarLink(
                  item.href,
                  item.icon,
                  item.label,
                  item.href === "/qualidade/alertas" ? (alertasCounts?.total ?? 0)
                  : item.href === "/rotinas" ? (rotinasPendentes?.length ?? 0)
                  : undefined
                ))}
              </div>
            );
          })
        )}

        {/* Sistema — sempre visível (só no modo normal) */}
        {filteredSections === null && (
          <div className="mb-2">
            <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(0.38 0.01 240)" }}>
              Sistema
            </div>
            {sidebarLink("/admin/usuarios", <Users size={15} />, "Usuários e Permissões")}
            {sidebarLink("/admin", <ShieldCheck size={15} />, "Administração")}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div
        className="px-3 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid oklch(0.22 0.02 245)" }}
      >
        {activeUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 transition-colors hover:bg-white/5 focus:outline-none">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback
                    className="text-xs font-bold"
                    style={{ background: "oklch(0.52 0.18 240)", color: "white" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[0.8rem] font-semibold truncate" style={{ color: "oklch(0.88 0.005 240)" }}>
                    {activeUser.name}
                  </div>
                  <div className="text-[0.65rem] font-medium" style={{ color: "oklch(0.52 0.18 240)" }}>
                    {ROLE_LABELS[activeRole] ?? "Usuário"}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2.5 transition-colors no-underline"
            style={{ background: "oklch(0.52 0.18 240 / 0.15)", color: "oklch(0.75 0.15 240)", border: "1px solid oklch(0.52 0.18 240 / 0.3)" }}
          >
            <LogIn size={16} />
            <span className="text-sm font-semibold">Entrar no sistema</span>
          </Link>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "#f1f5f9" }}>
      {/* ── Overlay mobile ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar desktop (estático) ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{
          width: 240,
          background: "oklch(0.12 0.015 245)",
          borderRight: "1px solid oklch(0.22 0.02 245)",
          minHeight: "100vh",
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Sidebar mobile (deslizante) ── */}
      <aside
        className="lg:hidden fixed top-0 left-0 z-50 flex flex-col h-full transition-transform duration-300 ease-in-out"
        style={{
          width: 260,
          background: "oklch(0.12 0.015 245)",
          borderRight: "1px solid oklch(0.22 0.02 245)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Barra superior com botão hambúrguer + Home */}
        <div
          className="flex items-center gap-3 px-4 py-2 sticky top-0 z-30"
          style={{ background: "oklch(0.16 0.015 245)", borderBottom: "1px solid oklch(0.22 0.02 245)" }}
        >
          {/* Hambúrguer — só mobile */}
          <button
            className="lg:hidden p-2 rounded-lg flex-shrink-0"
            style={{ color: "oklch(0.80 0.005 240)", background: "oklch(0.22 0.02 245)" }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold no-underline transition-all duration-150 hover:opacity-80 active:scale-95"
            style={{
              background: "oklch(0.28 0.02 245)",
              color: "oklch(0.90 0.005 240)",
              border: "1px solid oklch(0.35 0.02 245)",
              letterSpacing: "0.04em",
            }}
          >
            <Home size={14} style={{ color: "oklch(0.62 0.18 240)" }} />
            <span className="hidden sm:inline">VOLTAR PARA HOME</span>
            <span className="sm:hidden">HOME</span>
          </Link>
        </div>

        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
