package entity

import (
	"time"

	"github.com/google/uuid"
)

// RoomStatus はルームの状態を表す型
type RoomStatus string

const (
	RoomStatusWaiting    RoomStatus = "waiting"
	RoomStatusInProgress RoomStatus = "in_progress"
	RoomStatusFinished   RoomStatus = "finished"
)

type Room struct {
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	Status    RoomStatus `json:"status"`
	ID        uuid.UUID  `json:"id"`
	Player1ID uuid.UUID  `json:"player1_id"`
	Player2ID uuid.UUID  `json:"player2_id"`
}
