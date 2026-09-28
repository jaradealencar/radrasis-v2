CREATE TYPE "public"."proposta_status" AS ENUM('aberta', 'aceita', 'recusada', 'expirada');--> statement-breakpoint
CREATE TABLE "configuracoes_comerciais" (
	"id" serial PRIMARY KEY NOT NULL,
	"condicoesComerciaisUrl" text,
	"condicoesComerciaisNome" text,
	"jurosParcelamentoJson" text DEFAULT '[]' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposta_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"propostaId" integer NOT NULL,
	"produtoId" integer NOT NULL,
	"produtoNome" varchar(256) NOT NULL,
	"quantidade" numeric(12, 4) DEFAULT '1' NOT NULL,
	"precoUnitario" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propostas" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"clienteNome" varchar(256) NOT NULL,
	"clienteContato" varchar(256),
	"vendedorNome" varchar(256) NOT NULL,
	"formasPagamentoJson" text DEFAULT '[]' NOT NULL,
	"condicaoPagamentoObs" text,
	"observacoes" text,
	"status" "proposta_status" DEFAULT 'aberta' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "propostas_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "prazoFabricacaoDiasUteis" integer;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "instagramUrl" text;--> statement-breakpoint
ALTER TABLE "proposta_itens" ADD CONSTRAINT "proposta_itens_propostaId_propostas_id_fk" FOREIGN KEY ("propostaId") REFERENCES "public"."propostas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposta_itens" ADD CONSTRAINT "proposta_itens_produtoId_produtos_id_fk" FOREIGN KEY ("produtoId") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposta_itens_propostaId_idx" ON "proposta_itens" USING btree ("propostaId");