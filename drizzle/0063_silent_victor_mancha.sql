ALTER TABLE "produto_composicao_materiais" ADD COLUMN "mubisysVariacaoId" integer;--> statement-breakpoint
ALTER TABLE "produto_composicao_materiais" ADD COLUMN "variacaoNome" varchar(256);--> statement-breakpoint
ALTER TABLE "produto_composicao_materiais" ADD COLUMN "variacaoPadrao" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "proposta_itens" ADD COLUMN "configuracaoJson" jsonb DEFAULT '{}'::jsonb NOT NULL;