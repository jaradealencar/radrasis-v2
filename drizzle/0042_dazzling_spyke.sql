CREATE TABLE "retencao_campanhas" (
	"id" serial PRIMARY KEY NOT NULL,
	"estagio" "retencao_jornada_estagio" NOT NULL,
	"numero" integer NOT NULL,
	"quantidade_clientes" integer NOT NULL,
	"disparada_em" timestamp DEFAULT now() NOT NULL,
	"disparado_por" varchar(128)
);
--> statement-breakpoint
ALTER TABLE "retencao_disparos" ADD COLUMN "campanha_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "retencao_campanhas_estagio_numero_unique" ON "retencao_campanhas" USING btree ("estagio","numero");--> statement-breakpoint
CREATE INDEX "retencao_disparos_campanha_idx" ON "retencao_disparos" USING btree ("campanha_id");