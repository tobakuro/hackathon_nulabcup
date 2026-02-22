package config

import (
	"fmt"
	"os"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort int    `env:"SERVER_PORT" envDefault:"8080"`
	DBHost     string `env:"DB_HOST"`
	DBPort     int    `env:"DB_PORT" envDefault:"5432"`
	DBUser     string `env:"DB_USER"`
	DBPassword string `env:"DB_PASSWORD"`
	DBName     string `env:"DB_NAME" envDefault:"hackathon"`
	DBSSLMode  string `env:"DB_SSLMODE" envDefault:"disable"`
	RedisAddr  string `env:"REDIS_ADDR" envDefault:"localhost:6379"`
	RedisPW    string `env:"REDIS_PASSWORD" envDefault:""`
	RedisDB    int    `env:"REDIS_DB" envDefault:"0"`
}

func (c *Config) DSN() string {
	host := envFallback(c.DBHost, "PGHOST", "localhost")
	user := envFallback(c.DBUser, "USER", "postgres")

	dsn := fmt.Sprintf("host=%s port=%d user=%s dbname=%s sslmode=%s",
		host, c.DBPort, user, c.DBName, c.DBSSLMode)
	if c.DBPassword != "" {
		dsn += fmt.Sprintf(" password=%s", c.DBPassword)
	}
	return dsn
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg, err := env.ParseAs[Config]()
	if err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}
	return &cfg, nil
}

// envFallback returns val if non-empty, otherwise checks the fallback env var, then uses defaultVal.
func envFallback(val, fallbackEnv, defaultVal string) string {
	if val != "" {
		return val
	}
	if v := os.Getenv(fallbackEnv); v != "" {
		return v
	}
	return defaultVal
}
