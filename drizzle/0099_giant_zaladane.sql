CREATE TABLE "mubisys_vendas_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"os_id" integer NOT NULL,
	"os_numero" integer,
	"item_id" integer NOT NULL,
	"faturada_em" varchar(32) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"produto_id" integer,
	"modelo_id" integer,
	"variacao_id" integer,
	"sku_erp" varchar(120),
	"nome" varchar(256) NOT NULL,
	"modelo_nome" varchar(256),
	"variacao_nome" varchar(256),
	"quantidade" numeric(14, 6) DEFAULT '1' NOT NULL,
	"faturamento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
--> statement-breakpoint
UPDATE "price_table_sections" AS section
SET "contentJson" = jsonb_set(
  section."contentJson"::jsonb,
  '{faixaIds}',
  COALESCE((
    SELECT jsonb_agg(section.id * 1000 + faixa.n ORDER BY faixa.n)
    FROM generate_series(
      1,
      GREATEST(
        0,
        jsonb_array_length(section."contentJson"::jsonb -> 'columns')
          - CASE WHEN section."contentJson"::jsonb ->> 'type' = 'margin_table_multi' THEN 1 ELSE 0 END
      )
    ) AS faixa(n)
  ), '[]'::jsonb)
)::text
WHERE section."contentJson"::jsonb ->> 'type' IN ('margin_table', 'margin_table_multi')
  AND jsonb_typeof(section."contentJson"::jsonb -> 'columns') = 'array';
--> statement-breakpoint
CREATE TABLE "mubisys_vendas_sync_status" (
	"chave" varchar(16) PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"status" varchar(16) DEFAULT 'nunca' NOT NULL,
	"ultima_tentativa_em" timestamp,
	"ultima_sincronizacao_em" timestamp,
	"ordens_sincronizadas" integer DEFAULT 0 NOT NULL,
	"linhas_sincronizadas" integer DEFAULT 0 NOT NULL,
	"linhas_sem_valor" integer DEFAULT 0 NOT NULL,
	"faturamento_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"ultimo_erro" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_table_affiliation_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"row_id" integer NOT NULL,
	"faixa_id" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"before_json" text,
	"after_json" text,
	"actor" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_table_affiliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"row_id" integer NOT NULL,
	"faixa_id" integer NOT NULL,
	"target_type" varchar(24) NOT NULL,
	"mubisys_produto_id" integer,
	"mubisys_modelo_id" integer,
	"mubisys_variacao_id" integer,
	"categoria_key" varchar(128),
	"created_by" varchar(128),
	"updated_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_table_affiliations" ADD CONSTRAINT "price_table_affiliations_section_id_price_table_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."price_table_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mubisys_vendas_itens_os_item_idx" ON "mubisys_vendas_itens" USING btree ("os_id","item_id");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_periodo_sku_idx" ON "mubisys_vendas_itens" USING btree ("ano","mes","sku_erp");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_periodo_modelo_idx" ON "mubisys_vendas_itens" USING btree ("ano","mes","modelo_id");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_periodo_variacao_idx" ON "mubisys_vendas_itens" USING btree ("ano","mes","variacao_id");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_faturada_idx" ON "mubisys_vendas_itens" USING btree ("faturada_em");--> statement-breakpoint
CREATE INDEX "price_table_affiliation_history_faixa_data_idx" ON "price_table_affiliation_history" USING btree ("section_id","row_id","faixa_id","created_at");--> statement-breakpoint
CREATE INDEX "price_table_affiliations_faixa_idx" ON "price_table_affiliations" USING btree ("section_id","row_id","faixa_id");--> statement-breakpoint
CREATE INDEX "price_table_affiliations_produto_idx" ON "price_table_affiliations" USING btree ("mubisys_produto_id");--> statement-breakpoint
CREATE INDEX "price_table_affiliations_modelo_idx" ON "price_table_affiliations" USING btree ("mubisys_modelo_id");--> statement-breakpoint
CREATE INDEX "price_table_affiliations_variacao_idx" ON "price_table_affiliations" USING btree ("mubisys_variacao_id");