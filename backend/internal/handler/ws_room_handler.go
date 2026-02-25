package handler

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// RoomHandler はゲームルーム用 WebSocket エンドポイントのハンドラ
type RoomHandler struct {
	manager *RoomManager
}

func NewRoomHandler(manager *RoomManager) *RoomHandler {
	return &RoomHandler{manager: manager}
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

	user, err := h.manager.GetOrCreateUser(ctx, githubLogin, c.QueryParam("github_id"))
	if err != nil {
		log.Printf("room %s: failed to get or create user %s: %v", roomID, githubLogin, err)
		if errors.Is(err, ErrInvalidGitHubID) {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid github_id")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get or create user")
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
