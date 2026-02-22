package persistence

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

const (
	matchmakingQueueKey  = "matchmaking:queue"
	matchmakingActiveKey = "matchmaking:active:"
	matchmakingActiveTTL = 300 * time.Second
)

type matchmakingRepository struct {
	rdb *redis.Client
}

func NewMatchmakingRepository(rdb *redis.Client) repository.MatchmakingRepository {
	return &matchmakingRepository{rdb: rdb}
}

func (r *matchmakingRepository) Enqueue(ctx context.Context, userID uuid.UUID) error {
	return r.rdb.RPush(ctx, matchmakingQueueKey, userID.String()).Err()
}

func (r *matchmakingRepository) Dequeue(ctx context.Context) (uuid.UUID, uuid.UUID, error) {
	first, err := r.rdb.LPop(ctx, matchmakingQueueKey).Result()
	if err != nil {
		if err == redis.Nil {
			return uuid.Nil, uuid.Nil, nil
		}
		return uuid.Nil, uuid.Nil, fmt.Errorf("dequeue first: %w", err)
	}

	second, err := r.rdb.LPop(ctx, matchmakingQueueKey).Result()
	if err != nil {
		if err == redis.Nil {
			r.rdb.RPush(ctx, matchmakingQueueKey, first)
			return uuid.Nil, uuid.Nil, nil
		}
		r.rdb.RPush(ctx, matchmakingQueueKey, first)
		return uuid.Nil, uuid.Nil, fmt.Errorf("dequeue second: %w", err)
	}

	firstID, err := uuid.Parse(first)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("parse first uuid: %w", err)
	}

	secondID, err := uuid.Parse(second)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("parse second uuid: %w", err)
	}

	return firstID, secondID, nil
}

func (r *matchmakingRepository) Remove(ctx context.Context, userID uuid.UUID) error {
	return r.rdb.LRem(ctx, matchmakingQueueKey, 1, userID.String()).Err()
}

func (r *matchmakingRepository) SetActive(ctx context.Context, userID uuid.UUID) (bool, error) {
	result, err := r.rdb.SetArgs(ctx, matchmakingActiveKey+userID.String(), "1", redis.SetArgs{
		TTL:  matchmakingActiveTTL,
		Mode: "NX",
	}).Result()
	if err != nil {
		if err == redis.Nil {
			// NX failed: key already exists
			return false, nil
		}
		return false, fmt.Errorf("set active: %w", err)
	}
	return result == "OK", nil
}

func (r *matchmakingRepository) ClearActive(ctx context.Context, userID uuid.UUID) error {
	return r.rdb.Del(ctx, matchmakingActiveKey+userID.String()).Err()
}
