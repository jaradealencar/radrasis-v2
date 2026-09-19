CREATE TABLE "midias_galerias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(60) NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "midias_galerias_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "midias_biblioteca" ADD COLUMN "galeriaId" integer;--> statement-breakpoint
ALTER TABLE "midias_biblioteca" ADD CONSTRAINT "midias_biblioteca_galeriaId_midias_galerias_id_fk" FOREIGN KEY ("galeriaId") REFERENCES "public"."midias_galerias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "midias_biblioteca_galeria_idx" ON "midias_biblioteca" USING btree ("galeriaId");--> statement-breakpoint
-- Converte as categorias (texto livre) que já existiam em galerias e liga as imagens a elas.
-- A coluna "categoria" continua na tabela, sem uso (nada é apagado).
INSERT INTO "midias_galerias" ("nome")
  SELECT DISTINCT trim("categoria") FROM "midias_biblioteca"
  WHERE "categoria" IS NOT NULL AND trim("categoria") <> ''
  ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "midias_biblioteca" AS m SET "galeriaId" = g."id"
  FROM "midias_galerias" AS g
  WHERE m."categoria" IS NOT NULL AND g."nome" = trim(m."categoria");
