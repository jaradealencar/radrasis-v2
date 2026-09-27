CREATE TABLE "campanhas_whatsapp_categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave" varchar(64) NOT NULL,
	"label" varchar(80) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_categorias_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
-- Seed com as mesmas 5 chaves do enum "campanha_whatsapp_categoria" que esta migration substitui — preserva o
-- valor já gravado em campanhas_whatsapp.categoria (a coluna vira varchar abaixo, sem remapear dado nenhum).
INSERT INTO "campanhas_whatsapp_categorias" ("chave", "label", "ordem") VALUES
	('novo_lead', 'Novo lead', 1),
	('orcamento_perdido', 'Orçamento perdido', 2),
	('reativacao_inativo', 'Reativação de inativos', 3),
	('pos_venda', 'Pós-venda', 4),
	('outbound', 'Outbound', 5)
ON CONFLICT ("chave") DO NOTHING;
--> statement-breakpoint
-- USING explícito: não há cast implícito de enum pra varchar no Postgres.
ALTER TABLE "campanhas_whatsapp" ALTER COLUMN "categoria" SET DATA TYPE varchar(64) USING "categoria"::text;--> statement-breakpoint
DROP TYPE "public"."campanha_whatsapp_categoria";
