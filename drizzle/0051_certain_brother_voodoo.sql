CREATE TYPE "public"."campanha_whatsapp_agendamento_status" AS ENUM('planejado', 'disparado', 'nao_disparado');--> statement-breakpoint
CREATE TABLE "campanhas_whatsapp_agendamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"campanha_id" integer NOT NULL,
	"data_agendada" date NOT NULL,
	"status" "campanha_whatsapp_agendamento_status" DEFAULT 'planejado' NOT NULL,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_agendamentos" ADD CONSTRAINT "campanhas_whatsapp_agendamentos_campanha_id_campanhas_whatsapp_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campanhas_whatsapp_agendamentos_campanha_data_idx" ON "campanhas_whatsapp_agendamentos" USING btree ("campanha_id","data_agendada");