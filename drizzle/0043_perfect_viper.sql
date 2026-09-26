CREATE TABLE "guia_fornecedores_clique_eventos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresaChave" varchar(256) NOT NULL,
	"empresaNome" varchar(256) NOT NULL,
	"cidade" varchar(128),
	"estado" varchar(2),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guia_fornecedores_config" ADD COLUMN "mensagemRelatorioMensal" text;--> statement-breakpoint
CREATE INDEX "guia_fornecedores_clique_eventos_empresa_idx" ON "guia_fornecedores_clique_eventos" USING btree ("empresaChave");--> statement-breakpoint
CREATE INDEX "guia_fornecedores_clique_eventos_data_idx" ON "guia_fornecedores_clique_eventos" USING btree ("createdAt");