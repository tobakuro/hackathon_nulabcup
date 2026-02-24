-- +goose Up
-- +goose StatementBegin
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"full_name" varchar(511) NOT NULL,
	"summary_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_full_name_unique" UNIQUE("full_name")
);

CREATE TABLE "repository_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"file_path" varchar(1024) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE "repository_files" DROP CONSTRAINT "repository_files_repository_id_repositories_id_fk";
DROP TABLE "repository_files";
DROP TABLE "repositories";
-- +goose StatementEnd
