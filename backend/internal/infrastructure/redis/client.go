package redis

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/config"
)

func NewClient(cfg *config.Config) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPW,
		DB:       cfg.RedisDB,
	})
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}
	return client, nil
}
