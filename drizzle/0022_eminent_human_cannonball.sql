CREATE TABLE "performance_propostas_followup" (
	"id" serial PRIMARY KEY NOT NULL,
	"orcNumero" varchar(32) NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"usuarioId" text,
	"usuarioNome" varchar(128) NOT NULL,
	"motivo" text NOT NULL,
	"contatadoEm" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "performance_propostas_followup_orc_idx" ON "performance_propostas_followup" USING btree ("orcNumero");--> statement-breakpoint
CREATE INDEX "performance_propostas_followup_mes_ano_idx" ON "performance_propostas_followup" USING btree ("mes","ano");