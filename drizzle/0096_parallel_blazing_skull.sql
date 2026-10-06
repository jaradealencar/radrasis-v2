CREATE TABLE "composicoes_variacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"variacao_sku_erp" varchar(120) NOT NULL,
	"materia_prima_sku_erp" varchar(120) NOT NULL,
	"mubisys_modelo_id" integer NOT NULL,
	"mubisys_variacao_id" integer,
	"consumo_quantidade" numeric(14, 6) NOT NULL,
	"unidade_consumo" varchar(80) NOT NULL,
	"largura_mm" numeric(12, 3),
	"altura_mm" numeric(12, 3),
	"espessura_mm" numeric(10, 3),
	"descritivo_composicao" text,
	"perfil_consumo_mubisys" varchar(160) NOT NULL,
	"formula_consumo" varchar(24) NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"origem" varchar(24) DEFAULT 'csv' NOT NULL,
	"importado_em" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materias_primas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku_erp" varchar(120) NOT NULL,
	"mubisys_materia_prima_id" integer NOT NULL,
	"nome" varchar(256) NOT NULL,
	"unidade_medida" varchar(80) DEFAULT '' NOT NULL,
	"custo_unitario" numeric(14, 4),
	"largura_util_mm" numeric(12, 3),
	"altura_util_mm" numeric(12, 3),
	"espessura_mm" numeric(10, 3),
	"densidade_kg_m3" numeric(12, 4),
	"categoria_erp" varchar(128) DEFAULT '' NOT NULL,
	"tipo_erp" varchar(128) DEFAULT '' NOT NULL,
	"status_erp" varchar(64) DEFAULT '' NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"referencia_custo" varchar(80),
	"sincronizado_em" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "materias_primas_sku_erp_unique" UNIQUE("sku_erp"),
	CONSTRAINT "materias_primas_mubisys_materia_prima_id_unique" UNIQUE("mubisys_materia_prima_id")
);
--> statement-breakpoint
CREATE TABLE "mubisys_espelho_sync_status" (
	"chave" varchar(64) PRIMARY KEY NOT NULL,
	"status" varchar(16) DEFAULT 'nunca' NOT NULL,
	"ultima_tentativa_em" timestamp,
	"ultima_sincronizacao_em" timestamp,
	"ultima_importacao_composicao_em" timestamp,
	"produtos_sincronizados" integer DEFAULT 0 NOT NULL,
	"variacoes_sincronizadas" integer DEFAULT 0 NOT NULL,
	"materias_primas_sincronizadas" integer DEFAULT 0 NOT NULL,
	"linhas_composicao" integer DEFAULT 0 NOT NULL,
	"ultimo_arquivo" varchar(255),
	"ultimo_erro" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mubisys_variacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku_erp" varchar(120) NOT NULL,
	"tipo" varchar(16) NOT NULL,
	"sku_produto_erp" varchar(120) NOT NULL,
	"sku_modelo_erp" varchar(120) NOT NULL,
	"mubisys_produto_id" integer NOT NULL,
	"mubisys_modelo_id" integer NOT NULL,
	"mubisys_variacao_id" integer,
	"produto_nome" varchar(256) NOT NULL,
	"categoria_produto" varchar(128) DEFAULT '' NOT NULL,
	"produto_status" varchar(64) DEFAULT '' NOT NULL,
	"modelo_nome" varchar(256) NOT NULL,
	"unidade_cobranca" varchar(80) DEFAULT '' NOT NULL,
	"modelo_status" varchar(64) DEFAULT '' NOT NULL,
	"modelo_valor_final" numeric(14, 4),
	"variacao_nome" varchar(256),
	"variacao_descricao" text,
	"variacao_status" varchar(64),
	"variacao_valor_final" numeric(14, 4),
	"variacao_padrao" boolean DEFAULT false NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"sincronizado_em" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mubisys_variacoes_sku_erp_unique" UNIQUE("sku_erp")
);
--> statement-breakpoint
ALTER TABLE "composicoes_variacoes" ADD CONSTRAINT "composicoes_variacoes_variacao_sku_erp_mubisys_variacoes_sku_erp_fk" FOREIGN KEY ("variacao_sku_erp") REFERENCES "public"."mubisys_variacoes"("sku_erp") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "composicoes_variacoes" ADD CONSTRAINT "composicoes_variacoes_materia_prima_sku_erp_materias_primas_sku_erp_fk" FOREIGN KEY ("materia_prima_sku_erp") REFERENCES "public"."materias_primas"("sku_erp") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "composicoes_variacoes_variacao_idx" ON "composicoes_variacoes" USING btree ("variacao_sku_erp");--> statement-breakpoint
CREATE INDEX "composicoes_variacoes_materia_prima_idx" ON "composicoes_variacoes" USING btree ("materia_prima_sku_erp");--> statement-breakpoint
CREATE INDEX "composicoes_variacoes_modelo_idx" ON "composicoes_variacoes" USING btree ("mubisys_modelo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "composicoes_variacoes_linha_idx" ON "composicoes_variacoes" USING btree ("variacao_sku_erp","materia_prima_sku_erp","ordem");--> statement-breakpoint
CREATE INDEX "materias_primas_nome_idx" ON "materias_primas" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "materias_primas_ativa_idx" ON "materias_primas" USING btree ("ativa");--> statement-breakpoint
CREATE INDEX "mubisys_variacoes_produto_modelo_idx" ON "mubisys_variacoes" USING btree ("mubisys_produto_id","mubisys_modelo_id");--> statement-breakpoint
CREATE INDEX "mubisys_variacoes_variacao_idx" ON "mubisys_variacoes" USING btree ("mubisys_variacao_id");--> statement-breakpoint
CREATE INDEX "mubisys_variacoes_sku_modelo_idx" ON "mubisys_variacoes" USING btree ("sku_modelo_erp");