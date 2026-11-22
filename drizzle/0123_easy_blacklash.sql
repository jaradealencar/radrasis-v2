CREATE TABLE "training_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" integer NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_subject_id_training_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."training_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_enrollments_user_subject_uq" ON "training_enrollments" USING btree ("user_id","subject_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_subject_enrolled_at_idx" ON "training_enrollments" USING btree ("subject_id","enrolled_at");