package entity

import (
	"time"

	"github.com/google/uuid"
)

type MatchHistory struct {
	ID        uuid.UUID  `json:"id"`
	RoomID    uuid.UUID  `json:"room_id"`
	Player1ID uuid.UUID  `json:"player1_id"`
	Player2ID uuid.UUID  `json:"player2_id"`
	WinnerID  *uuid.UUID `json:"winner_id"`
	GnuDiff   int        `json:"gnu_diff"`
	PlayedAt  time.Time  `json:"played_at"`
}
