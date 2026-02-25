package handler

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strconv"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/lib/pq"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

// ErrInvalidGitHubID は github_id のパースに失敗したことを示す
var ErrInvalidGitHubID = errors.New("invalid github_id")

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
	room := newGameRoom(roomID, m.userRepo, func() {
		m.remove(roomID)
		log.Printf("room manager: removed room %s", roomID)
	})
	m.rooms[roomID] = room
	log.Printf("room manager: created room %s", roomID)
	return room
}

// remove はルームをレジストリから削除する
func (m *RoomManager) remove(roomID uuid.UUID) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rooms, roomID)
}

// GetOrCreateUser は github_login でユーザーを取得し、存在しなければ作成して返す
func (m *RoomManager) GetOrCreateUser(ctx context.Context, githubLogin string, githubIDStr string) (*entity.User, error) {
	user, err := m.userRepo.GetByGitHubLogin(ctx, githubLogin)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	githubID, parseErr := strconv.ParseInt(githubIDStr, 10, 64)
	if parseErr != nil {
		return nil, ErrInvalidGitHubID
	}
	user = &entity.User{
		GitHubID:    githubID,
		GitHubLogin: githubLogin,
	}
	if createErr := m.userRepo.Create(ctx, user); createErr != nil {
		// UNIQUE 制約違反 (23505) は同時リクエストによる競合。既存レコードを取得して返す
		var pqErr *pq.Error
		if errors.As(createErr, &pqErr) && pqErr.Code == "23505" {
			existing, getErr := m.userRepo.GetByGitHubLogin(ctx, githubLogin)
			if getErr == nil {
				return existing, nil
			}
		}
		return nil, fmt.Errorf("failed to create user: %w", createErr)
	}
	log.Printf("room manager: auto-created user %s (id=%s)", githubLogin, user.ID)
	return user, nil
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
