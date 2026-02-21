CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT NOT NULL UNIQUE,
    github_login VARCHAR(255) NOT NULL,
    gnu_balance INT NOT NULL DEFAULT 1000,
    rate INT NOT NULL DEFAULT 1500,
    encrypted_token TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    player1_id UUID NOT NULL REFERENCES users(id),
    player2_id UUID NOT NULL REFERENCES users(id),
    winner_id UUID REFERENCES users(id),
    gnu_diff INT NOT NULL DEFAULT 0,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_match_histories_player1 ON match_histories(player1_id);
CREATE INDEX idx_match_histories_player2 ON match_histories(player2_id);
CREATE INDEX idx_match_histories_room ON match_histories(room_id);
