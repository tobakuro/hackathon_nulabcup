-- +goose Up
-- repository_files インデックスは Drizzle (frontend) で管理するため、goose では作成しない

-- +goose Down
-- no-op