ALTER TABLE "custo_marketing" ADD COLUMN "investimento_aquisicao" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "custo_marketing" ADD COLUMN "investimento_reativacao" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- Backfill: histórico existente era lançado como investimento único, sem distinção de categoria.
-- Assume-se 100% aquisição, já que a categoria "reativação" não existia antes desta migration.
UPDATE "custo_marketing" SET "investimento_aquisicao" = "investimento";