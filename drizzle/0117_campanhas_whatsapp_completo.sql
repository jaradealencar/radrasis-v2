CREATE TYPE "public"."campanha_cadencia_envio_status" AS ENUM('aguardando', 'enviando', 'pendente_conciliacao', 'aceito', 'entregue', 'falhou', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."campanha_cadencia_status" AS ENUM('aguardando', 'enviando', 'pendente_conciliacao', 'pausado_por_resposta', 'removido_por_conversao', 'removido_por_prioridade', 'opt_out', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."campanha_regra_cadencia" AS ENUM('dias_corridos', 'fim_de_mes', 'dia_fixo_mes');--> statement-breakpoint
ALTER TYPE "public"."campanha_fonte_tipo" ADD VALUE 'regras_erp' BEFORE 'arquivo';--> statement-breakpoint
ALTER TYPE "public"."campanha_fonte_tipo" ADD VALUE 'retargeting';--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_cadencia_envios" (
	"id" serial PRIMARY KEY NOT NULL,
	"inscricao_id" integer NOT NULL,
	"campanha_id" integer NOT NULL,
	"telefone_e164" varchar(16) NOT NULL,
	"etapa" integer NOT NULL,
	"tentativa" integer DEFAULT 1 NOT NULL,
	"template_id" varchar(120) NOT NULL,
	"status" "campanha_cadencia_envio_status" DEFAULT 'aguardando' NOT NULL,
	"provedor" varchar(24) DEFAULT 'wts_chat' NOT NULL,
	"id_mensagem_externo" varchar(128),
	"resposta_provedor" text,
	"erro" text,
	"aceito_em" timestamp with time zone,
	"entregue_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_cliente_fatos" (
	"telefone_e164" varchar(16) PRIMARY KEY NOT NULL,
	"nome" varchar(256) DEFAULT '' NOT NULL,
	"cnpj" varchar(20),
	"cliente_id" integer,
	"total_pedidos" integer DEFAULT 0 NOT NULL,
	"pedidos_ultimos_90_dias" integer DEFAULT 0 NOT NULL,
	"dias_sem_comprar" integer,
	"status_orcamento" varchar(16),
	"dias_pos_orcamento" integer,
	"pedidos_apos_ultimo_orcamento" integer DEFAULT 0 NOT NULL,
	"ultima_compra_em" date,
	"ultimo_orcamento_em" date,
	"cliente_ativo_erp" boolean DEFAULT false NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_erp_sync_status" (
	"recurso" varchar(24) PRIMARY KEY NOT NULL,
	"status" varchar(16) DEFAULT 'nunca' NOT NULL,
	"completo" boolean DEFAULT false NOT NULL,
	"ultima_tentativa_em" timestamp with time zone,
	"ultimo_sucesso_em" timestamp with time zone,
	"erro" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_etapas" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"versao" integer NOT NULL,
	"numero" integer NOT NULL,
	"template_id" varchar(120) NOT NULL,
	"atraso_dias_uteis" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_importacao_contatos" (
	"id" serial PRIMARY KEY NOT NULL,
	"importacao_id" integer NOT NULL,
	"telefone_e164" varchar(16) NOT NULL,
	"nome" varchar(256) DEFAULT '' NOT NULL,
	"linha_origem" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_importacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"fonte_id" integer,
	"campanha_id" integer,
	"arquivo_id" integer,
	"nome_arquivo" varchar(256) NOT NULL,
	"importado_por" varchar(128),
	"importado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"total_linhas" integer DEFAULT 0 NOT NULL,
	"total_validos" integer DEFAULT 0 NOT NULL,
	"total_invalidos" integer DEFAULT 0 NOT NULL,
	"opt_in_confirmado" boolean DEFAULT false NOT NULL,
	"opt_in_confirmado_por" varchar(128),
	"opt_in_confirmado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_inscricoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"telefone_e164" varchar(16) NOT NULL,
	"nome" varchar(256) DEFAULT '' NOT NULL,
	"cnpj" varchar(20),
	"cliente_id" integer,
	"origem_tipo" varchar(24) NOT NULL,
	"origem_id" integer,
	"status" "campanha_cadencia_status" DEFAULT 'aguardando' NOT NULL,
	"prioridade_no_momento" integer DEFAULT 100 NOT NULL,
	"versao_etapas" integer NOT NULL,
	"snapshot_etapas" jsonb NOT NULL,
	"etapa_atual" integer DEFAULT 1 NOT NULL,
	"proximo_envio_em" timestamp with time zone,
	"ultimo_envio_aceito_em" timestamp with time zone,
	"ultima_resposta_em" timestamp with time zone,
	"motivo_fim" varchar(64),
	"lease_token" varchar(64),
	"lease_ate" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_leads_qualificados" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"disparo_id" integer,
	"telefone" varchar(20) NOT NULL,
	"nome" varchar(200),
	"cluster" varchar(40) NOT NULL,
	"resumo_intencao" varchar(255) NOT NULL,
	"nivel_interesse" integer NOT NULL,
	"palavras_chave" text[] DEFAULT '{}' NOT NULL,
	"icp_fit_score" integer DEFAULT 50 NOT NULL,
	"perfil_interlocutor" varchar(40) DEFAULT 'DESCONHECIDO' NOT NULL,
	"parametros_projeto" text[] DEFAULT '{}' NOT NULL,
	"motivo_objecao" varchar(40) DEFAULT 'NENHUMA' NOT NULL,
	"resumo_objecao" varchar(255),
	"mensagens_consolidadas" text[] DEFAULT '{}' NOT NULL,
	"total_mensagens_trocas" integer DEFAULT 1 NOT NULL,
	"tempo_reacao_segundos" integer,
	"dia_semana_primeira_resposta" integer,
	"hora_primeira_resposta" integer,
	"provedor_llm" varchar(32) DEFAULT 'gemini' NOT NULL,
	"modelo_llm" varchar(64) DEFAULT 'gemini-1.5-flash' NOT NULL,
	"analisado_em" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_mensagens_inbound" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer,
	"disparo_id" integer,
	"telefone" varchar(20) NOT NULL,
	"nome" varchar(200),
	"tipo_mensagem" varchar(32) DEFAULT 'text' NOT NULL,
	"texto" text,
	"payload_raw" text,
	"mensagem_id_externo" varchar(128),
	"eh_bot" boolean DEFAULT false NOT NULL,
	"motivo_bot" varchar(64),
	"tempo_resposta_segundos" integer,
	"recebido_em" timestamp DEFAULT now() NOT NULL,
	"buffer_ate" timestamp NOT NULL,
	"processado" boolean DEFAULT false NOT NULL,
	"processado_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_motor_estado" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"proximo_envio_em" timestamp with time zone,
	"lease_token" varchar(64),
	"lease_ate" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_status_webhook_eventos" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_mensagem_externo" varchar(128) NOT NULL,
	"status" varchar(32) NOT NULL,
	"ocorreu_em" timestamp with time zone,
	"payload" jsonb,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "regra_cadencia" "campanha_regra_cadencia" DEFAULT 'dias_corridos' NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "dia_fixo_mes" integer;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "motor_cadencia_ativo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "prioridade_cadencia" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "versao_etapas_atual" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "intervalo_minimo_segundos" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "intervalo_maximo_segundos" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "intervalo_minimo_entre_campanhas_dias" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "consentimento_confirmado_por" varchar(128);--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "consentimento_confirmado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "templates_aprovados_confirmados_por" varchar(128);--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "templates_aprovados_confirmados_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_fontes" ADD COLUMN "retargeting_config" jsonb;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_fontes" ADD COLUMN "regras_erp" jsonb;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_optout" ADD COLUMN "origem" varchar(16) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_optout" ADD COLUMN "mensagem_id_externo" varchar(128);--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_optout" ADD COLUMN "mensagem_origem" text;--> statement-breakpoint
ALTER TABLE "historico_os" ADD COLUMN "clienteId" integer;--> statement-breakpoint
ALTER TABLE "historico_os" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "mubisys_clientes_cache" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_cadencia_envios" ADD CONSTRAINT "campanhas_whatsapp_cadencia_envios_inscricao_id_campanhas_whatsapp_inscricoes_id_fk" FOREIGN KEY ("inscricao_id") REFERENCES "public"."campanhas_whatsapp_inscricoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_cadencia_envios" ADD CONSTRAINT "campanhas_whatsapp_cadencia_envios_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_etapas" ADD CONSTRAINT "campanhas_whatsapp_etapas_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_importacao_contatos" ADD CONSTRAINT "campanhas_whatsapp_importacao_contatos_importacao_id_campanhas_whatsapp_importacoes_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."campanhas_whatsapp_importacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_importacoes" ADD CONSTRAINT "campanhas_whatsapp_importacoes_fonte_id_campanhas_whatsapp_fontes_id_fk" FOREIGN KEY ("fonte_id") REFERENCES "public"."campanhas_whatsapp_fontes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_importacoes" ADD CONSTRAINT "campanhas_whatsapp_importacoes_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_importacoes" ADD CONSTRAINT "campanhas_whatsapp_importacoes_arquivo_id_campanhas_whatsapp_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."campanhas_whatsapp_arquivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_inscricoes" ADD CONSTRAINT "campanhas_whatsapp_inscricoes_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_leads_qualificados" ADD CONSTRAINT "campanhas_whatsapp_leads_qualificados_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_leads_qualificados" ADD CONSTRAINT "campanhas_whatsapp_leads_qualificados_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_mensagens_inbound" ADD CONSTRAINT "campanhas_whatsapp_mensagens_inbound_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_mensagens_inbound" ADD CONSTRAINT "campanhas_whatsapp_mensagens_inbound_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_cadencia_envios_inscricao_etapa_tentativa_unique" ON "campanhas_whatsapp_cadencia_envios" USING btree ("inscricao_id","etapa","tentativa");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_cadencia_envios_status_idx" ON "campanhas_whatsapp_cadencia_envios" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_cadencia_envios_mensagem_unique" ON "campanhas_whatsapp_cadencia_envios" USING btree ("id_mensagem_externo") WHERE "campanhas_whatsapp_cadencia_envios"."id_mensagem_externo" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_cliente_fatos_ativo_idx" ON "campanhas_whatsapp_cliente_fatos" USING btree ("cliente_ativo_erp");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_etapas_versao_numero_unique" ON "campanhas_whatsapp_etapas" USING btree ("campanha_id","versao","numero");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_etapas_campanha_versao_idx" ON "campanhas_whatsapp_etapas" USING btree ("campanha_id","versao");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_importacao_contatos_importacao_tel_unique" ON "campanhas_whatsapp_importacao_contatos" USING btree ("importacao_id","telefone_e164");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_importacao_contatos_tel_idx" ON "campanhas_whatsapp_importacao_contatos" USING btree ("telefone_e164");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_importacoes_fonte_idx" ON "campanhas_whatsapp_importacoes" USING btree ("fonte_id");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_importacoes_campanha_idx" ON "campanhas_whatsapp_importacoes" USING btree ("campanha_id");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_inscricoes_campanha_tel_idx" ON "campanhas_whatsapp_inscricoes" USING btree ("campanha_id","telefone_e164");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_inscricoes_due_idx" ON "campanhas_whatsapp_inscricoes" USING btree ("status","proximo_envio_em");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_inscricoes_telefone_ativo_unique" ON "campanhas_whatsapp_inscricoes" USING btree ("telefone_e164") WHERE "campanhas_whatsapp_inscricoes"."status" IN ('aguardando', 'enviando', 'pendente_conciliacao', 'pausado_por_resposta');--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_leads_campanha_tel_unique" ON "campanhas_whatsapp_leads_qualificados" USING btree ("campanha_id","telefone");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_leads_campanha_cluster_idx" ON "campanhas_whatsapp_leads_qualificados" USING btree ("campanha_id","cluster");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_leads_campanha_icp_idx" ON "campanhas_whatsapp_leads_qualificados" USING btree ("campanha_id","icp_fit_score");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_inbound_tel_buffer_idx" ON "campanhas_whatsapp_mensagens_inbound" USING btree ("telefone","buffer_ate","processado");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_inbound_campanha_recebido_idx" ON "campanhas_whatsapp_mensagens_inbound" USING btree ("campanha_id","recebido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_inbound_mensagem_id_unique" ON "campanhas_whatsapp_mensagens_inbound" USING btree ("mensagem_id_externo");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_status_webhook_eventos_mensagem_status_unique" ON "campanhas_whatsapp_status_webhook_eventos" USING btree ("id_mensagem_externo","status");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_status_webhook_eventos_pendente_idx" ON "campanhas_whatsapp_status_webhook_eventos" USING btree ("processado_em","recebido_em");