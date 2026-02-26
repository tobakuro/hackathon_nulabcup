-- users テーブルは goose (backend/db/migrations) で管理するため、ここでは作成しない
CREATE INDEX IF NOT EXISTS "repository_files_repository_id_idx" ON "repository_files" USING btree ("repository_id");