package persistence

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/infrastructure/postgres/sqlc"
)

const roomStateTTL = 24 * time.Hour

type roomRepository struct {
	q   *sqlc.Queries
	rdb *redis.Client
}

func NewRoomRepository(q *sqlc.Queries, rdb *redis.Client) repository.RoomRepository {
	return &roomRepository{q: q, rdb: rdb}
}

func (r *roomRepository) Create(ctx context.Context, room *entity.Room) error {
	// PostgreSQL に先に永続化して正確なタイムスタンプを取得
	created, err := r.q.CreateRoom(ctx, sqlc.CreateRoomParams{
		ID:        room.ID,
		Player1ID: room.Player1ID,
		Player2ID: room.Player2ID,
		Status:    string(room.Status),
	})
	if err != nil {
		return fmt.Errorf("create room: %w", err)
	}

	room.CreatedAt = created.CreatedAt
	room.UpdatedAt = created.UpdatedAt

	// Redis に状態を保存
	key := fmt.Sprintf("room:%s:state", room.ID.String())
	if err := r.rdb.HSet(ctx, key, map[string]any{
		"player1_id": room.Player1ID.String(),
		"player2_id": room.Player2ID.String(),
		"status":     string(room.Status),
		"created_at": room.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}).Err(); err != nil {
		return fmt.Errorf("redis hset room: %w", err)
	}

	if err := r.rdb.Expire(ctx, key, roomStateTTL).Err(); err != nil {
		return fmt.Errorf("redis expire room: %w", err)
	}

	return nil
}

func (r *roomRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Room, error) {
	row, err := r.q.GetRoomByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get room by id: %w", err)
	}
	return &entity.Room{
		ID:        row.ID,
		Player1ID: row.Player1ID,
		Player2ID: row.Player2ID,
		Status:    entity.RoomStatus(row.Status),
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}, nil
}
