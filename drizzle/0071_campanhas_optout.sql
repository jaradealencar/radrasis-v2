CREATE TABLE "campanhas_whatsapp_optout" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"nome" varchar(200),
	"motivo" varchar(300),
	"registrado_por" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_whatsapp_optout_telefone_unique" UNIQUE("telefone")
);
