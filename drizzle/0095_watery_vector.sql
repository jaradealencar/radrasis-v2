ALTER TABLE "materia_prima_cadastros" ADD COLUMN "produtividade_categorias" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "produtividade_aros" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "produtividade_formatos" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "produtividade_fundos" text[] DEFAULT '{}' NOT NULL;