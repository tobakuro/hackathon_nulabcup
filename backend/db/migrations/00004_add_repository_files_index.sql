-- +goose Up
-- +goose StatementBegin
CREATE INDEX IF NOT EXISTS "repository_files_repository_id_idx" ON "repository_files" ("repository_id");
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS "repository_files_repository_id_idx";
-- +goose StatementEnd
