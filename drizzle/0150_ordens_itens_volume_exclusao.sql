ALTER TABLE "compras_ordens" ADD COLUMN "volume_previsto_m3" numeric(18, 3);--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "excluida_em" timestamp;--> statement-breakpoint
ALTER TABLE "compras_ordens" ADD COLUMN "excluida_por" text;