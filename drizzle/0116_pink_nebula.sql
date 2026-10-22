CREATE TYPE "public"."guia_fornecedores_questionario_status" AS ENUM('pendente', 'enviado', 'preenchido');--> statement-breakpoint
CREATE TABLE "guia_fornecedores_questionarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_chave" varchar(256) NOT NULL,
	"empresa_nome" varchar(256) NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" "guia_fornecedores_questionario_status" DEFAULT 'pendente' NOT NULL,
	"logo_url" text,
	"atende_cidades_vizinhas" boolean DEFAULT false NOT NULL,
	"raio_atendimento_km" integer,
	"cidades_atendidas" text,
	"produtos" text,
	"outros_produtos" text,
	"telefone_contato" varchar(32),
	"whatsapp" varchar(32),
	"instagram" varchar(128),
	"site" varchar(256),
	"descricao" text,
	"enviado_em" timestamp,
	"preenchido_em" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guia_fornecedores_questionarios_empresa_chave_unique" UNIQUE("empresa_chave"),
	CONSTRAINT "guia_fornecedores_questionarios_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE INDEX "guia_fornecedores_questionarios_token_idx" ON "guia_fornecedores_questionarios" USING btree ("token");--> statement-breakpoint
CREATE INDEX "guia_fornecedores_questionarios_status_idx" ON "guia_fornecedores_questionarios" USING btree ("status");