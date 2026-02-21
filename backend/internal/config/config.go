package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort int    `env:"SERVER_PORT" envDefault:"8080"`
	DBHost     string `env:"DB_HOST" envDefault:"localhost"`
	DBPort     int    `env:"DB_PORT" envDefault:"5432"`
	DBUser     string `env:"DB_USER" envDefault:"postgres"`
	DBPassword string `env:"DB_PASSWORD" envDefault:"postgres"`
	DBName     string `env:"DB_NAME" envDefault:"hackathon"`
	DBSSLMode  string `env:"DB_SSLMODE" envDefault:"disable"`
	RedisAddr  string `env:"REDIS_ADDR" envDefault:"localhost:6379"`
	RedisPW    string `env:"REDIS_PASSWORD" envDefault:""`
	RedisDB    int    `env:"REDIS_DB" envDefault:"0"`
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg, err := env.ParseAs[Config]()
	if err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}
	return &cfg, nil
}
