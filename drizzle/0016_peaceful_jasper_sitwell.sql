CREATE TABLE "auditoria_custo_marketing" (
	"id" serial PRIMARY KEY NOT NULL,
	"custoMarketingId" integer,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"acao" "auditoria_acao" NOT NULL,
	"usuarioId" text,
	"usuarioNome" varchar(128),
	"usuarioRole" varchar(32),
	"valoresAnteriores" text,
	"valoresNovos" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
