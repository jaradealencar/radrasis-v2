CREATE TYPE "public"."inteligencia_acao_resultado" AS ENUM('contato_realizado', 'sem_resposta', 'projeto_futuro', 'orcamento_solicitado', 'compra', 'adiamento', 'sem_interesse');--> statement-breakpoint
CREATE TYPE "public"."inteligencia_acao_status" AS ENUM('pendente', 'concluida', 'adiada', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."inteligencia_acao_tipo" AS ENUM('primeira_sem_segunda', 'atraso_recompra', 'alto_volume_baixa_margem');--> statement-breakpoint
CREATE TABLE "inteligencia_acoes_clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" "inteligencia_acao_tipo" NOT NULL,
	"empresa_key" varchar(256) NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"motivo" text NOT NULL,
	"evidencia_json" text NOT NULL,
	"prioridade" integer DEFAULT 0 NOT NULL,
	"prioridade_fatores_json" text,
	"status" "inteligencia_acao_status" DEFAULT 'pendente' NOT NULL,
	"responsavel" varchar(128),
	"proximo_passo" text,
	"prazo" date,
	"resultado" "inteligencia_acao_resultado",
	"resultado_observacao" text,
	"versao_regra" varchar(16) DEFAULT 'v1' NOT NULL,
	"data_analise" timestamp DEFAULT now() NOT NULL,
	"resolvido_em" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "inteligencia_acoes_tipo_empresa_unique" ON "inteligencia_acoes_clientes" USING btree ("tipo","empresa_key");--> statement-breakpoint
CREATE INDEX "inteligencia_acoes_status_idx" ON "inteligencia_acoes_clientes" USING btree ("status");