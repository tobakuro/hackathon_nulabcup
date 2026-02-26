-- +goose Up
-- repositories, repository_files テーブルは Drizzle (frontend) で管理するため、goose では作成しない
-- +goose StatementBegin                           
-- CREATE INDEX IF NOT EXISTS "repository_files_repository_id_idx" ON "repository_files" ("repository_id");
-- +goose StatementEnd

-- +goose Down
-- no-op
