CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" bigint NOT NULL,
	"github_login" varchar(255) NOT NULL,
	"gnu_balance" integer DEFAULT 1000 NOT NULL,
	"rate" integer DEFAULT 1500 NOT NULL,
	"encrypted_token" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_files_repository_id_idx" ON "repository_files" USING btree ("repository_id");