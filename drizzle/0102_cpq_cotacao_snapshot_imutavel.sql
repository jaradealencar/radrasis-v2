CREATE TABLE "estudio_cotacao_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposta_id" integer NOT NULL,
	"revisao" integer NOT NULL,
	"source_id" varchar(80) NOT NULL,
	"snapshot_json" text NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"tabela_preco" varchar(32),
	"tabela_preco_versao" varchar(16),
	"secao_id" integer,
	"secao_titulo" varchar(256),
	"linha_id" integer,
	"linha_label" varchar(256),
	"faixa_id" integer,
	"faixa_index" integer,
	"faixa_label" varchar(256),
	"custo_insumos" numeric(14, 2) NOT NULL,
	"custo_base_faixa" numeric(14, 2) NOT NULL,
	"margem_pct" numeric(7, 4),
	"preco_final" numeric(14, 2) NOT NULL,
	"mubisys_os_id" integer,
	"criado_por" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estudio_cotacao_snapshots" ADD CONSTRAINT "estudio_cotacao_snapshots_proposta_id_propostas_id_fk" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estudio_cotacao_snapshots_proposta_revisao_uidx" ON "estudio_cotacao_snapshots" USING btree ("proposta_id","revisao");--> statement-breakpoint
CREATE UNIQUE INDEX "estudio_cotacao_snapshots_proposta_hash_uidx" ON "estudio_cotacao_snapshots" USING btree ("proposta_id","snapshot_hash");--> statement-breakpoint
CREATE INDEX "estudio_cotacao_snapshots_os_idx" ON "estudio_cotacao_snapshots" USING btree ("mubisys_os_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_estudio_cotacao_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Snapshots comerciais do CPQ são imutáveis';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER estudio_cotacao_snapshots_immutable
BEFORE UPDATE OR DELETE ON estudio_cotacao_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_estudio_cotacao_snapshot_mutation();
