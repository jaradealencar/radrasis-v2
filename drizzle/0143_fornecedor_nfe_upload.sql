-- Adiciona campos de upload de NF-e ao cadastro de fornecedores
-- Permite anexar o PDF da NF-e e extrair automaticamente CNPJ, razão social,
-- nome fantasia, número, série e chave de acesso.
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

-- Índice para buscar fornecedor por CNPJ da NF-e
CREATE INDEX IF NOT EXISTS "suppliers_nfe_cnpj_idx" ON "suppliers" ("nfe_cnpj");
