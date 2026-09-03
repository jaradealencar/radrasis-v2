CREATE TABLE "custo_marketing_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"categoria" varchar(32) DEFAULT 'aquisicao' NOT NULL,
	"fornecedor" varchar(256) NOT NULL,
	"tipo" varchar(128),
	"despesa" varchar(256),
	"descricao" text,
	"valor" numeric(14, 2) NOT NULL,
	"dataVencimento" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
