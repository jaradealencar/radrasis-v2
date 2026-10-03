CREATE TABLE "estudio_chapas" (
	"id" serial PRIMARY KEY NOT NULL,
	"mubisys_materia_prima_id" integer NOT NULL,
	"nome" varchar(256) NOT NULL,
	"largura_mm" integer NOT NULL,
	"altura_mm" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "estudio_chapas_material_idx" ON "estudio_chapas" USING btree ("mubisys_materia_prima_id","ativo");--> statement-breakpoint
CREATE UNIQUE INDEX "estudio_chapas_material_tamanho_uidx" ON "estudio_chapas" USING btree ("mubisys_materia_prima_id","largura_mm","altura_mm");