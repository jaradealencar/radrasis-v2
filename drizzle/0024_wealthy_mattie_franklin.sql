CREATE TYPE "public"."nivel_confianca_sinal" AS ENUM('confirmado', 'inferencia');--> statement-breakpoint
CREATE TYPE "public"."status_sinal_mercado" AS ENUM('novo', 'qualificando', 'oportunidade', 'associado_cliente', 'descartado', 'expirado');--> statement-breakpoint
CREATE TABLE "radar_mercado_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"regioes_json" text NOT NULL,
	"segmentos_alvo_json" text NOT NULL,
	"concorrentes_conhecidos_json" text DEFAULT '[]' NOT NULL,
	"termos_busca_json" text NOT NULL,
	"exclusoes_json" text DEFAULT '[]' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sinais_mercado" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa" varchar(256),
	"localizacao_texto" varchar(256),
	"uf" varchar(2),
	"municipio" varchar(128),
	"tipo_evento" varchar(64),
	"evidencia_trecho" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" varchar(64) NOT NULL,
	"publicador" varchar(256),
	"data_publicacao" varchar(32),
	"data_evento" varchar(32),
	"data_coleta" timestamp DEFAULT now() NOT NULL,
	"nivel_confianca" "nivel_confianca_sinal" DEFAULT 'inferencia' NOT NULL,
	"relacao_produtos" text,
	"proximo_passo" text,
	"validade_ate" date,
	"ja_cliente_empresa_key" varchar(256),
	"status" "status_sinal_mercado" DEFAULT 'novo' NOT NULL,
	"termo_busca_origem" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sinais_mercado_url_hash_unique" UNIQUE("url_hash")
);
--> statement-breakpoint
CREATE INDEX "sinais_mercado_status_idx" ON "sinais_mercado" USING btree ("status");