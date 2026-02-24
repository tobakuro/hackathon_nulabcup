-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT NOT NULL UNIQUE,
    github_login VARCHAR(255) NOT NULL,
    gnu_balance INT NOT NULL DEFAULT 1000 CHECK (gnu_balance >= 0),
    rate INT NOT NULL DEFAULT 1500,
    encrypted_token TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_login ON users (github_login);

-- +goose Down
DROP TABLE IF EXISTS users;
