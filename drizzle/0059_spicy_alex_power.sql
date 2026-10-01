CREATE TABLE "estudio_configuracoes" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"configuracaoJson" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
