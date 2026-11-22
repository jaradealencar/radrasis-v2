ALTER TYPE "public"."campanha_fonte_tipo" ADD VALUE 'crm_propostas';--> statement-breakpoint
CREATE UNIQUE INDEX "campanhas_whatsapp_inscricoes_proposta_crm_unique" ON "campanhas_whatsapp_inscricoes" USING btree ("origem_tipo","origem_id") WHERE "campanhas_whatsapp_inscricoes"."origem_tipo" = 'crm_proposta' AND "campanhas_whatsapp_inscricoes"."origem_id" IS NOT NULL;
