CREATE TABLE "mubisys_clientes_cache" (
	"id" integer PRIMARY KEY NOT NULL,
	"nome_fantasia" varchar(256),
	"razao_social" varchar(256),
	"telefone" varchar(32),
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
