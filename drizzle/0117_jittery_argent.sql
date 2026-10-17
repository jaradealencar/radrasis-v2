ALTER TYPE "public"."campanha_fonte_tipo" ADD VALUE 'retargeting';--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp_fontes" ADD COLUMN "retargeting_config" jsonb;