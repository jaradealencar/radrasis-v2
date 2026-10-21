CREATE TABLE "campanhas_auditor_execucoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"escopo" varchar(16) NOT NULL,
	"modulo" varchar(120),
	"modo" varchar(24) NOT NULL,
	"usuario_id" text,
	"commit_sha" varchar(128),
	"branch" varchar(256),
	"ambiente" varchar(32),
	"published_sha" varchar(128),
	"resumo" jsonb NOT NULL,
	"resultados" jsonb NOT NULL,
	"finalizada" boolean DEFAULT false NOT NULL,
	"iniciado_em" timestamp DEFAULT now() NOT NULL,
	"concluido_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_auditor_requisitos" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text NOT NULL,
	"modulo" varchar(120) NOT NULL,
	"criterios_aceite" text NOT NULL,
	"testes_associados" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"criticidade" varchar(16) NOT NULL,
	"status_atual" varchar(32) NOT NULL,
	"evidencia" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ultima_verificacao" timestamp,
	"versao_software" varchar(128),
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "campanhas_auditor_execucoes_inicio_idx" ON "campanhas_auditor_execucoes" USING btree ("iniciado_em");--> statement-breakpoint
CREATE INDEX "campanhas_auditor_execucoes_commit_idx" ON "campanhas_auditor_execucoes" USING btree ("commit_sha");--> statement-breakpoint
CREATE INDEX "campanhas_auditor_requisitos_modulo_idx" ON "campanhas_auditor_requisitos" USING btree ("modulo");--> statement-breakpoint
CREATE INDEX "campanhas_auditor_requisitos_status_idx" ON "campanhas_auditor_requisitos" USING btree ("status_atual");--> statement-breakpoint
CREATE OR REPLACE FUNCTION campanhas_auditor_proteger_historico()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' OR OLD.finalizada THEN
		RAISE EXCEPTION 'Histórico de auditoria finalizado é imutável';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER campanhas_auditor_historico_immutability
BEFORE UPDATE OR DELETE ON campanhas_auditor_execucoes
FOR EACH ROW EXECUTE FUNCTION campanhas_auditor_proteger_historico();
