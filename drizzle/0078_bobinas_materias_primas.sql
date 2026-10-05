ALTER TABLE "estudio_chapas" ADD COLUMN "bobina" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "materia_prima_categorias" ADD COLUMN "usa_dados_bobina" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "materia_prima_categorias" ("nome", "usa_dados_chapa", "usa_dados_bobina") VALUES ('Bobinas', false, true)
ON CONFLICT ("nome") DO UPDATE SET "usa_dados_bobina" = true;
