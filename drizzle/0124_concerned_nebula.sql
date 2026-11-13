CREATE TABLE "training_exam_assignment_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_exam_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_exam_assignments_max_attempts_check" CHECK ("training_exam_assignments"."max_attempts" BETWEEN 1 AND 20)
);
--> statement-breakpoint
ALTER TABLE "training_attempts" ADD COLUMN "assignment_student_id" integer;--> statement-breakpoint
ALTER TABLE "training_exam_assignment_students" ADD CONSTRAINT "training_exam_assignment_students_assignment_id_training_exam_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."training_exam_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exam_assignment_students" ADD CONSTRAINT "training_exam_assignment_students_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exam_assignments" ADD CONSTRAINT "training_exam_assignments_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exam_assignments" ADD CONSTRAINT "training_exam_assignments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_exam_assignment_students_assignment_user_uq" ON "training_exam_assignment_students" USING btree ("assignment_id","user_id");--> statement-breakpoint
CREATE INDEX "training_exam_assignment_students_user_assignment_idx" ON "training_exam_assignment_students" USING btree ("user_id","assignment_id");--> statement-breakpoint
CREATE INDEX "training_exam_assignments_assessment_created_idx" ON "training_exam_assignments" USING btree ("assessment_id","created_at");--> statement-breakpoint
ALTER TABLE "training_attempts" ADD CONSTRAINT "training_attempts_assignment_student_id_training_exam_assignment_students_id_fk" FOREIGN KEY ("assignment_student_id") REFERENCES "public"."training_exam_assignment_students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_attempts_assignment_student_idx" ON "training_attempts" USING btree ("assignment_student_id","started_at");