-- Corrige colunas de erp_os_cache que divergiam da tabela real do MySQL de origem
-- (nomeVendedor nunca existiu de fato — a coluna real é "vendedor"; dataAprovacao
-- é texto livre, não date consistente — ver server/scheduled-sync-os.ts).
-- Também remove o índice único errado em cnpj (produção legitimamente tem CNPJs
-- repetidos — um cliente pode ter várias OS).
--> statement-breakpoint
ALTER TABLE "erp_os_cache" RENAME COLUMN "nomeVendedor" TO "vendedor";
--> statement-breakpoint
ALTER TABLE "erp_os_cache" ALTER COLUMN "vendedor" TYPE varchar(128);
--> statement-breakpoint
ALTER TABLE "erp_os_cache" ALTER COLUMN "dataAprovacao" TYPE varchar(64) USING "dataAprovacao"::text;
--> statement-breakpoint
DROP INDEX IF EXISTS "erp_os_cache_cnpj_idx";
