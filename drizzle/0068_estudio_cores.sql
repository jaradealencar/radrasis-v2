CREATE TABLE "estudio_imprimax_adesivos" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(80) NOT NULL,
	"linha" varchar(120) NOT NULL,
	"nome_cor" varchar(160) NOT NULL,
	"tipo_vinil" varchar(24) NOT NULL,
	"acabamento" varchar(40),
	"cor_hex" varchar(7),
	"pantone_code" varchar(32),
	"cmyk_c" numeric(5, 2),
	"cmyk_m" numeric(5, 2),
	"cmyk_y" numeric(5, 2),
	"cmyk_k" numeric(5, 2),
	"transmissao_luz_pct" numeric(5, 2),
	"preco_m2" numeric(12, 4),
	"catalogo_versao" varchar(60),
	"origem_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estudio_mapeamento_cores_cotacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(80) NOT NULL,
	"region_key" varchar(80) NOT NULL,
	"cor_hex" varchar(7),
	"cor_rgb_json" jsonb,
	"pantone_code" varchar(32),
	"cmyk_c" numeric(5, 2),
	"cmyk_m" numeric(5, 2),
	"cmyk_y" numeric(5, 2),
	"cmyk_k" numeric(5, 2),
	"tipo_cor" varchar(24) NOT NULL,
	"area_m2" numeric(12, 6),
	"modo_iluminacao" varchar(24) DEFAULT 'sem_iluminacao' NOT NULL,
	"tipo_sugestao" varchar(24) NOT NULL,
	"chapa_id" integer,
	"imprimax_adesivo_id" integer,
	"delta_e00" numeric(8, 3),
	"custo_estimado" numeric(12, 4),
	"detalhes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aprovado" boolean DEFAULT false NOT NULL,
	"aprovado_por" varchar(80),
	"aprovado_em" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estudio_precos_impressao" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"vinil_branco_m2" numeric(12, 4),
	"vinil_transparente_m2" numeric(12, 4),
	"impressao_m2" numeric(12, 4),
	"laminacao_m2" numeric(12, 4),
	"laminacao_padrao" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estudio_chapas" ADD COLUMN "pantone_code" varchar(32);--> statement-breakpoint
ALTER TABLE "estudio_chapas" ADD COLUMN "cmyk_c" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "estudio_chapas" ADD COLUMN "cmyk_m" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "estudio_chapas" ADD COLUMN "cmyk_y" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "estudio_chapas" ADD COLUMN "cmyk_k" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "estudio_chapas" ADD COLUMN "transmissao_luz_pct" numeric(5, 2);--> statement-breakpoint
CREATE UNIQUE INDEX "estudio_imprimax_codigo_uidx" ON "estudio_imprimax_adesivos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "estudio_imprimax_ativo_idx" ON "estudio_imprimax_adesivos" USING btree ("ativo","linha");--> statement-breakpoint
CREATE UNIQUE INDEX "estudio_cores_cotacao_source_region_uidx" ON "estudio_mapeamento_cores_cotacao" USING btree ("source_id","region_key");--> statement-breakpoint
CREATE INDEX "estudio_cores_cotacao_source_idx" ON "estudio_mapeamento_cores_cotacao" USING btree ("source_id");