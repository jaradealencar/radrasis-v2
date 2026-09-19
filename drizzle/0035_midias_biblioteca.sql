CREATE TABLE "midias_biblioteca" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(160) NOT NULL,
	"categoria" varchar(64),
	"nomeArquivo" varchar(256) NOT NULL,
	"base64" text NOT NULL,
	"miniatura" text NOT NULL,
	"tamanhoBytes" integer NOT NULL,
	"largura" integer NOT NULL,
	"altura" integer NOT NULL,
	"usos" integer DEFAULT 0 NOT NULL,
	"usuarioId" text,
	"usuarioNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "midias_biblioteca_categoria_idx" ON "midias_biblioteca" USING btree ("categoria");