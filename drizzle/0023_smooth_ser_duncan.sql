CREATE TYPE "public"."origem_vinculo_cnpj" AS ENUM('erp_os_cache', 'manual');--> statement-breakpoint
CREATE TABLE "clientes_perfil_cnpj" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_key" varchar(256) NOT NULL,
	"empresa_exibicao" varchar(256) NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"razao_social" varchar(256),
	"situacao_cadastral" varchar(32),
	"data_inicio_atividade" varchar(32),
	"idade_anos" numeric(5, 1),
	"porte" varchar(16),
	"natureza_juridica" varchar(128),
	"qtd_socios" integer,
	"capital_social" numeric(16, 2),
	"uf" varchar(2),
	"municipio" varchar(128),
	"cnae_principal" varchar(16),
	"dados_json" text NOT NULL,
	"origem" "origem_vinculo_cnpj" NOT NULL,
	"vinculado_por" varchar(128),
	"vinculado_em" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_perfil_cnpj_empresa_key_unique" UNIQUE("empresa_key")
);
