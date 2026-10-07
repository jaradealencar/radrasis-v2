CREATE TABLE "price_table_affiliation_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_pair_id" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"before_json" text,
	"after_json" text,
	"actor" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_table_affiliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_pair_id" integer NOT NULL,
	"mubisys_produto_id" integer NOT NULL,
	"nome_produto" varchar(256) NOT NULL,
	"categoria" varchar(128),
	"created_by" varchar(128),
	"updated_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_table_block_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"principal_section_id" integer NOT NULL,
	"novo_cliente_section_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_table_affiliation_history" ADD CONSTRAINT "price_table_affiliation_history_block_pair_id_price_table_block_pairs_id_fk" FOREIGN KEY ("block_pair_id") REFERENCES "public"."price_table_block_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_affiliations" ADD CONSTRAINT "price_table_affiliations_block_pair_id_price_table_block_pairs_id_fk" FOREIGN KEY ("block_pair_id") REFERENCES "public"."price_table_block_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_block_pairs" ADD CONSTRAINT "price_table_block_pairs_principal_section_id_price_table_sections_id_fk" FOREIGN KEY ("principal_section_id") REFERENCES "public"."price_table_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_block_pairs" ADD CONSTRAINT "price_table_block_pairs_novo_cliente_section_id_price_table_sections_id_fk" FOREIGN KEY ("novo_cliente_section_id") REFERENCES "public"."price_table_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_table_affiliation_history_pair_data_idx" ON "price_table_affiliation_history" USING btree ("block_pair_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_table_affiliations_pair_produto_idx" ON "price_table_affiliations" USING btree ("block_pair_id","mubisys_produto_id");--> statement-breakpoint
CREATE INDEX "price_table_affiliations_produto_idx" ON "price_table_affiliations" USING btree ("mubisys_produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_table_block_pairs_principal_section_idx" ON "price_table_block_pairs" USING btree ("principal_section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_table_block_pairs_novo_cliente_section_idx" ON "price_table_block_pairs" USING btree ("novo_cliente_section_id");
--> statement-breakpoint
-- Pareia os blocos equivalentes; o pareamento ? persistido e n?o volta a depender de t?tulo.
INSERT INTO "price_table_block_pairs" ("principal_section_id", "novo_cliente_section_id")
SELECT antiga."id", nova."id"
FROM "price_table_sections" antiga
INNER JOIN "price_table_sections" nova
  ON nova."page" = antiga."page" + 10
 AND nova."sectionOrder" = antiga."sectionOrder"
WHERE antiga."page" BETWEEN 1 AND 3;
--> statement-breakpoint
-- IDs persistentes para as faixas, usados por snapshots de pre?o e or?amento.
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
