-- +goose Up
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    player2_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'closed')),
    CONSTRAINT no_self_match CHECK (player1_id <> player2_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rooms_player1_id_idx ON rooms (player1_id);
CREATE INDEX IF NOT EXISTS rooms_player2_id_idx ON rooms (player2_id);

-- +goose Down
DROP TABLE IF EXISTS rooms;
