CREATE TABLE "compras_compradores" (
	"id" integer PRIMARY KEY NOT NULL,
	"dados" jsonb NOT NULL,
	"atualizado_por" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compras_cotacao_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotacao_id" integer NOT NULL,
	"codigo" text,
	"descricao" text NOT NULL,
	"materia_prima_id" integer,
	"nome_materia_prima" text,
	"quantidade" numeric(18, 6) NOT NULL,
	"unidade" varchar(80) NOT NULL,
	"preco_unitario" numeric(18, 6) NOT NULL,
	"unidade_origem" varchar(80),
	"unidade_destino" varchar(80),
	"fator_conversao" numeric(24, 8),
	"formula" text,
	"custo_mubisys" numeric(18, 6)
);
--> statement-breakpoint
CREATE TABLE "compras_cotacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave" uuid NOT NULL,
	"fornecedor" varchar(256) NOT NULL,
	"cnpj_fornecedor" varchar(18),
	"data_cotacao" varchar(10) NOT NULL,
	"validade_dias" integer,
	"condicao_pagamento" text,
	"prazo_entrega" text,
	"frete" numeric(18, 2),
	"total" numeric(18, 2) NOT NULL,
	"nome_arquivo" text,
	"observacoes" text,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compras_cotacoes_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "compras_ordem_nfs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ordem_id" integer NOT NULL,
	"importacao_id" integer NOT NULL,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compras_ordens" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave" uuid NOT NULL,
	"cotacao_id" integer NOT NULL,
	"comprador" jsonb NOT NULL,
	"pagamento" varchar(16) NOT NULL,
	"condicao_pagamento" text NOT NULL,
	"transportadora" text NOT NULL,
	"numero_coleta" text NOT NULL,
	"frete" numeric(18, 2) NOT NULL,
	"total" numeric(18, 2) NOT NULL,
	"observacoes" text NOT NULL,
	"itens" jsonb NOT NULL,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compras_ordens_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
ALTER TABLE "compras_cotacao_itens" ADD CONSTRAINT "compras_cotacao_itens_cotacao_id_compras_cotacoes_id_fk" FOREIGN KEY ("cotacao_id") REFERENCES "public"."compras_cotacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_cotacao_itens" ADD CONSTRAINT "compras_cotacao_itens_materia_prima_id_materias_primas_id_fk" FOREIGN KEY ("materia_prima_id") REFERENCES "public"."materias_primas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_ordem_nfs" ADD CONSTRAINT "compras_ordem_nfs_ordem_id_compras_ordens_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."compras_ordens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_ordem_nfs" ADD CONSTRAINT "compras_ordem_nfs_importacao_id_nf_compra_importacoes_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."nf_compra_importacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD CONSTRAINT "compras_ordens_cotacao_id_compras_cotacoes_id_fk" FOREIGN KEY ("cotacao_id") REFERENCES "public"."compras_cotacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compras_cotacao_itens_cotacao_idx" ON "compras_cotacao_itens" USING btree ("cotacao_id");--> statement-breakpoint
CREATE INDEX "compras_cotacao_itens_mp_idx" ON "compras_cotacao_itens" USING btree ("materia_prima_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compras_ordem_nfs_nf_uq" ON "compras_ordem_nfs" USING btree ("importacao_id");--> statement-breakpoint
CREATE INDEX "compras_ordens_cotacao_idx" ON "compras_ordens" USING btree ("cotacao_id");