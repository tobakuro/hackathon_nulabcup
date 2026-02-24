package handler

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

// RoomHandler はゲームルーム用 WebSocket エンドポイントのハンドラ
type RoomHandler struct {
	manager  *RoomManager
	userRepo repository.UserRepository
}

func NewRoomHandler(manager *RoomManager, userRepo repository.UserRepository) *RoomHandler {
	return &RoomHandler{manager: manager, userRepo: userRepo}
}

// HandleRoom は ws://{host}/ws/room/:room_id を処理する
// クエリパラメータ: github_login (必須), github_id (ユーザー未登録時に必須)
func (h *RoomHandler) HandleRoom(c echo.Context) error {
	roomIDStr := c.Param("room_id")
	roomID, err := uuid.Parse(roomIDStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid room_id")
	}

	githubLogin := c.QueryParam("github_login")
	if githubLogin == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "github_login is required")
	}

	ctx := c.Request().Context()

	user, err := h.userRepo.GetByGitHubLogin(ctx, githubLogin)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			log.Printf("room %s: failed to get user %s: %v", roomID, githubLogin, err)
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user")
		}
		// ユーザー未登録の場合は自動作成
		githubIDStr := c.QueryParam("github_id")
		githubID, parseErr := strconv.ParseInt(githubIDStr, 10, 64)
		if parseErr != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid github_id")
		}
		user = &entity.User{
			GitHubID:    githubID,
			GitHubLogin: githubLogin,
		}
		if createErr := h.userRepo.Create(ctx, user); createErr != nil {
			log.Printf("room %s: failed to create user %s: %v", roomID, githubLogin, createErr)
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to create user")
		}
		log.Printf("room %s: auto-created user %s (id=%s)", roomID, githubLogin, user.ID)
	}

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := ws.Close(); closeErr != nil {
			log.Printf("room %s: ws close error: %v", roomID, closeErr)
		}
	}()

	log.Printf("room %s: player %s connected", roomID, user.GitHubLogin)

	idx, doneCh, room, err := h.manager.Join(context.Background(), roomID, ws, user)
	if err != nil {
		log.Printf("room %s: join failed for %s: %v", roomID, user.GitHubLogin, err)
		sendWSMessage(ws, WSMessage{
			Type: "ev_error",
			Payload: map[string]any{
				"code":    "join_failed",
				"message": "ルームへの参加に失敗しました: " + err.Error(),
			},
		})
		return nil
	}

	// idx==0 のプレイヤーがゲームループを起動する
	if idx == 0 {
		go room.run(context.Background())
	}

	// WebSocket の読み取りは startReaderLoop に委譲する
	go room.startReaderLoop(idx)

	// 接続が閉じるまでブロック（doneCh は startReaderLoop が close する）
	<-doneCh

	log.Printf("room %s: player %s disconnected", roomID, user.GitHubLogin)
	return nil
}
