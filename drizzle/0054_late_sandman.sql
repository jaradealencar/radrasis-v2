CREATE TYPE "public"."unidade_consumo_materia_prima" AS ENUM('m2', 'ml', 'perimetro', 'unidade');--> statement-breakpoint
CREATE TABLE "produto_composicao_materiais" (
	"id" serial PRIMARY KEY NOT NULL,
	"produtoId" integer NOT NULL,
	"mubisysMateriaPrimaId" integer NOT NULL,
	"materialNome" varchar(256) NOT NULL,
	"unidadeConsumo" "unidade_consumo_materia_prima" NOT NULL,
	"quantidade" numeric(12, 4) DEFAULT '0' NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produto_kit_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"produtoId" integer NOT NULL,
	"produtoAssociadoId" integer NOT NULL,
	"quantidade" numeric(12, 4) DEFAULT '1' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"mubisysProdutoId" integer NOT NULL,
	"mubisysModeloId" integer NOT NULL,
	"nome" varchar(256) NOT NULL,
	"categoria" varchar(128),
	"ativo" boolean DEFAULT true NOT NULL,
	"percentualCustoFixo" numeric(6, 2) DEFAULT '0' NOT NULL,
	"idPrecificacao" integer,
	"observacao" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "produto_composicao_materiais" ADD CONSTRAINT "produto_composicao_materiais_produtoId_produtos_id_fk" FOREIGN KEY ("produtoId") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_kit_itens" ADD CONSTRAINT "produto_kit_itens_produtoId_produtos_id_fk" FOREIGN KEY ("produtoId") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_kit_itens" ADD CONSTRAINT "produto_kit_itens_produtoAssociadoId_produtos_id_fk" FOREIGN KEY ("produtoAssociadoId") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "produto_composicao_materiais_produtoId_idx" ON "produto_composicao_materiais" USING btree ("produtoId");--> statement-breakpoint
CREATE INDEX "produto_kit_itens_produtoId_idx" ON "produto_kit_itens" USING btree ("produtoId");