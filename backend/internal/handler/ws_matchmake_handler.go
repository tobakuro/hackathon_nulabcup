package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/usecase"
)

// allowedOrigins は環境変数 ALLOWED_ORIGINS からカンマ区切りで読み込む
func allowedOrigins() []string {
	raw := os.Getenv("ALLOWED_ORIGINS")
	if raw == "" {
		return []string{"http://localhost:3000"}
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		for _, allowed := range allowedOrigins() {
			if origin == allowed {
				return true
			}
		}
		log.Printf("ws: rejected origin %q", origin)
		return false
	},
}

type MatchmakeHandler struct {
	hub      *Hub
	userRepo repository.UserRepository
}

func NewMatchmakeHandler(hub *Hub, userRepo repository.UserRepository) *MatchmakeHandler {
	return &MatchmakeHandler{hub: hub, userRepo: userRepo}
}

func (h *MatchmakeHandler) HandleMatchmake(c echo.Context) error {
	githubLogin := c.QueryParam("github_login")
	if githubLogin == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "github_login is required")
	}

	ctx := c.Request().Context()

	// GitHub login からユーザーを検索（存在しなければ自動作成）
	user, err := h.userRepo.GetByGitHubLogin(ctx, githubLogin)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			log.Printf("matchmake: failed to get user %s: %v", githubLogin, err)
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user")
		}
		log.Printf("matchmake: user %s not found, creating...", githubLogin)
		githubIDStr := c.QueryParam("github_id")
		githubID, parseErr := strconv.ParseInt(githubIDStr, 10, 64)
		if parseErr != nil {
			log.Printf("matchmake: invalid github_id %q: %v", githubIDStr, parseErr)
			return echo.NewHTTPError(http.StatusBadRequest, "invalid github_id")
		}
		user = &entity.User{
			GitHubID:    githubID,
			GitHubLogin: githubLogin,
		}
		if createErr := h.userRepo.Create(ctx, user); createErr != nil {
			log.Printf("matchmake: failed to create user %s: %v", githubLogin, createErr)
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to create user")
		}
		log.Printf("matchmake: created user %s with id %s", githubLogin, user.ID)
	}

	userID := user.ID

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	// JoinQueue を先に呼び出し、成功後に Register する
	if err := h.hub.usecase.JoinQueue(ctx, userID); err != nil {
		if errors.Is(err, usecase.ErrAlreadyInQueue) {
			sendWSMessage(ws, WSMessage{
				Type: "ev_error",
				Payload: map[string]any{
					"code":    "already_in_queue",
					"message": "既にマッチングキューに参加しています",
				},
			})
		} else {
			log.Printf("matchmake: join queue error for %s: %v", userID, err)
			sendWSMessage(ws, WSMessage{
				Type: "ev_error",
				Payload: map[string]any{
					"code":    "queue_error",
					"message": "キューへの参加に失敗しました",
				},
			})
		}
		return nil
	}

	h.hub.Register(userID, ws)
	defer h.hub.Unregister(userID)

	log.Printf("matchmake: user %s (%s) connected", githubLogin, userID)

	sendWSMessage(ws, WSMessage{
		Type: "ev_queue_joined",
		Payload: map[string]any{
			"message": "マッチング待機中...",
		},
	})

	// メッセージ読み取りループ
	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("matchmake: unexpected close for %s: %v", userID, err)
			}
			break
		}

		var incoming WSMessage
		if err := json.Unmarshal(msg, &incoming); err != nil {
			log.Printf("matchmake: invalid message from %s: %v", userID, err)
			continue
		}

		switch incoming.Type {
		case "act_cancel_matchmaking":
			log.Printf("matchmake: user %s cancelled", userID)
			// LeaveQueue は defer h.hub.Unregister(userID) が呼び出す
			return nil
		}
	}

	return nil
}

func sendWSMessage(ws *websocket.Conn, msg WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("matchmake: marshal error: %v", err)
		return
	}
	if err := ws.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("matchmake: write error: %v", err)
	}
}
