CREATE TABLE "performance_propostas_contatado" (
	"id" serial PRIMARY KEY NOT NULL,
	"orcNumero" varchar(32) NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"contatado" boolean DEFAULT false NOT NULL,
	"usuarioId" text,
	"usuarioNome" varchar(128),
	"contatadoEm" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "performance_propostas_contatado_orcNumero_unique" UNIQUE("orcNumero")
);
--> statement-breakpoint
CREATE INDEX "performance_propostas_contatado_mes_ano_idx" ON "performance_propostas_contatado" USING btree ("mes","ano");