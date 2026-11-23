CREATE TABLE "fornecedor_compras" (
	"id" serial PRIMARY KEY NOT NULL,
	"fornecedor_id" integer NOT NULL,
	"documento" varchar(128) NOT NULL,
	"numero" varchar(64),
	"serie" varchar(32),
	"data_emissao" varchar(32),
	"valor_produtos" numeric(14, 2),
	"origem" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "cadastro_concluido" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "fornecedor_compras" ADD CONSTRAINT "fornecedor_compras_fornecedor_id_suppliers_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fornecedor_compras_documento_uq" ON "fornecedor_compras" USING btree ("documento");--> statement-breakpoint
CREATE INDEX "fornecedor_compras_fornecedor_idx" ON "fornecedor_compras" USING btree ("fornecedor_id");