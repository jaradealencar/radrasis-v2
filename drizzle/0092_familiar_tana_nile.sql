ALTER TABLE "materia_prima_cadastros" ADD COLUMN "produtividade_tamanhos" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Copia o tamanho único antigo para a lista nova (a coluna antiga fica intacta até a migration seguinte).
UPDATE "materia_prima_cadastros" SET "produtividade_tamanhos" = ARRAY["produtividade_tamanho"] WHERE "produtividade_tamanho" IS NOT NULL;
