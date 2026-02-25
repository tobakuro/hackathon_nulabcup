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
	Payload any    `json:"payload"`
	Type    string `json:"type"`
}

type Hub struct {
	connections map[uuid.UUID]*websocket.Conn
	usecase     *usecase.MatchmakingUsecase
	// Bot 向けマッチ通知サブスクライバ (userID → channel)
	matchSubs map[uuid.UUID]chan<- *usecase.MatchmakingResult
	mu        sync.RWMutex
}

func NewHub(uc *usecase.MatchmakingUsecase) *Hub {
	return &Hub{
		connections: make(map[uuid.UUID]*websocket.Conn),
		matchSubs:   make(map[uuid.UUID]chan<- *usecase.MatchmakingResult),
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
	delete(h.connections, userID)
	h.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := h.usecase.LeaveQueue(ctx, userID); err != nil {
		log.Printf("hub: failed to leave queue for %s: %v", userID, err)
	}
}

// SubscribeMatch は userID のマッチ成立を待つチャネルを登録する
// 呼び出し元は UnsubscribeMatch で必ずクリーンアップすること
func (h *Hub) SubscribeMatch(userID uuid.UUID, ch chan<- *usecase.MatchmakingResult) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.matchSubs[userID] = ch
}

// UnsubscribeMatch はサブスクライバを削除する
func (h *Hub) UnsubscribeMatch(userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.matchSubs, userID)
}

func (h *Hub) SendToUser(userID uuid.UUID, msg WSMessage) {
	h.mu.RLock()
	conn, ok := h.connections[userID]
	h.mu.RUnlock()
	if !ok {
		log.Printf("hub: no connection found for user %s (skipping send)", userID)
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("hub: failed to marshal message: %v", err)
		return
	}

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("hub: failed to send to %s: %v", userID, err)
	} else {
		log.Printf("hub: sent %s to user %s", msg.Type, userID)
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

			log.Printf("hub: match found! room=%s, p1=%s (%s), p2=%s (%s)",
				result.Room.ID,
				result.Player1.GitHubLogin, result.Room.Player1ID,
				result.Player2.GitHubLogin, result.Room.Player2ID)

			// 接続マップの状態をログ
			h.mu.RLock()
			connIDs := make([]string, 0, len(h.connections))
			for id := range h.connections {
				connIDs = append(connIDs, id.String())
			}
			h.mu.RUnlock()
			log.Printf("hub: current connections: %v", connIDs)

			// Bot サブスクライバに通知
			h.mu.RLock()
			sub1, ok1 := h.matchSubs[result.Room.Player1ID]
			sub2, ok2 := h.matchSubs[result.Room.Player2ID]
			h.mu.RUnlock()
			if ok1 {
				select {
				case sub1 <- result:
				case <-time.After(200 * time.Millisecond):
					log.Printf("hub: dropped match notification for subscriber %s", result.Room.Player1ID)
				}
			}
			if ok2 {
				select {
				case sub2 <- result:
				case <-time.After(200 * time.Millisecond):
					log.Printf("hub: dropped match notification for subscriber %s", result.Room.Player2ID)
				}
			}

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
