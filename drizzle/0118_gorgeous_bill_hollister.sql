CREATE TYPE "public"."campanha_regra_cadencia" AS ENUM('dias_corridos', 'fim_de_mes', 'dia_fixo_mes');--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "regra_cadencia" "campanha_regra_cadencia" DEFAULT 'dias_corridos' NOT NULL;--> statement-breakpoint
ALTER TABLE "campanhas_whatsapp" ADD COLUMN "dia_fixo_mes" integer;