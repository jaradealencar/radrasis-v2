CREATE TABLE "acabamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"mubisys_acabamento_id" integer NOT NULL,
	"nome" varchar(256) NOT NULL,
	"tipo" varchar(120) DEFAULT '' NOT NULL,
	"unidade" varchar(40) DEFAULT '' NOT NULL,
	"custo_materia_prima" numeric(14, 4),
	"custo_mao_de_obra" numeric(14, 4),
	"custo_adicional" numeric(14, 4),
	"produtividade_hora" numeric(14, 6),
	"tipo_calculo" varchar(24),
	"ativo" boolean DEFAULT true NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "acabamentos_mubisys_acabamento_id_unique" UNIQUE("mubisys_acabamento_id")
);
--> statement-breakpoint
CREATE TABLE "composicao_item_acabamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"composicao_item_id" integer NOT NULL,
	"acabamento_id" integer NOT NULL,
	"quantidade" numeric(14, 6) DEFAULT '1' NOT NULL,
	"unidade" varchar(80) DEFAULT '' NOT NULL,
	"formula_consumo" varchar(24),
	"ordem" integer DEFAULT 0 NOT NULL,
	"horas_equipamento" numeric(12, 4)
);
--> statement-breakpoint
CREATE TABLE "composicao_item_equipamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"composicao_item_id" integer NOT NULL,
	"equipamento_id" integer NOT NULL,
	"horas" numeric(12, 4) DEFAULT '0' NOT NULL,
	"quantidade" numeric(14, 6) DEFAULT '1' NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"mubisys_equipamento_id" integer NOT NULL,
	"nome" varchar(256) NOT NULL,
	"tipo" varchar(120) DEFAULT '' NOT NULL,
	"custo_hora" numeric(14, 4),
	"ativo" boolean DEFAULT true NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "equipamentos_mubisys_equipamento_id_unique" UNIQUE("mubisys_equipamento_id")
);
--> statement-breakpoint
ALTER TABLE "composicao_item_acabamentos" ADD CONSTRAINT "composicao_item_acabamentos_composicao_item_id_composicoes_variacoes_id_fk" FOREIGN KEY ("composicao_item_id") REFERENCES "public"."composicoes_variacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composicao_item_acabamentos" ADD CONSTRAINT "composicao_item_acabamentos_acabamento_id_acabamentos_id_fk" FOREIGN KEY ("acabamento_id") REFERENCES "public"."acabamentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composicao_item_equipamentos" ADD CONSTRAINT "composicao_item_equipamentos_composicao_item_id_composicoes_variacoes_id_fk" FOREIGN KEY ("composicao_item_id") REFERENCES "public"."composicoes_variacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composicao_item_equipamentos" ADD CONSTRAINT "composicao_item_equipamentos_equipamento_id_equipamentos_id_fk" FOREIGN KEY ("equipamento_id") REFERENCES "public"."equipamentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acabamentos_nome_idx" ON "acabamentos" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "composicao_item_acabamentos_item_idx" ON "composicao_item_acabamentos" USING btree ("composicao_item_id","ordem");--> statement-breakpoint
CREATE UNIQUE INDEX "composicao_item_acabamentos_unico_idx" ON "composicao_item_acabamentos" USING btree ("composicao_item_id","acabamento_id","ordem");--> statement-breakpoint
CREATE INDEX "composicao_item_equipamentos_item_idx" ON "composicao_item_equipamentos" USING btree ("composicao_item_id","ordem");--> statement-breakpoint
CREATE UNIQUE INDEX "composicao_item_equipamentos_unico_idx" ON "composicao_item_equipamentos" USING btree ("composicao_item_id","equipamento_id","ordem");--> statement-breakpoint
CREATE INDEX "equipamentos_nome_idx" ON "equipamentos" USING btree ("nome");