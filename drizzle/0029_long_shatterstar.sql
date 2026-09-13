CREATE TABLE "marketing_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"mesesInatividadeReativacao" integer DEFAULT 6 NOT NULL,
	"percentualMargemFallback" numeric(5, 2) DEFAULT '51.00' NOT NULL,
	"cacMaximo" numeric(14, 2),
	"custoReativacaoMaximo" numeric(14, 2),
	"roiMinimoPct" numeric(7, 2),
	"ticketMedioMinimo" numeric(14, 2),
	"metaClientesNovosMes" integer,
	"metaClientesReativadosMes" integer,
	"aumentoMaximoCacMensalPct" numeric(7, 2),
	"janelaAtribuicaoDias" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_config_auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"acao" "auditoria_acao" NOT NULL,
	"usuarioId" text,
	"usuarioNome" varchar(128),
	"usuarioRole" varchar(32),
	"valoresAnteriores" text,
	"valoresNovos" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custo_marketing" ALTER COLUMN "investimento_aquisicao" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "custo_marketing" ALTER COLUMN "investimento_aquisicao" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "custo_marketing" ALTER COLUMN "investimento_reativacao" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "custo_marketing" ALTER COLUMN "investimento_reativacao" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "custo_marketing" ALTER COLUMN "investimento" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "custo_marketing" ALTER COLUMN "investimento" DROP NOT NULL;