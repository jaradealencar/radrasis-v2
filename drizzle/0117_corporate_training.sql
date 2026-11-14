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
CREATE TABLE "training_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"allow_practice" boolean DEFAULT true NOT NULL,
	"allow_formal" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_attempt_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" integer NOT NULL,
	"question_key" varchar(80) NOT NULL,
	"step_key" varchar(80),
	"response" jsonb NOT NULL,
	"points_awarded" numeric(8, 2) DEFAULT '0' NOT NULL,
	"is_correct" boolean,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"assessment_id" integer NOT NULL,
	"assignment_student_id" integer,
	"mode" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'in_progress' NOT NULL,
	"assessment_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"score" numeric(7, 2),
	"points_earned" numeric(8, 2),
	"points_possible" numeric(8, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" integer NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "training_lesson_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" integer NOT NULL,
	"lesson_version" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "training_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"question_key" varchar(80) NOT NULL,
	"type" varchar(32) NOT NULL,
	"prompt" text NOT NULL,
	"config" jsonb NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"sector_id" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_reference" varchar(256),
	"version" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_assessment_materials" ADD CONSTRAINT "training_assessment_materials_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_assessment_materials" ADD CONSTRAINT "training_assessment_materials_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_assessments" ADD CONSTRAINT "training_assessments_subject_id_training_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."training_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempt_answers" ADD CONSTRAINT "training_attempt_answers_attempt_id_training_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."training_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempts" ADD CONSTRAINT "training_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempts" ADD CONSTRAINT "training_attempts_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_attempts" ADD CONSTRAINT "training_attempts_assignment_student_id_training_exam_assignment_students_id_fk" FOREIGN KEY ("assignment_student_id") REFERENCES "public"."training_exam_assignment_students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_subject_id_training_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."training_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exam_assignment_students" ADD CONSTRAINT "training_exam_assignment_students_assignment_id_training_exam_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."training_exam_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exam_assignment_students" ADD CONSTRAINT "training_exam_assignment_students_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exam_assignments" ADD CONSTRAINT "training_exam_assignments_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exam_assignments" ADD CONSTRAINT "training_exam_assignments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_progress" ADD CONSTRAINT "training_lesson_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_progress" ADD CONSTRAINT "training_lesson_progress_lesson_id_training_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_versions" ADD CONSTRAINT "training_lesson_versions_lesson_id_training_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_versions" ADD CONSTRAINT "training_lesson_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_subject_id_training_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."training_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_questions" ADD CONSTRAINT "training_questions_assessment_id_training_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."training_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_subjects" ADD CONSTRAINT "training_subjects_sector_id_training_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."training_sectors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_assessment_materials_assessment_created_idx" ON "training_assessment_materials" USING btree ("assessment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_assessment_materials_file_key_uq" ON "training_assessment_materials" USING btree ("file_key");--> statement-breakpoint
CREATE INDEX "training_assessments_subject_idx" ON "training_assessments" USING btree ("subject_id","position");--> statement-breakpoint
CREATE INDEX "training_answers_attempt_question_idx" ON "training_attempt_answers" USING btree ("attempt_id","question_key","created_at");--> statement-breakpoint
CREATE INDEX "training_attempts_user_idx" ON "training_attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "training_attempts_assessment_idx" ON "training_attempts" USING btree ("assessment_id","started_at");--> statement-breakpoint
CREATE INDEX "training_attempts_assignment_student_idx" ON "training_attempts" USING btree ("assignment_student_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_enrollments_user_subject_uq" ON "training_enrollments" USING btree ("user_id","subject_id");--> statement-breakpoint
CREATE INDEX "training_enrollments_subject_enrolled_at_idx" ON "training_enrollments" USING btree ("subject_id","enrolled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_exam_assignment_students_assignment_user_uq" ON "training_exam_assignment_students" USING btree ("assignment_id","user_id");--> statement-breakpoint
CREATE INDEX "training_exam_assignment_students_user_assignment_idx" ON "training_exam_assignment_students" USING btree ("user_id","assignment_id");--> statement-breakpoint
CREATE INDEX "training_exam_assignments_assessment_created_idx" ON "training_exam_assignments" USING btree ("assessment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_lesson_progress_user_lesson_uq" ON "training_lesson_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_lesson_versions_lesson_version_uq" ON "training_lesson_versions" USING btree ("lesson_id","version");--> statement-breakpoint
CREATE INDEX "training_lesson_versions_lesson_idx" ON "training_lesson_versions" USING btree ("lesson_id","created_at");--> statement-breakpoint
CREATE INDEX "training_lessons_subject_idx" ON "training_lessons" USING btree ("subject_id","position");--> statement-breakpoint
CREATE INDEX "training_questions_assessment_idx" ON "training_questions" USING btree ("assessment_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "training_questions_assessment_key_uq" ON "training_questions" USING btree ("assessment_id","question_key");--> statement-breakpoint
CREATE UNIQUE INDEX "training_sectors_slug_uq" ON "training_sectors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "training_subjects_slug_uq" ON "training_subjects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "training_subjects_sector_idx" ON "training_subjects" USING btree ("sector_id","position");