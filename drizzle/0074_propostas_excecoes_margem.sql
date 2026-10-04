CREATE TABLE "propostas_excecoes_margem" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "propostas_excecoes_margem_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"proposta_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"gestor_id" text NOT NULL,
	"gestor_nome" varchar(128) NOT NULL,
	"gestor_role" varchar(32) NOT NULL,
	"produto_id" integer NOT NULL,
	"preco_aprovado" numeric(12, 2) NOT NULL,
	"preco_minimo_tecnico" numeric(12, 2) NOT NULL,
	"motivo_justificativa" text NOT NULL,
	"recibo_assinado" text NOT NULL,
	"dados_json" jsonb NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "propostas_excecoes_margem" ADD CONSTRAINT "propostas_excecoes_margem_proposta_id_propostas_id_fk" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propostas_excecoes_margem" ADD CONSTRAINT "propostas_excecoes_margem_gestor_id_user_id_fk" FOREIGN KEY ("gestor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "propostas_excecoes_margem_proposta_idx" ON "propostas_excecoes_margem" USING btree ("proposta_id","criado_em");--> statement-breakpoint
CREATE INDEX "propostas_excecoes_margem_item_idx" ON "propostas_excecoes_margem" USING btree ("item_id","criado_em");--> statement-breakpoint
CREATE INDEX "propostas_excecoes_margem_gestor_idx" ON "propostas_excecoes_margem" USING btree ("gestor_id");--> statement-breakpoint
CREATE FUNCTION "impedir_alteracao_propostas_excecoes_margem"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Os registros de exceção de margem são imutáveis.'; END; $$;--> statement-breakpoint
CREATE TRIGGER "propostas_excecoes_margem_imutavel" BEFORE UPDATE OR DELETE ON "propostas_excecoes_margem" FOR EACH ROW EXECUTE FUNCTION "impedir_alteracao_propostas_excecoes_margem"();--> statement-breakpoint
CREATE TRIGGER "propostas_excecoes_margem_sem_truncate" BEFORE TRUNCATE ON "propostas_excecoes_margem" FOR EACH STATEMENT EXECUTE FUNCTION "impedir_alteracao_propostas_excecoes_margem"();
