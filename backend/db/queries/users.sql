-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByGitHubID :one
SELECT * FROM users WHERE github_id = $1;

-- name: CreateUser :one
INSERT INTO users (github_id, github_login, encrypted_token)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByGitHubLogin :one
SELECT * FROM users WHERE github_login = $1;

-- name: UpdateGnuBalance :exec
UPDATE users SET gnu_balance = GREATEST(0, gnu_balance + $2), updated_at = NOW() WHERE id = $1;
