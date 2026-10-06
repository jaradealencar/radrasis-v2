CREATE TABLE "cpq_solda_correcoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotacao_ref" varchar(80),
	"faixa" varchar(12) NOT NULL,
	"contexto_json" jsonb NOT NULL,
	"sugerida_materia_prima_id" integer,
	"escolhida_materia_prima_id" integer NOT NULL,
	"nota" varchar(500),
	"status" varchar(16) DEFAULT 'pendente' NOT NULL,
	"regra_id" integer,
	"usuario_nome" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpq_solda_regras" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(160) NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"prioridade" integer DEFAULT 0 NOT NULL,
	"material" varchar(16),
	"tipo_produto" varchar(80),
	"fixacao_tipos" text[],
	"palavras_titulo" text[] DEFAULT '{}' NOT NULL,
	"faixa" varchar(12),
	"mubisys_materia_prima_id" integer NOT NULL,
	"criada_por_nome" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cpq_solda_correcoes" ADD CONSTRAINT "cpq_solda_correcoes_regra_id_cpq_solda_regras_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."cpq_solda_regras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cpq_solda_correcoes_status_data_idx" ON "cpq_solda_correcoes" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "cpq_solda_regras_ativa_prioridade_idx" ON "cpq_solda_regras" USING btree ("ativa","prioridade");