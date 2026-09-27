CREATE TYPE "public"."campanha_fonte_tipo" AS ENUM('erp', 'arquivo');--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_campanha_fontes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"fonte_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_contatos_historico" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"ultimo_envio_em" date NOT NULL,
	"disparo_id" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_fontes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" "campanha_fonte_tipo" NOT NULL,
	"chave" varchar(64) NOT NULL,
	"label" varchar(120) NOT NULL,
	"descricao" text,
	"consulta_erp" varchar(64),
	"arquivo_id" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_fontes_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_arquivos" ALTER COLUMN "campanha_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_campanha_fontes" ADD CONSTRAINT "campanhas_whatsapp_campanha_fontes_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_campanha_fontes" ADD CONSTRAINT "campanhas_whatsapp_campanha_fontes_fonte_id_campanhas_whatsapp_fontes_id_fk" FOREIGN KEY ("fonte_id") REFERENCES "public"."campanhas_whatsapp_fontes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contatos_historico" ADD CONSTRAINT "campanhas_whatsapp_contatos_historico_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_contatos_historico" ADD CONSTRAINT "campanhas_whatsapp_contatos_historico_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_fontes" ADD CONSTRAINT "campanhas_whatsapp_fontes_arquivo_id_campanhas_whatsapp_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."campanhas_whatsapp_arquivos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_campanha_fontes_unique" ON "campanhas_whatsapp_campanha_fontes" USING btree ("campanha_id","fonte_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_contatos_historico_unique" ON "campanhas_whatsapp_contatos_historico" USING btree ("campanha_id","telefone");--> statement-breakpoint
-- Seed das 4 fontes automáticas do ERP (histórico local, sem chamada à API) — pré-cadastradas para seleção
-- rápida na tela de Fontes, como pedido. "consulta_erp" identifica a função de resolução em
-- server/services/fontesErpCampanhas.ts (RESOLVEDORES_ERP).
INSERT INTO "campanhas_whatsapp_fontes" ("tipo", "chave", "label", "descricao", "consulta_erp") VALUES
	('erp', 'erp_clientes_ativos', 'Clientes ativos', 'Compraram nos últimos 6 meses.', 'clientes_ativos'),
	('erp', 'erp_primeira_compra', 'Primeira compra (onboarding)', 'A única compra até agora foi recente (últimos 60 dias).', 'primeira_compra'),
	('erp', 'erp_inativos_6m', 'Inativos (6+ meses sem comprar)', 'Já compraram alguma vez, mas a última compra foi há 6 meses ou mais.', 'inativos_6m'),
	('erp', 'erp_orcaram_nao_compraram', 'Orçaram e não compraram', 'Orçamento nos últimos 90 dias sem venda correspondente.', 'orcaram_nao_compraram')
ON CONFLICT ("chave") DO NOTHING;