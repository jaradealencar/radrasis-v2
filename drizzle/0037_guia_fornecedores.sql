CREATE TABLE "guia_fornecedores_cliques" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresaChave" varchar(256) NOT NULL,
	"empresaNome" varchar(256) NOT NULL,
	"cliques" integer DEFAULT 0 NOT NULL,
	"ultimoCliqueEm" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guia_fornecedores_cliques_empresaChave_unique" UNIQUE("empresaChave")
);
--> statement-breakpoint
ALTER TABLE "historico_os" ADD COLUMN "telefone" varchar(32);