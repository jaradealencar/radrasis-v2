import { useAuth } from "@/hooks/useAuth";
import AcessoNegado from "@/pages/AcessoNegado";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

interface ProtectedRouteProps {
  pageKey: string;
  children: React.ReactNode;
}

/**
 * Guard de rota que verifica se o usuário tem permissão para acessar a página.
 * - Se ainda carregando: exibe skeleton
 * - Se sem permissão: exibe página 403
 * - Se com permissão: renderiza o conteúdo
 */
export default function ProtectedRoute({ pageKey, children }: ProtectedRouteProps) {
  const { user, isLoading, canAccess } = useAuth();

  // Enquanto carrega as permissões, exibe skeleton
  if (isLoading) return <DashboardLayoutSkeleton />;

  // Sem usuário logado: acesso aberto (sistema interno sem login obrigatório)
  if (!user) return <>{children}</>;

  // Verifica permissão
  if (!canAccess(pageKey)) return <AcessoNegado />;

  return <>{children}</>;
}
