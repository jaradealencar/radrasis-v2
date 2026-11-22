CREATE TABLE "nf_compra_importacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" varchar(64),
	"serie" varchar(16),
	"chave_acesso" varchar(64),
	"cnpj_fornecedor" varchar(18) NOT NULL,
	"nome_fornecedor" varchar(256),
	"data_emissao" varchar(32),
	"valor_produtos" numeric(14, 2) NOT NULL,
	"valor_frete_nf" numeric(14, 2) DEFAULT '0' NOT NULL,
	"peso_liquido_total_kg" numeric(12, 3),
	"modo_rateio_frete" varchar(16) DEFAULT 'valor_total' NOT NULL,
	"frete_valor_por_kg" numeric(10, 4),
	"percentual_icms" numeric(5, 2) DEFAULT '10' NOT NULL,
	"arquivo_original_url" text,
	"arquivo_tipo" varchar(16),
	"status" varchar(24) DEFAULT 'rascunho' NOT NULL,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"concluido_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "nf_compra_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"importacao_id" integer NOT NULL,
	"numero_item" integer NOT NULL,
	"codigo_fornecedor" varchar(64) NOT NULL,
	"descricao_nf" text NOT NULL,
	"ncm" varchar(16),
	"unidade_compra" varchar(16) NOT NULL,
	"quantidade" numeric(14, 4) NOT NULL,
	"valor_unitario" numeric(14, 6) NOT NULL,
	"valor_total_item" numeric(14, 2) NOT NULL,
	"materia_prima_id" integer,
	"origem_vinculo" varchar(16),
	"unidade_erp" varchar(16),
	"fator_conversao" numeric(16, 8),
	"origem_fator" varchar(24),
	"base_calculo_texto" text,
	"rateio_frete" numeric(14, 4),
	"rateio_icms" numeric(14, 4),
	"custo_item_total" numeric(14, 4),
	"quantidade_erp" numeric(14, 4),
	"custo_real_erp" numeric(14, 6),
	"custo_cadastrado_erp" numeric(14, 6),
	"divergencia_pct" numeric(8, 4),
	"defasado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nf_mp_vinculos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj_fornecedor" varchar(18) NOT NULL,
	"codigo_fornecedor" varchar(64) NOT NULL,
	"descricao_referencia" text NOT NULL,
	"materia_prima_id" integer NOT NULL,
	"unidade_erp" varchar(16) NOT NULL,
	"fator_conversao" numeric(16, 8) NOT NULL,
	"origem_fator" varchar(24) NOT NULL,
	"base_calculo_texto" text,
	"vezes_usado" integer DEFAULT 1 NOT NULL,
	"confirmado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nf_compra_importacoes" ADD CONSTRAINT "nf_compra_importacoes_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nf_compra_itens" ADD CONSTRAINT "nf_compra_itens_importacao_id_nf_compra_importacoes_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."nf_compra_importacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nf_compra_itens" ADD CONSTRAINT "nf_compra_itens_materia_prima_id_materias_primas_id_fk" FOREIGN KEY ("materia_prima_id") REFERENCES "public"."materias_primas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nf_mp_vinculos" ADD CONSTRAINT "nf_mp_vinculos_materia_prima_id_materias_primas_id_fk" FOREIGN KEY ("materia_prima_id") REFERENCES "public"."materias_primas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nf_mp_vinculos" ADD CONSTRAINT "nf_mp_vinculos_confirmado_por_user_id_fk" FOREIGN KEY ("confirmado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nf_compra_importacoes_chave_acesso_uq" ON "nf_compra_importacoes" USING btree ("chave_acesso");--> statement-breakpoint
CREATE INDEX "nf_compra_importacoes_fornecedor_idx" ON "nf_compra_importacoes" USING btree ("cnpj_fornecedor");--> statement-breakpoint
CREATE INDEX "nf_compra_itens_importacao_idx" ON "nf_compra_itens" USING btree ("importacao_id");--> statement-breakpoint
CREATE INDEX "nf_compra_itens_materia_prima_idx" ON "nf_compra_itens" USING btree ("materia_prima_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nf_mp_vinculos_chave_uq" ON "nf_mp_vinculos" USING btree ("cnpj_fornecedor","codigo_fornecedor");