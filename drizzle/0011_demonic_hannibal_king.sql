CREATE TABLE "metricas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(256) NOT NULL,
	"valor" numeric(14, 4) NOT NULL,
	"unidade" varchar(16) DEFAULT '%',
	"dataApuracao" date NOT NULL,
	"observacao" text,
	"criadoPorNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
