import { authClient, useSession, signOut } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

/**
 * Hook único de autenticação/autorização do app — substitui os antigos
 * `useAuth` (OAuth Manus) e `useLocalAuth` (login local caseiro) da Fase 3
 * da migração (Better Auth). Identidade/sessão vêm do client do Better
 * Auth (`useSession`, store global — não precisa de Provider); as
 * permissões por página continuam vindo da tabela `role_permissions`
 * própria do app via tRPC.
 */
export function useAuth() {
  const { data, isPending, refetch: refetchSession } = useSession();
  const user = data?.user ?? null;

  const permsQuery = trpc.permissions.myPermissions.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const permissions = permsQuery.data ?? [];

  // Sem usuário logado: modo aberto — tudo visível (sistema interno sem
  // login obrigatório, comportamento preservado da Fase 2).
  const canAccess = (pageKey: string): boolean => {
    if (!user) return true;
    if (user.role === "master" || user.role === "admin") return true;
    return permissions.includes(pageKey);
  };

  const isLoading = isPending || (!!user && permsQuery.isLoading);

  const logout = async () => {
    await signOut();
  };

  const refetch = () => {
    refetchSession();
    permsQuery.refetch();
  };

  return { user, permissions, isLoading, canAccess, logout, refetch };
}

export { authClient };
