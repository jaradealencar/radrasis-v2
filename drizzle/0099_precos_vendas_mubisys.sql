CREATE TABLE "mubisys_vendas_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"os_id" integer NOT NULL,
	"os_numero" integer,
	"item_id" integer NOT NULL,
	"faturada_em" varchar(32) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"produto_id" integer,
	"modelo_id" integer,
	"variacao_id" integer,
	"sku_erp" varchar(120),
	"nome" varchar(256) NOT NULL,
	"modelo_nome" varchar(256),
	"variacao_nome" varchar(256),
	"quantidade" numeric(14, 6) DEFAULT '1' NOT NULL,
	"faturamento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mubisys_vendas_sync_status" (
	"chave" varchar(16) PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"status" varchar(16) DEFAULT 'nunca' NOT NULL,
	"ultima_tentativa_em" timestamp,
	"ultima_sincronizacao_em" timestamp,
	"ordens_sincronizadas" integer DEFAULT 0 NOT NULL,
	"linhas_sincronizadas" integer DEFAULT 0 NOT NULL,
	"linhas_sem_valor" integer DEFAULT 0 NOT NULL,
	"faturamento_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"ultimo_erro" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mubisys_vendas_itens_os_item_idx" ON "mubisys_vendas_itens" USING btree ("os_id","item_id");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_periodo_sku_idx" ON "mubisys_vendas_itens" USING btree ("ano","mes","sku_erp");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_periodo_modelo_idx" ON "mubisys_vendas_itens" USING btree ("ano","mes","modelo_id");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_periodo_variacao_idx" ON "mubisys_vendas_itens" USING btree ("ano","mes","variacao_id");--> statement-breakpoint
CREATE INDEX "mubisys_vendas_itens_faturada_idx" ON "mubisys_vendas_itens" USING btree ("faturada_em");