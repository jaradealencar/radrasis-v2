CREATE TABLE IF NOT EXISTS "campanhas_whatsapp_envios_programados" (
	"id" serial PRIMARY KEY NOT NULL,
	"fila_id" integer NOT NULL,
	"campanha_id" integer NOT NULL,
	"etapa" integer NOT NULL,
	"data_agendada" date NOT NULL,
	"template_id" varchar(120) NOT NULL,
	"versao_etapas" integer DEFAULT 1 NOT NULL,
	"disparo_id" integer,
	"status" varchar(24) DEFAULT 'agendado' NOT NULL,
	"total_contatos" integer DEFAULT 0 NOT NULL,
	"aceitos" integer DEFAULT 0 NOT NULL,
	"entregues" integer DEFAULT 0 NOT NULL,
	"falhas" integer DEFAULT 0 NOT NULL,
	"proximo_processamento_em" timestamp with time zone,
	"ultimo_lote_concluido_em" timestamp with time zone,
	"motivo_pausa" text,
	"iniciado_por" varchar(128),
	"iniciado_em" timestamp with time zone,
	"concluido_em" timestamp with time zone,
	"lease_token" varchar(64),
	"lease_ate" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campanhas_whatsapp_fila_inscricoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"nome" varchar(200) DEFAULT '' NOT NULL,
	"etapa_atual" integer DEFAULT 1 NOT NULL,
	"status" varchar(24) DEFAULT 'ativa' NOT NULL,
	"ultimo_envio_aceito_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campanhas_whatsapp_fila_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"envio_programado_id" integer NOT NULL,
	"inscricao_id" integer NOT NULL,
	"campanha_id" integer NOT NULL,
	"etapa" integer NOT NULL,
	"lote" integer NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"nome" varchar(200) DEFAULT '' NOT NULL,
	"template_id" varchar(120) NOT NULL,
	"status" varchar(24) DEFAULT 'pendente' NOT NULL,
	"id_mensagem_wts" varchar(128),
	"status_entrega" varchar(32),
	"erro" text,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"enviado_em" timestamp with time zone,
	"aceito_em" timestamp with time zone,
	"entregue_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campanhas_whatsapp_filas" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"quantidade_envios" integer NOT NULL,
	"data_inicial" date NOT NULL,
	"intervalo_dias" integer NOT NULL,
	"pausa_lotes_minutos" integer DEFAULT 5 NOT NULL,
	"janela_envio_ativa" boolean DEFAULT false NOT NULL,
	"janela_hora_inicio" varchar(5) DEFAULT '09:00' NOT NULL,
	"janela_hora_fim" varchar(5) DEFAULT '18:00' NOT NULL,
	"janela_dias_semana" integer[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"configurado_por" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_filas_campanha_id_unique" UNIQUE("campanha_id"),
	CONSTRAINT "campanhas_whatsapp_filas_janela_valida" CHECK (NOT "campanhas_whatsapp_filas"."janela_envio_ativa" OR ("campanhas_whatsapp_filas"."janela_hora_inicio" < "campanhas_whatsapp_filas"."janela_hora_fim" AND cardinality("campanhas_whatsapp_filas"."janela_dias_semana") > 0))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campanhas_whatsapp_motor_estado" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"proximo_envio_em" timestamp with time zone,
	"lease_token" varchar(64),
	"lease_ate" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_envios_programados_fila_id_campanhas_whatsapp_filas_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_envios_programados'::regclass) THEN ALTER TABLE "campanhas_whatsapp_envios_programados" ADD CONSTRAINT "campanhas_whatsapp_envios_programados_fila_id_campanhas_whatsapp_filas_id_fk" FOREIGN KEY ("fila_id") REFERENCES "public"."campanhas_whatsapp_filas"("id") ON DELETE cascade ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_envios_programados_campanha_id_campanhas_whatsapp_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_envios_programados'::regclass) THEN ALTER TABLE "campanhas_whatsapp_envios_programados" ADD CONSTRAINT "campanhas_whatsapp_envios_programados_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_envios_programados_disparo_id_campanhas_whatsapp_disparos_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_envios_programados'::regclass) THEN ALTER TABLE "campanhas_whatsapp_envios_programados" ADD CONSTRAINT "campanhas_whatsapp_envios_programados_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE set null ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_fila_inscricoes_campanha_id_campanhas_whatsapp_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_fila_inscricoes'::regclass) THEN ALTER TABLE "campanhas_whatsapp_fila_inscricoes" ADD CONSTRAINT "campanhas_whatsapp_fila_inscricoes_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_fila_itens_envio_programado_id_campanhas_whatsapp_envios_programados_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_fila_itens'::regclass) THEN ALTER TABLE "campanhas_whatsapp_fila_itens" ADD CONSTRAINT "campanhas_whatsapp_fila_itens_envio_programado_id_campanhas_whatsapp_envios_programados_id_fk" FOREIGN KEY ("envio_programado_id") REFERENCES "public"."campanhas_whatsapp_envios_programados"("id") ON DELETE cascade ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_fila_itens_inscricao_id_campanhas_whatsapp_fila_inscricoes_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_fila_itens'::regclass) THEN ALTER TABLE "campanhas_whatsapp_fila_itens" ADD CONSTRAINT "campanhas_whatsapp_fila_itens_inscricao_id_campanhas_whatsapp_fila_inscricoes_id_fk" FOREIGN KEY ("inscricao_id") REFERENCES "public"."campanhas_whatsapp_fila_inscricoes"("id") ON DELETE cascade ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_fila_itens_campanha_id_campanhas_whatsapp_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_fila_itens'::regclass) THEN ALTER TABLE "campanhas_whatsapp_fila_itens" ADD CONSTRAINT "campanhas_whatsapp_fila_itens_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = left('campanhas_whatsapp_filas_campanha_id_campanhas_whatsapp_id_fk', 63) AND conrelid = 'public.campanhas_whatsapp_filas'::regclass) THEN ALTER TABLE "campanhas_whatsapp_filas" ADD CONSTRAINT "campanhas_whatsapp_filas_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action; END IF; END $migration$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campanhas_whatsapp_envios_programados_etapa_unique" ON "campanhas_whatsapp_envios_programados" USING btree ("fila_id","etapa");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campanhas_whatsapp_envios_programados_campanha_data_idx" ON "campanhas_whatsapp_envios_programados" USING btree ("campanha_id","data_agendada");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campanhas_whatsapp_envios_programados_worker_idx" ON "campanhas_whatsapp_envios_programados" USING btree ("status","proximo_processamento_em");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campanhas_whatsapp_fila_inscricoes_telefone_unique" ON "campanhas_whatsapp_fila_inscricoes" USING btree ("campanha_id","telefone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campanhas_whatsapp_fila_inscricoes_etapa_idx" ON "campanhas_whatsapp_fila_inscricoes" USING btree ("campanha_id","etapa_atual","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campanhas_whatsapp_fila_itens_envio_inscricao_unique" ON "campanhas_whatsapp_fila_itens" USING btree ("envio_programado_id","inscricao_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campanhas_whatsapp_fila_itens_envio_lote_idx" ON "campanhas_whatsapp_fila_itens" USING btree ("envio_programado_id","lote","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campanhas_whatsapp_fila_itens_mensagem_unique" ON "campanhas_whatsapp_fila_itens" USING btree ("id_mensagem_wts") WHERE "campanhas_whatsapp_fila_itens"."id_mensagem_wts" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campanhas_whatsapp_filas_ativo_idx" ON "campanhas_whatsapp_filas" USING btree ("ativo");--> statement-breakpoint
INSERT INTO "campanhas_whatsapp_motor_estado" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
