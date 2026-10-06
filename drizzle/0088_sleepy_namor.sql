ALTER TABLE "materia_prima_cadastros" ADD COLUMN "processo_corte" varchar(12);--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "rotacao_permitida" varchar(12) DEFAULT 'livre' NOT NULL;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "espacamento_mm" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "margem_borda_mm" numeric(6, 2);