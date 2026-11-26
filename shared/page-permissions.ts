const DEFAULT_PAGE_ACCESS: Record<string, readonly string[]> = {
  // O custo de LED segue os perfis que já podem acessar o custo de solda.
  "operacoes-custo-led": ["producao", "financeiro"],
};

export function hasDefaultPagePermission(role: string, pageKey: string): boolean {
  return DEFAULT_PAGE_ACCESS[pageKey]?.includes(role) ?? false;
}

export function getDefaultPagePermissions(role: string): string[] {
  return Object.entries(DEFAULT_PAGE_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([pageKey]) => pageKey);
}
