CREATE TABLE "cotacao_externa_atualizacao_custo" (
	"id" serial PRIMARY KEY NOT NULL,
	"materia_prima_id" integer NOT NULL,
	"cotacao_item_id" integer NOT NULL,
	"custo_anterior" numeric(14, 6),
	"custo_novo" numeric(14, 6) NOT NULL,
	"unidade" varchar(16) NOT NULL,
	"observacao" text,
	"criado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotacao_externa_atualizacao_custo" ADD CONSTRAINT "cotacao_externa_atualizacao_custo_materia_prima_id_materias_primas_id_fk" FOREIGN KEY ("materia_prima_id") REFERENCES "public"."materias_primas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacao_externa_atualizacao_custo" ADD CONSTRAINT "cotacao_externa_atualizacao_custo_cotacao_item_id_cotacao_externa_item_id_fk" FOREIGN KEY ("cotacao_item_id") REFERENCES "public"."cotacao_externa_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotacao_externa_atualizacao_custo_mp_idx" ON "cotacao_externa_atualizacao_custo" USING btree ("materia_prima_id");--> statement-breakpoint
CREATE INDEX "cotacao_externa_atualizacao_custo_item_idx" ON "cotacao_externa_atualizacao_custo" USING btree ("cotacao_item_id");