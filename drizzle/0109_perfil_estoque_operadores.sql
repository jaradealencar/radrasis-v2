INSERT INTO "role_permissions" ("role", "pageKey", "canAccess")
SELECT 'producao', 'operacoes-estoque-perfis', 'sim'
WHERE NOT EXISTS (
  SELECT 1 FROM "role_permissions"
  WHERE "role" = 'producao' AND "pageKey" = 'operacoes-estoque-perfis'
);--> statement-breakpoint
INSERT INTO "role_permissions" ("role", "pageKey", "canAccess")
SELECT 'logistica', 'operacoes-estoque-perfis', 'sim'
WHERE NOT EXISTS (
  SELECT 1 FROM "role_permissions"
  WHERE "role" = 'logistica' AND "pageKey" = 'operacoes-estoque-perfis'
);
