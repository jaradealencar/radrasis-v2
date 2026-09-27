CREATE TABLE "campanhas_whatsapp_arquivos" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"nome" varchar(256) NOT NULL,
	"url" varchar(1024) NOT NULL,
	"tamanho_bytes" integer DEFAULT 0 NOT NULL,
	"enviado_por" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"titulo" varchar(128),
	"conteudo" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"copia_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_arquivos" ADD CONSTRAINT "campanhas_whatsapp_arquivos_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_scripts" ADD CONSTRAINT "campanhas_whatsapp_scripts_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;