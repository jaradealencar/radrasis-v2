CREATE TABLE "cotacao_externa_fornecedor" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj" varchar(18) NOT NULL,
	"nome_fantasia" varchar(256) NOT NULL,
	"razao_social" varchar(256),
	"telefone" varchar(32),
	"email" varchar(256),
	"cidade" varchar(128),
	"estado" varchar(2),
	"observacoes" text,
	"ja_trabalhamos" boolean DEFAULT false NOT NULL,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacao_externa_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"fornecedor_id" integer NOT NULL,
	"codigo_fornecedor" varchar(64),
	"descricao" varchar(512) NOT NULL,
	"unidade" varchar(16) NOT NULL,
	"preco_unitario" numeric(14, 6) NOT NULL,
	"preco_total" numeric(14, 2),
	"quantidade" numeric(14, 4),
	"data_cotacao" varchar(32),
	"validade_dias" integer,
	"condicao_pagamento" varchar(128),
	"prazo_entrega" varchar(128),
	"arquivo_origem_url" text,
	"materia_prima_id" integer,
	"vinculado_ao_item_nf" boolean DEFAULT false NOT NULL,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacao_externa_vinculo" (
	"id" serial PRIMARY KEY NOT NULL,
	"descricao_origem" varchar(256) NOT NULL,
	"cotacao_item_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotacao_externa_item" ADD CONSTRAINT "cotacao_externa_item_fornecedor_id_cotacao_externa_fornecedor_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."cotacao_externa_fornecedor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacao_externa_item" ADD CONSTRAINT "cotacao_externa_item_materia_prima_id_materias_primas_id_fk" FOREIGN KEY ("materia_prima_id") REFERENCES "public"."materias_primas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacao_externa_vinculo" ADD CONSTRAINT "cotacao_externa_vinculo_cotacao_item_id_cotacao_externa_item_id_fk" FOREIGN KEY ("cotacao_item_id") REFERENCES "public"."cotacao_externa_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotacao_externa_fornecedor_cnpj_idx" ON "cotacao_externa_fornecedor" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "cotacao_externa_item_fornecedor_idx" ON "cotacao_externa_item" USING btree ("fornecedor_id");--> statement-breakpoint
CREATE INDEX "cotacao_externa_item_materia_prima_idx" ON "cotacao_externa_item" USING btree ("materia_prima_id");--> statement-breakpoint
CREATE INDEX "cotacao_externa_vinculo_cotacao_item_idx" ON "cotacao_externa_vinculo" USING btree ("cotacao_item_id");
