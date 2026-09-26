CREATE TYPE "public"."campanha_whatsapp_categoria" AS ENUM('novo_lead', 'orcamento_perdido', 'reativacao_inativo', 'pos_venda', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."campanha_whatsapp_status" AS ENUM('ativa', 'pausada', 'arquivada');--> statement-breakpoint
CREATE TYPE "public"."campanha_whatsapp_tipo" AS ENUM('recorrente', 'gatilho_venda');--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(160) NOT NULL,
	"categoria" "campanha_whatsapp_categoria" NOT NULL,
	"tipo" "campanha_whatsapp_tipo" DEFAULT 'recorrente' NOT NULL,
	"frequencia_dias" integer NOT NULL,
	"quarentena_dias" integer DEFAULT 0 NOT NULL,
	"status" "campanha_whatsapp_status" DEFAULT 'ativa' NOT NULL,
	"gatilho_a_partir_de" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_disparos" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"enviado_em" date NOT NULL,
	"proxima_data" date,
	"contatos_recebidos" integer DEFAULT 0 NOT NULL,
	"contatos_enviados" integer DEFAULT 0 NOT NULL,
	"contatos_ignorados" integer DEFAULT 0 NOT NULL,
	"contatos_invalidos" integer DEFAULT 0 NOT NULL,
	"arquivo_url" varchar(512),
	"arquivo_nome" varchar(256),
	"origem" varchar(8) DEFAULT 'app' NOT NULL,
	"observacoes" text,
	"registrado_por" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_gatilhos" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"disparo_id" integer NOT NULL,
	"os_numero" varchar(32) NOT NULL,
	"telefone" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_quarentena" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"ultima_campanha_id" integer,
	"ultimo_contato_em" date NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_quarentena_telefone_unique" UNIQUE("telefone")
);
--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_disparos" ADD CONSTRAINT "campanhas_whatsapp_disparos_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_gatilhos" ADD CONSTRAINT "campanhas_whatsapp_gatilhos_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_gatilhos" ADD CONSTRAINT "campanhas_whatsapp_gatilhos_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_quarentena" ADD CONSTRAINT "campanhas_whatsapp_quarentena_ultima_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("ultima_campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_disparos_campanha_enviado_idx" ON "campanhas_whatsapp_disparos" USING btree ("campanha_id","enviado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_gatilhos_campanha_os_unique" ON "campanhas_whatsapp_gatilhos" USING btree ("campanha_id","os_numero");--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_quarentena_ultimo_contato_idx" ON "campanhas_whatsapp_quarentena" USING btree ("ultimo_contato_em");