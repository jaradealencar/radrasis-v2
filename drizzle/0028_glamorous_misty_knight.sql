CREATE TABLE "inteligencia_clientes_acessos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" varchar(128) NOT NULL,
	"acessado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inteligencia_clientes_contatos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_key" varchar(256) NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"user_id" text NOT NULL,
	"vendedor" varchar(128) NOT NULL,
	"observacao" text,
	"contatado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inteligencia_clientes_acessos_user_idx" ON "inteligencia_clientes_acessos" USING btree ("user_id","acessado_em");--> statement-breakpoint
CREATE INDEX "inteligencia_clientes_contatos_empresa_idx" ON "inteligencia_clientes_contatos" USING btree ("empresa_key","contatado_em");