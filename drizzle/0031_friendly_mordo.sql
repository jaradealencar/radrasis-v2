CREATE TYPE "public"."motivo_descarte_cnpj" AS ENUM('pessoa_fisica', 'sem_documento');--> statement-breakpoint
CREATE TABLE "clientes_perfil_cnpj_descartados" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_key" varchar(256) NOT NULL,
	"empresa_exibicao" varchar(256) NOT NULL,
	"motivo" "motivo_descarte_cnpj" NOT NULL,
	"descartado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_perfil_cnpj_descartados_empresa_key_unique" UNIQUE("empresa_key")
);
