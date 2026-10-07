CREATE TABLE "cpq_render3d_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(80) NOT NULL,
	"spec_hash" varchar(64) NOT NULL,
	"vector_hash" varchar(64) NOT NULL,
	"approved_by_id" varchar(80) NOT NULL,
	"approved_by_name" varchar(160) NOT NULL,
	"approved_by_role" varchar(32) NOT NULL,
	"preview_day_url" text,
	"preview_night_url" text,
	"preview_exploded_url" text,
	"profile_ids" integer[] DEFAULT '{}' NOT NULL,
	"materiais_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpq_render_material_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"kind" varchar(16) NOT NULL,
	"url" text NOT NULL,
	"storage_key" varchar(256),
	"mime_type" varchar(32) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"tile_width_mm" numeric(10, 3),
	"tile_height_mm" numeric(10, 3),
	"color_space" varchar(8) DEFAULT 'none' NOT NULL,
	"source_note" text,
	"calibrated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpq_render_material_links" (
	"mubisys_materia_prima_id" integer PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"overrides_json" jsonb,
	"atualizado_por" varchar(160),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpq_render_material_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"nome" varchar(160) NOT NULL,
	"familia" varchar(32) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"acabamento" varchar(160),
	"calibrado" boolean DEFAULT false NOT NULL,
	"pbr_json" jsonb NOT NULL,
	"notas" text,
	"autor_nome" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cpq_render_material_assets" ADD CONSTRAINT "cpq_render_material_assets_profile_id_cpq_render_material_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."cpq_render_material_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpq_render_material_links" ADD CONSTRAINT "cpq_render_material_links_profile_id_cpq_render_material_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."cpq_render_material_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cpq_render3d_approvals_source_idx" ON "cpq_render3d_approvals" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "cpq_render3d_approvals_spec_idx" ON "cpq_render3d_approvals" USING btree ("spec_hash");--> statement-breakpoint
CREATE INDEX "cpq_render_assets_profile_idx" ON "cpq_render_material_assets" USING btree ("profile_id","kind");--> statement-breakpoint
CREATE INDEX "cpq_render_links_profile_idx" ON "cpq_render_material_links" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cpq_render_profiles_slug_versao_uidx" ON "cpq_render_material_profiles" USING btree ("slug","versao");--> statement-breakpoint
CREATE INDEX "cpq_render_profiles_ativo_idx" ON "cpq_render_material_profiles" USING btree ("ativo","familia");