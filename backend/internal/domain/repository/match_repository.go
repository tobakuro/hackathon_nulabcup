package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
)

type MatchRepository interface {
	Create(ctx context.Context, match *entity.MatchHistory) error
	GetByRoomID(ctx context.Context, roomID uuid.UUID) (*entity.MatchHistory, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*entity.MatchHistory, error)
}
