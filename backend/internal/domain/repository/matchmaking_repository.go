package repository

import (
	"context"

	"github.com/google/uuid"
)

type MatchmakingRepository interface {
	Enqueue(ctx context.Context, userID uuid.UUID) error
	Dequeue(ctx context.Context) (uuid.UUID, uuid.UUID, error)
	Remove(ctx context.Context, userID uuid.UUID) error
	SetActive(ctx context.Context, userID uuid.UUID) (bool, error)
	ClearActive(ctx context.Context, userID uuid.UUID) error
}
