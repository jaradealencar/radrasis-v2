CREATE TABLE "training_lesson_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_lesson_progress" ADD COLUMN "lesson_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "training_lesson_versions" ADD CONSTRAINT "training_lesson_versions_lesson_id_training_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_versions" ADD CONSTRAINT "training_lesson_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_lesson_versions_lesson_version_uq" ON "training_lesson_versions" USING btree ("lesson_id","version");--> statement-breakpoint
CREATE INDEX "training_lesson_versions_lesson_idx" ON "training_lesson_versions" USING btree ("lesson_id","created_at");
--> statement-breakpoint
INSERT INTO "training_lesson_versions" ("lesson_id", "version", "title", "summary", "content", "created_at")
SELECT "id", "version", "title", "summary", "content", "updated_at"
FROM "training_lessons";
