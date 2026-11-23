CREATE TABLE "compras_logistica_historico" (
	"id" serial PRIMARY KEY NOT NULL,
	"ordem_id" integer NOT NULL,
	"revisao" integer NOT NULL,
	"dados" jsonb NOT NULL,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compras_cotacoes" ADD COLUMN "frete_modo" varchar(16);--> statement-breakpoint
ALTER TABLE "compras_cotacoes" ADD COLUMN "frete_valor_informado" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "compras_cotacoes" ADD COLUMN "peso_frete_kg" numeric(18, 3);--> statement-breakpoint
ALTER TABLE "compras_ordem_nfs" ADD COLUMN "logistica_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "frete_confirmado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "frete_modo" varchar(16) DEFAULT 'valor_total' NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "frete_valor_informado" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "peso_previsto_kg" numeric(18, 3);--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "logistica_revisao" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_logistica_historico" ADD CONSTRAINT "compras_logistica_historico_ordem_id_compras_ordens_id_fk" FOREIGN KEY ("ordem_id") REFERENCES "public"."compras_ordens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compras_logistica_ordem_revisao_uq" ON "compras_logistica_historico" USING btree ("ordem_id","revisao");