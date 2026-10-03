CREATE TABLE "materia_prima_cadastros" (
	"mubisys_materia_prima_id" integer PRIMARY KEY NOT NULL,
	"categoria_id" integer,
	"espessura_mm" numeric(10, 3),
	"densidade_kg_m3" numeric(12, 4),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materia_prima_categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(128) NOT NULL,
	"usa_dados_chapa" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "materia_prima_categorias_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD CONSTRAINT "materia_prima_cadastros_categoria_id_materia_prima_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."materia_prima_categorias"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "materia_prima_categorias" ("nome", "usa_dados_chapa") VALUES
  ('Iluminação', false),
  ('Chapas', true),
  ('Insumos Gerais', false),
  ('Elétrica', false),
  ('Insumos Solda', false)
ON CONFLICT ("nome") DO NOTHING;
