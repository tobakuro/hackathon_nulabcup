package redis

import (
	"context"
	"crypto/tls"
	"fmt"

	"github.com/redis/go-redis/v9"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/config"
)

func NewClient(cfg *config.Config) (*redis.Client, error) {
	var opts *redis.Options
	var err error

	// REDIS_URL (e.g. rediss://:<password>@host:port) takes precedence
	if cfg.RedisURL != "" {
		opts, err = redis.ParseURL(cfg.RedisURL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse REDIS_URL: %w", err)
		}
	} else {
		opts = &redis.Options{
			Addr:     cfg.RedisAddr,
			Password: cfg.RedisPW,
			DB:       cfg.RedisDB,
		}
		if cfg.RedisTLS {
			opts.TLSConfig = &tls.Config{}
		}
	}

	client := redis.NewClient(opts)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}
	return client, nil
}
