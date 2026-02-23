-- name: CreateRoom :one
INSERT INTO rooms (id, player1_id, player2_id, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetRoomByID :one
SELECT * FROM rooms WHERE id = $1;

-- name: UpdateRoomStatus :exec
UPDATE rooms SET status = $2, updated_at = NOW() WHERE id = $1;
