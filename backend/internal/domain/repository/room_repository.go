package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
)

type RoomRepository interface {
	Create(ctx context.Context, room *entity.Room) error
	GetByID(ctx context.Context, id uuid.UUID) (*entity.Room, error)
}
