ALTER TABLE "estudio_precos_impressao" ADD COLUMN "largura_bobina_mm" integer;--> statement-breakpoint
ALTER TABLE "estudio_precos_impressao" ADD COLUMN "largura_util_bobina_mm" integer;--> statement-breakpoint
ALTER TABLE "estudio_precos_impressao" ADD COLUMN "sangria_perimetral_mm" numeric(6, 2) DEFAULT '3.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "estudio_precos_impressao" ADD COLUMN "retalho_reutilizavel" boolean DEFAULT false NOT NULL;
