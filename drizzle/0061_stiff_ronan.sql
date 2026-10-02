CREATE TABLE "estudio_kits" (
	"chave" varchar(80) PRIMARY KEY NOT NULL,
	"produto_id" integer NOT NULL,
	"modelo_id" integer NOT NULL,
	"dados_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "estudio_kits_produto_modelo_idx" ON "estudio_kits" USING btree ("produto_id","modelo_id");