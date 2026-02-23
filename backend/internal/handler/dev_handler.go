package handler

import (
	"database/sql"
	"errors"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/usecase"
)

type DevHandler struct {
	userRepo      repository.UserRepository
	matchmakingUC *usecase.MatchmakingUsecase
}

func NewDevHandler(userRepo repository.UserRepository, matchmakingUC *usecase.MatchmakingUsecase) *DevHandler {
	return &DevHandler{userRepo: userRepo, matchmakingUC: matchmakingUC}
}

// EnqueueTestUser はテストユーザーを作成してマッチングキューに追加する
func (h *DevHandler) EnqueueTestUser(c echo.Context) error {
	ctx := c.Request().Context()

	// テストユーザーを DB から取得、なければ作成
	testLogin := "test-bot"
	user, err := h.userRepo.GetByGitHubLogin(ctx, testLogin)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			log.Printf("dev: failed to get test user: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get test user"})
		}
		user = &entity.User{
			GitHubID:    999999999,
			GitHubLogin: testLogin,
		}
		if err := h.userRepo.Create(ctx, user); err != nil {
			log.Printf("dev: failed to create test user: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create test user"})
		}
		log.Printf("dev: created test user %s (id=%s)", testLogin, user.ID)
	}

	// キューに追加
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

	log.Printf("dev: test user %s (id=%s) enqueued", testLogin, user.ID)
	return c.JSON(http.StatusOK, map[string]string{
		"message": "test-bot enqueued",
		"user_id": user.ID.String(),
	})
}
