import { useAuth } from "@/hooks/useAuth";
import AcessoNegado from "@/pages/AcessoNegado";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  pageKey: string;
  children: React.ReactNode;
}

/**
 * Guard de rota que verifica se o usuário tem permissão para acessar a página.
 * - Se ainda carregando: exibe skeleton
 * - Sem usuário logado: redireciona para /login (login é obrigatório para todo o app)
 * - Se sem permissão: exibe página 403
 * - Se com permissão: renderiza o conteúdo
 */
export default function ProtectedRoute({ pageKey, children }: ProtectedRouteProps) {
  const { user, isLoading, canAccess } = useAuth();

  if (isLoading) return <DashboardLayoutSkeleton />;

  if (!user) return <Redirect to="/login" />;

  if (!canAccess(pageKey)) return <AcessoNegado />;

  return <>{children}</>;
}
