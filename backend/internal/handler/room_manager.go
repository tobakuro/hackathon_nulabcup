package handler

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

// RoomManager はゲームルームのレジストリ
type RoomManager struct {
	rooms    map[uuid.UUID]*GameRoom
	userRepo repository.UserRepository
	mu       sync.RWMutex
}

func NewRoomManager(userRepo repository.UserRepository) *RoomManager {
	return &RoomManager{
		rooms:    make(map[uuid.UUID]*GameRoom),
		userRepo: userRepo,
	}
}

// getOrCreate はルームを取得または新規作成する
func (m *RoomManager) getOrCreate(roomID uuid.UUID) *GameRoom {
	m.mu.Lock()
	defer m.mu.Unlock()
	if room, ok := m.rooms[roomID]; ok {
		return room
	}
	room := newGameRoom(roomID, m.userRepo)
	m.rooms[roomID] = room
	log.Printf("room manager: created room %s", roomID)
	return room
}

// Join はプレイヤーをルームに参加させ、接続終了を知らせる doneCh を返す
// idx==0 のとき、呼び出し元はゲームループを goroutine で起動すること
func (m *RoomManager) Join(
	ctx context.Context,
	roomID uuid.UUID,
	conn *websocket.Conn,
	user *entity.User,
) (int, <-chan struct{}, *GameRoom, error) {
	room := m.getOrCreate(roomID)
	idx, doneCh, err := room.join(conn, user)
	if err != nil {
		return -1, nil, nil, fmt.Errorf("join room %s: %w", roomID, err)
	}
	log.Printf("room manager: player[%d] %s joined room %s", idx, user.GitHubLogin, roomID)
	return idx, doneCh, room, nil
}
