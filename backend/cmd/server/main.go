package main

import (
	"fmt"
	"log"

	"github.com/tobakuro/hackathon_nulabcup/backend/internal/config"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/handler"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/infrastructure/persistence"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/infrastructure/postgres"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/infrastructure/postgres/sqlc"
	infra_redis "github.com/tobakuro/hackathon_nulabcup/backend/internal/infrastructure/redis"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// PostgreSQL
	db, err := postgres.NewDB(cfg)
	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}
	defer db.Close()
	log.Println("connected to PostgreSQL")

	// Redis
	rdb, err := infra_redis.NewClient(cfg)
	if err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}
	defer rdb.Close()
	log.Println("connected to Redis")

	// DI
	queries := sqlc.New(db)
	userRepo := persistence.NewUserRepository(queries)
	userUsecase := usecase.NewUserUsecase(userRepo)

	userHandler := handler.NewUserHandler(userUsecase)
	matchmakeHandler := handler.NewMatchmakeHandler()
	roomHandler := handler.NewRoomHandler()

	// Router & Start
	e := handler.NewRouter(userHandler, matchmakeHandler, roomHandler)
	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	log.Printf("starting server on %s", addr)
	if err := e.Start(addr); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
