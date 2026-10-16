CREATE TABLE "perfil_estoque_bobinas" (
	"id" serial PRIMARY KEY NOT NULL,
	"perfil_item_id" integer NOT NULL,
	"identificacao" varchar(120) NOT NULL,
	"metodo" varchar(24) NOT NULL,
	"diametro_externo_mm" numeric(12, 3),
	"diametro_interno_mm" numeric(12, 3),
	"espessura_mm" numeric(10, 4),
	"peso_kg" numeric(14, 4),
	"comprimento_metros" numeric(16, 4) NOT NULL,
	"observacao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"contado_por" varchar(160),
	"contado_em" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perfil_estoque_bobinas" ADD CONSTRAINT "perfil_estoque_bobinas_perfil_item_id_perfil_estoque_itens_id_fk" FOREIGN KEY ("perfil_item_id") REFERENCES "public"."perfil_estoque_itens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perfil_estoque_bobinas_perfil_ativo_idx" ON "perfil_estoque_bobinas" USING btree ("perfil_item_id","ativo");