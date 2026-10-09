CREATE TABLE "price_table_model_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"mubisys_produto_id" integer NOT NULL,
	"mubisys_modelo_id" integer NOT NULL,
	"produtividade_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"principal_price_id" integer,
	"novo_cliente_price_id" integer,
	"updated_by" varchar(128),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "price_table_model_mappings_produto_modelo_idx" ON "price_table_model_mappings" USING btree ("mubisys_produto_id","mubisys_modelo_id");