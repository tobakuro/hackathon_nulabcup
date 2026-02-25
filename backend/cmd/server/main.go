package main

import (
	"context"
	"fmt"
	"log"
	"os"

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
	defer func() {
		if closeErr := db.Close(); closeErr != nil {
			log.Printf("failed to close db: %v", closeErr)
		}
	}()
	log.Println("connected to PostgreSQL")

	// Redis
	rdb, err := infra_redis.NewClient(cfg)
	if err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}
	defer func() {
		if err := rdb.Close(); err != nil {
			log.Printf("failed to close redis: %v", err)
		}
	}()
	log.Println("connected to Redis")

	// DI
	queries := sqlc.New(db)
	userRepo := persistence.NewUserRepository(queries)
	userUsecase := usecase.NewUserUsecase(userRepo)

	matchmakingRepo := persistence.NewMatchmakingRepository(rdb)
	roomRepo := persistence.NewRoomRepository(queries, rdb)
	matchmakingUsecase := usecase.NewMatchmakingUsecase(matchmakingRepo, roomRepo, userRepo)

	hub := handler.NewHub(matchmakingUsecase)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Run(ctx)

	userHandler := handler.NewUserHandler(userUsecase)
	matchmakeHandler := handler.NewMatchmakeHandler(hub, userRepo)
	roomManager := handler.NewRoomManager(userRepo)
	roomHandler := handler.NewRoomHandler(roomManager)

	var devHandler *handler.DevHandler
	if os.Getenv("ENV") == "development" {
		devHandler = handler.NewDevHandler(userRepo, matchmakingUsecase)
	}

	// Router & Start
	e := handler.NewRouter(userHandler, matchmakeHandler, roomHandler, devHandler)
	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	log.Printf("starting server on %s", addr)
	if err := e.Start(addr); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
