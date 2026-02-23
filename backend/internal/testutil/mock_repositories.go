package testutil

import (
	"context"

	"github.com/google/uuid"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
)

// MockMatchmakingRepository is a mock implementation of repository.MatchmakingRepository.
type MockMatchmakingRepository struct {
	EnqueueFunc     func(ctx context.Context, userID uuid.UUID) error
	DequeueFunc     func(ctx context.Context) (uuid.UUID, uuid.UUID, error)
	RemoveFunc      func(ctx context.Context, userID uuid.UUID) error
	SetActiveFunc   func(ctx context.Context, userID uuid.UUID) (bool, error)
	ClearActiveFunc func(ctx context.Context, userID uuid.UUID) error
}

func (m *MockMatchmakingRepository) Enqueue(ctx context.Context, userID uuid.UUID) error {
	return m.EnqueueFunc(ctx, userID)
}

func (m *MockMatchmakingRepository) Dequeue(ctx context.Context) (uuid.UUID, uuid.UUID, error) {
	return m.DequeueFunc(ctx)
}

func (m *MockMatchmakingRepository) Remove(ctx context.Context, userID uuid.UUID) error {
	return m.RemoveFunc(ctx, userID)
}

func (m *MockMatchmakingRepository) SetActive(ctx context.Context, userID uuid.UUID) (bool, error) {
	return m.SetActiveFunc(ctx, userID)
}

func (m *MockMatchmakingRepository) ClearActive(ctx context.Context, userID uuid.UUID) error {
	return m.ClearActiveFunc(ctx, userID)
}

// MockRoomRepository is a mock implementation of repository.RoomRepository.
type MockRoomRepository struct {
	CreateFunc  func(ctx context.Context, room *entity.Room) error
	GetByIDFunc func(ctx context.Context, id uuid.UUID) (*entity.Room, error)
}

func (m *MockRoomRepository) Create(ctx context.Context, room *entity.Room) error {
	return m.CreateFunc(ctx, room)
}

func (m *MockRoomRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.Room, error) {
	return m.GetByIDFunc(ctx, id)
}

// MockUserRepository is a mock implementation of repository.UserRepository.
type MockUserRepository struct {
	GetByIDFunc          func(ctx context.Context, id uuid.UUID) (*entity.User, error)
	GetByGitHubIDFunc    func(ctx context.Context, githubID int64) (*entity.User, error)
	GetByGitHubLoginFunc func(ctx context.Context, login string) (*entity.User, error)
	CreateFunc           func(ctx context.Context, user *entity.User) error
	UpdateGnuBalanceFunc func(ctx context.Context, id uuid.UUID, balance int) error
}

func (m *MockUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.User, error) {
	return m.GetByIDFunc(ctx, id)
}

func (m *MockUserRepository) GetByGitHubID(ctx context.Context, githubID int64) (*entity.User, error) {
	return m.GetByGitHubIDFunc(ctx, githubID)
}

func (m *MockUserRepository) GetByGitHubLogin(ctx context.Context, login string) (*entity.User, error) {
	return m.GetByGitHubLoginFunc(ctx, login)
}

func (m *MockUserRepository) Create(ctx context.Context, user *entity.User) error {
	return m.CreateFunc(ctx, user)
}

func (m *MockUserRepository) UpdateGnuBalance(ctx context.Context, id uuid.UUID, balance int) error {
	return m.UpdateGnuBalanceFunc(ctx, id, balance)
}
