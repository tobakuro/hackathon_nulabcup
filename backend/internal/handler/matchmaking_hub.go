package handler

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/usecase"
)

type WSMessage struct {
	Type    string      `json:"type"`
	Payload any `json:"payload"`
}

type Hub struct {
	connections map[uuid.UUID]*websocket.Conn
	mu          sync.RWMutex
	usecase     *usecase.MatchmakingUsecase
}

func NewHub(uc *usecase.MatchmakingUsecase) *Hub {
	return &Hub{
		connections: make(map[uuid.UUID]*websocket.Conn),
		usecase:     uc,
	}
}

func (h *Hub) Register(userID uuid.UUID, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.connections[userID] = conn
}

func (h *Hub) Unregister(userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.connections, userID)

	ctx := context.Background()
	if err := h.usecase.LeaveQueue(ctx, userID); err != nil {
		log.Printf("hub: failed to leave queue for %s: %v", userID, err)
	}
}

func (h *Hub) SendToUser(userID uuid.UUID, msg WSMessage) {
	h.mu.RLock()
	conn, ok := h.connections[userID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("hub: failed to marshal message: %v", err)
		return
	}

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("hub: failed to send to %s: %v", userID, err)
	}
}

func (h *Hub) Run(ctx context.Context) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	log.Println("hub: matchmaking loop started")
	for {
		select {
		case <-ctx.Done():
			log.Println("hub: matchmaking loop stopped")
			return
		case <-ticker.C:
			result, err := h.usecase.TryMatch(ctx)
			if err != nil {
				log.Printf("hub: try match error: %v", err)
				continue
			}
			if result == nil {
				continue
			}

			log.Printf("hub: match found! room=%s, p1=%s, p2=%s",
				result.Room.ID, result.Player1.GitHubLogin, result.Player2.GitHubLogin)

			// Player1 に通知
			h.SendToUser(result.Room.Player1ID, WSMessage{
				Type: "ev_match_found",
				Payload: map[string]any{
					"room_id": result.Room.ID.String(),
					"opponent": map[string]any{
						"id":           result.Player2.ID.String(),
						"github_login": result.Player2.GitHubLogin,
						"rate":         result.Player2.Rate,
					},
				},
			})

			// Player2 に通知
			h.SendToUser(result.Room.Player2ID, WSMessage{
				Type: "ev_match_found",
				Payload: map[string]any{
					"room_id": result.Room.ID.String(),
					"opponent": map[string]any{
						"id":           result.Player1.ID.String(),
						"github_login": result.Player1.GitHubLogin,
						"rate":         result.Player1.Rate,
					},
				},
			})
		}
	}
}
