CREATE TYPE "public"."retencao_disparo_status" AS ENUM('pendente', 'disparado', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."retencao_jornada_estagio" AS ENUM('d16u', 'd30', 'd60', 'd90', 'd180', 'd270', 'd365');--> statement-breakpoint
CREATE TABLE "retencao_contato_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_key" varchar(256) NOT NULL,
	"os_numero" varchar(32),
	"contato" varchar(128),
	"telefone" varchar(32),
	"whatsapp_link" varchar(64),
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "retencao_contato_cache_empresa_key_unique" UNIQUE("empresa_key")
);
--> statement-breakpoint
CREATE TABLE "retencao_disparos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_key" varchar(256) NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"os_numero" varchar(32),
	"vendedor" varchar(128),
	"valor_primeira_compra" numeric(14, 2),
	"data_primeira_compra" date NOT NULL,
	"estagio" "retencao_jornada_estagio" NOT NULL,
	"data_agendada" date NOT NULL,
	"status" "retencao_disparo_status" DEFAULT 'pendente' NOT NULL,
	"disparado_em" timestamp,
	"disparado_por" varchar(128),
	"observacao" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retencao_scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"estagio" "retencao_jornada_estagio" NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"titulo" varchar(128),
	"conteudo" text NOT NULL,
	"conteudo_voz" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"copia_count" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "retencao_disparos_empresa_estagio_unique" ON "retencao_disparos" USING btree ("empresa_key","estagio");--> statement-breakpoint
CREATE INDEX "retencao_disparos_data_agendada_idx" ON "retencao_disparos" USING btree ("data_agendada");--> statement-breakpoint
CREATE INDEX "retencao_disparos_status_idx" ON "retencao_disparos" USING btree ("status");