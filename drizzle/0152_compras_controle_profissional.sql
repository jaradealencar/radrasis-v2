CREATE TABLE "compras_ordem_historico" (
	"id" serial PRIMARY KEY NOT NULL,
	"ordem_id" integer NOT NULL,
	"evento" varchar(32) NOT NULL,
	"antes" jsonb,
	"depois" jsonb NOT NULL,
	"motivo" text,
	"criado_por" text,
	"nome_usuario" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compras_ordem_recebimentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"ordem_id" integer NOT NULL,
	"data_recebimento" varchar(10) NOT NULL,
	"itens" jsonb NOT NULL,
	"observacoes" text NOT NULL,
	"recebido_por" text,
	"nome_recebedor" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compras_politicas" (
	"id" integer PRIMARY KEY NOT NULL,
	"limite_aprovacao" numeric(18, 2),
	"atualizado_por" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compras_cotacoes" ADD COLUMN "arquivo_pdf_url" text;--> statement-breakpoint
ALTER TABLE "compras_cotacoes" ADD COLUMN "arquivo_pdf_key" varchar(256);--> statement-breakpoint
ALTER TABLE "compras_cotacoes" ADD COLUMN "arquivo_pdf_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "compras_cotacoes" ADD COLUMN "arquivo_pdf_tamanho" integer;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "data_prevista_entrega" varchar(10);--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "comparacao_cotacoes" jsonb;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "status_aprovacao" varchar(16) DEFAULT 'dispensada' NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "aprovacao_por" text;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "aprovacao_nome" varchar(256);--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "aprovacao_em" timestamp;--> statement-breakpoint
ALTER TABLE "compras_ordem_historico" ADD CONSTRAINT "compras_ordem_historico_ordem_id_compras_ordens_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."compras_ordens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_ordem_recebimentos" ADD CONSTRAINT "compras_ordem_recebimentos_ordem_id_compras_ordens_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."compras_ordens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compras_ordem_historico_ordem_idx" ON "compras_ordem_historico" USING btree ("ordem_id","created_at");--> statement-breakpoint
CREATE INDEX "compras_ordem_recebimentos_ordem_idx" ON "compras_ordem_recebimentos" USING btree ("ordem_id","data_recebimento");