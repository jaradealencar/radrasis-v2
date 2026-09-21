CREATE TABLE "guia_fornecedores_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"mensagemWhatsapp" text NOT NULL,
	"usuarioNome" varchar(128),
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
