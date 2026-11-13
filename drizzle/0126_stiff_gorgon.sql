CREATE TABLE "training_assessment_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"file_key" varchar(255) NOT NULL,
	"mime_type" varchar(150) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_assessment_materials_size_check" CHECK ("training_assessment_materials"."size_bytes" BETWEEN 1 AND 33554432)
);
--> statement-breakpoint
ALTER TABLE "training_assessment_materials" ADD CONSTRAINT "training_assessment_materials_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_assessment_materials" ADD CONSTRAINT "training_assessment_materials_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_assessment_materials_assessment_created_idx" ON "training_assessment_materials" USING btree ("assessment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_assessment_materials_file_key_uq" ON "training_assessment_materials" USING btree ("file_key");