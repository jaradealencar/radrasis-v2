ALTER TABLE "estudio_chapas" ADD COLUMN "principal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "titulo_proposta" varchar(256) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "imagem_referencia_url" text;--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "imagem_redesenhada_url" text;