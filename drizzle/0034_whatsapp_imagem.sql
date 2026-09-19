CREATE TABLE "whatsapp_imagem" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave" varchar(64) NOT NULL,
	"nomeArquivo" varchar(256) NOT NULL,
	"base64" text NOT NULL,
	"tamanhoBytes" integer NOT NULL,
	"largura" integer NOT NULL,
	"altura" integer NOT NULL,
	"usuarioId" text,
	"usuarioNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_imagem_chave_unique" UNIQUE("chave")
);
