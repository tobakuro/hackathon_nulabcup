package handler

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/usecase"
)

type DevHandler struct {
	userRepo      repository.UserRepository
	matchmakingUC *usecase.MatchmakingUsecase
	hub           *Hub
	serverAddr    string
}

func NewDevHandler(userRepo repository.UserRepository, matchmakingUC *usecase.MatchmakingUsecase, hub *Hub) *DevHandler {
	addr := os.Getenv("BOT_SERVER_ADDR")
	if addr == "" {
		addr = "localhost:8080"
	}
	return &DevHandler{
		userRepo:      userRepo,
		matchmakingUC: matchmakingUC,
		hub:           hub,
		serverAddr:    addr,
	}
}

// getOrCreateTestBot は test-bot ユーザーを取得または作成する
func (h *DevHandler) getOrCreateTestBot(c echo.Context) (*entity.User, error) {
	ctx := c.Request().Context()
	testLogin := "test-bot"
	user, err := h.userRepo.GetByGitHubLogin(ctx, testLogin)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		user = &entity.User{
			GitHubID:    999999999,
			GitHubLogin: testLogin,
		}
		if createErr := h.userRepo.Create(ctx, user); createErr != nil {
			// 同時作成競合を吸収: 別リクエストが先に作成済みの場合は再取得して返す
			existing, getErr := h.userRepo.GetByGitHubLogin(ctx, testLogin)
			if getErr == nil {
				return existing, nil
			}
			return nil, createErr
		}
		log.Printf("dev: created test user %s (id=%s)", testLogin, user.ID)
	}
	return user, nil
}

// EnqueueTestUser はテストユーザーをマッチングキューに追加する（既存の簡易エンドポイント）
func (h *DevHandler) EnqueueTestUser(c echo.Context) error {
	user, err := h.getOrCreateTestBot(c)
	if err != nil {
		log.Printf("dev: failed to get/create test user: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get test user"})
	}

	ctx := c.Request().Context()
	if err := h.matchmakingUC.JoinQueue(ctx, user.ID); err != nil {
		if errors.Is(err, usecase.ErrAlreadyInQueue) {
			return c.JSON(http.StatusConflict, map[string]string{
				"message": "test-bot is already in queue",
				"user_id": user.ID.String(),
			})
		}
		log.Printf("dev: failed to enqueue test user: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to enqueue"})
	}

	log.Printf("dev: test user %s (id=%s) enqueued", user.GitHubLogin, user.ID)
	return c.JSON(http.StatusOK, map[string]string{
		"message": "test-bot enqueued",
		"user_id": user.ID.String(),
	})
}

// StartBotMatch は test-bot をキューに追加し、マッチ成立後に自動プレイ Bot を起動する
func (h *DevHandler) StartBotMatch(c echo.Context) error {
	user, err := h.getOrCreateTestBot(c)
	if err != nil {
		log.Printf("dev: failed to get/create test user: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get test user"})
	}

	ctx := c.Request().Context()

	// サブスクライバ登録（マッチ成立を待つ）
	matchCh := make(chan *usecase.MatchmakingResult, 1)
	h.hub.SubscribeMatch(user.ID, matchCh)

	if err := h.matchmakingUC.JoinQueue(ctx, user.ID); err != nil {
		h.hub.UnsubscribeMatch(user.ID)
		if errors.Is(err, usecase.ErrAlreadyInQueue) {
			return c.JSON(http.StatusConflict, map[string]string{
				"message": "test-bot is already in queue",
				"user_id": user.ID.String(),
			})
		}
		log.Printf("dev: failed to enqueue test user: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to enqueue"})
	}

	log.Printf("dev: bot queued, waiting for match...")

	// マッチ成立を非同期で待ち、Bot goroutine を起動
	serverAddr := h.serverAddr
	go func() {
		defer h.hub.UnsubscribeMatch(user.ID)
		result := <-matchCh
		if result == nil {
			return
		}
		log.Printf("dev: bot matched! room=%s", result.Room.ID)
		go RunBotPlayer(serverAddr, result.Room.ID, user)
	}()

	return c.JSON(http.StatusOK, map[string]string{
		"message": "test-bot queued, bot will join room when matched",
		"user_id": user.ID.String(),
	})
}
