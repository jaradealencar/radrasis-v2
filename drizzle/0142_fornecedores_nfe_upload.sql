ALTER TABLE "suppliers"
  ADD COLUMN "nfe_cnpj" varchar(32),
  ADD COLUMN "nfe_razao_social" varchar(256),
  ADD COLUMN "nfe_nome_fantasia" varchar(256),
  ADD COLUMN "nfe_numero" varchar(64),
  ADD COLUMN "nfe_serie" varchar(32),
  ADD COLUMN "nfe_chave_acesso" varchar(64),
  ADD COLUMN "nfe_arquivo_nome" varchar(256),
  ADD COLUMN "nfe_arquivo_key" varchar(256),
  ADD COLUMN "nfe_arquivo_url" varchar(512),
  ADD COLUMN "nfe_ultima_atualizacao" timestamp;
--> statement-breakpoint
CREATE INDEX "suppliers_nfe_cnpj_idx" ON "suppliers" ("nfe_cnpj");
