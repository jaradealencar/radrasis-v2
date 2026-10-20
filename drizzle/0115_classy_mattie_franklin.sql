CREATE TABLE "campanhas_whatsapp_disparo_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"disparo_id" integer NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"nome" varchar(200),
	"wts_mensagem_id" varchar(64),
	"status_url" varchar(256),
	"status" varchar(32),
	"status_detalhe" text,
	"status_consultado_em" timestamp,
	"origem" varchar(8) DEFAULT 'auto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_disparo_itens" ADD CONSTRAINT "campanhas_whatsapp_disparo_itens_disparo_id_campanhas_whatsapp_disparos_id_fk" FOREIGN KEY ("disparo_id") REFERENCES "public"."campanhas_whatsapp_disparos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_disparo_itens_disparo_idx" ON "campanhas_whatsapp_disparo_itens" USING btree ("disparo_id");