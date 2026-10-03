CREATE TABLE "vendedores_comerciais" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(256) NOT NULL,
	"comissao_pct" numeric(7, 4) DEFAULT '0' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendedores_comerciais_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "configuracoes_comerciais" ADD COLUMN "imposto_pct" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "configuracoes_comerciais" ADD COLUMN "custo_fixo_pct" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "configuracoes_comerciais" ADD COLUMN "impostos_por_categoria_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "custoMaoObra" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "proposta_itens" ADD COLUMN "decupagem_json" jsonb;--> statement-breakpoint
ALTER TABLE "proposta_itens" ADD COLUMN "custo_mao_obra_unitario" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "vendedor_comercial_id" integer;--> statement-breakpoint
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_vendedor_comercial_id_vendedores_comerciais_id_fk" FOREIGN KEY ("vendedor_comercial_id") REFERENCES "public"."vendedores_comerciais"("id") ON DELETE set null ON UPDATE no action;