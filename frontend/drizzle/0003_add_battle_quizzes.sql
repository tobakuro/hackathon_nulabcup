CREATE TABLE "battle_quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"generated_by_user_id" uuid NOT NULL,
	"source" varchar(20) NOT NULL,
	"repository_id" uuid,
	"turn_index" integer NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"question_text" text NOT NULL,
	"choices" jsonb NOT NULL,
	"correct_answer" text NOT NULL,
	"tips" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "battle_quizzes" ADD CONSTRAINT "battle_quizzes_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "battle_quizzes" ADD CONSTRAINT "battle_quizzes_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "battle_quizzes_room_id_idx" ON "battle_quizzes" USING btree ("room_id");
--> statement-breakpoint
CREATE INDEX "battle_quizzes_generated_by_user_id_idx" ON "battle_quizzes" USING btree ("generated_by_user_id");
