CREATE TYPE "public"."guia_fornecedores_override_acao" AS ENUM('incluir', 'excluir');--> statement-breakpoint
CREATE TABLE "guia_fornecedores_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresaChave" varchar(256) NOT NULL,
	"empresaNome" varchar(256) NOT NULL,
	"acao" "guia_fornecedores_override_acao" NOT NULL,
	"telefone" varchar(32),
	"cidade" varchar(128),
	"estado" varchar(2),
	"usuarioId" text,
	"usuarioNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guia_fornecedores_overrides_empresaChave_unique" UNIQUE("empresaChave")
);
--> statement-breakpoint
CREATE TABLE "guia_fornecedores_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitanteId" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guia_fornecedores_visitas_visitante_idx" ON "guia_fornecedores_visitas" USING btree ("visitanteId");--> statement-breakpoint
CREATE INDEX "guia_fornecedores_visitas_data_idx" ON "guia_fornecedores_visitas" USING btree ("createdAt");