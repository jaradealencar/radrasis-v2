CREATE TABLE "crm_probabilidade_previsoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"orc_numero" varchar(32) NOT NULL,
	"data_proposta" timestamp,
	"exibida_em" timestamp DEFAULT now() NOT NULL,
	"probabilidade_pct" integer NOT NULL,
	"modelo_versao" varchar(64) NOT NULL,
	"valor_proposta" numeric(14, 2) DEFAULT '0' NOT NULL,
	"faixa_ticket" varchar(32) NOT NULL,
	"faixa_idade_empresa" varchar(40) NOT NULL,
	"coorte_cliente" varchar(40) NOT NULL,
	"faixa_recencia_compra" varchar(32) NOT NULL,
	"compras_ultimos_12m" integer DEFAULT 0 NOT NULL,
	"valor_compras_ultimos_12m" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vendedor" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_probabilidade_previsoes_orc_numero_unique" ON "crm_probabilidade_previsoes" USING btree ("orc_numero");--> statement-breakpoint
CREATE INDEX "crm_probabilidade_previsoes_exibida_em_idx" ON "crm_probabilidade_previsoes" USING btree ("exibida_em");--> statement-breakpoint
CREATE INDEX "crm_probabilidade_previsoes_vendedor_exibida_em_idx" ON "crm_probabilidade_previsoes" USING btree ("vendedor","exibida_em");