package persistence

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

// dequeueScript は 2 件をアトミックに LPOP する Lua スクリプト
var dequeueScript = redis.NewScript(`
local first = redis.call('LPOP', KEYS[1])
if not first then
  return {}
end
local second = redis.call('LPOP', KEYS[1])
if not second then
  redis.call('RPUSH', KEYS[1], first)
  return {}
end
return {first, second}
`)

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
	raw, err := dequeueScript.Run(ctx, r.rdb, []string{matchmakingQueueKey}).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return uuid.Nil, uuid.Nil, nil
		}
		return uuid.Nil, uuid.Nil, fmt.Errorf("dequeue script: %w", err)
	}

	items, ok := raw.([]interface{})
	if !ok || len(items) != 2 {
		return uuid.Nil, uuid.Nil, nil
	}

	result := make([]string, 2)
	for i, item := range items {
		s, ok := item.(string)
		if !ok || s == "" {
			return uuid.Nil, uuid.Nil, nil
		}
		result[i] = s
	}

	firstID, err := uuid.Parse(result[0])
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("parse first uuid: %w", err)
	}

	secondID, err := uuid.Parse(result[1])
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
		if errors.Is(err, redis.Nil) {
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
