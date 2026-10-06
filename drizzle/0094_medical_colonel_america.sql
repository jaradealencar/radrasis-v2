ALTER TABLE "materia_prima_cadastros" ADD COLUMN "aparencia_modo" varchar(16) DEFAULT 'nao_informada' NOT NULL;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "aparencia_cor_hex" varchar(7);--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "aparencia_cor_descricao" text;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "textura_imagem_url" text;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "textura_imagem_key" varchar(255);--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "textura_descricao" text;--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "render_transparencia_tipo" varchar(16);--> statement-breakpoint
ALTER TABLE "materia_prima_cadastros" ADD COLUMN "render_transmissao_luz_pct" numeric(5, 2);