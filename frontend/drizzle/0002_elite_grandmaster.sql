CREATE TABLE IF NOT EXISTS "code_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"repository_id" uuid NOT NULL REFERENCES "repositories"("id") ON DELETE cascade,
	"room_id" uuid,
	"mode" varchar(20) DEFAULT 'solo' NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"total_questions" integer DEFAULT 5 NOT NULL,
	"completed_questions" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL REFERENCES "code_sessions"("id") ON DELETE cascade,
	"question_index" integer NOT NULL,
	"target_file_id" uuid NOT NULL,
	"target_file_path" varchar(1024) NOT NULL,
	"target_line_number" integer NOT NULL,
	"target_line_content" text NOT NULL,
	"answered_file_path" varchar(1024),
	"answered_line_number" integer,
	"is_correct_file" boolean,
	"line_difference" integer,
	"score" integer DEFAULT 0 NOT NULL,
	"time_spent_ms" integer,
	"answered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_answers_session_id_idx" ON "code_answers" USING btree ("session_id");