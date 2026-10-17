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
ALTER TABLE "campanhas_whatsapp_leads_qualificados" ADD CONSTRAINT "campanhas_whatsapp_leads_qualificados_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_leads_qualificados" ADD CONSTRAINT "campanhas_whatsapp_leads_qualificados_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_mensagens_inbound" ADD CONSTRAINT "campanhas_whatsapp_mensagens_inbound_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_mensagens_inbound" ADD CONSTRAINT "campanhas_whatsapp_mensagens_inbound_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_leads_campanha_tel_unique" ON "campanhas_whatsapp_leads_qualificados" USING btree ("campanha_id","telefone");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_leads_campanha_cluster_idx" ON "campanhas_whatsapp_leads_qualificados" USING btree ("campanha_id","cluster");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_leads_campanha_icp_idx" ON "campanhas_whatsapp_leads_qualificados" USING btree ("campanha_id","icp_fit_score");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_inbound_tel_buffer_idx" ON "campanhas_whatsapp_mensagens_inbound" USING btree ("telefone","buffer_ate","processado");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_inbound_campanha_recebido_idx" ON "campanhas_whatsapp_mensagens_inbound" USING btree ("campanha_id","recebido_em");