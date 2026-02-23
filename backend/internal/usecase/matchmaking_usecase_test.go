package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/testutil"
)

func TestJoinQueue_Success(t *testing.T) {
	userID := uuid.New()
	var enqueuedID uuid.UUID

	mmRepo := &testutil.MockMatchmakingRepository{
		SetActiveFunc: func(_ context.Context, id uuid.UUID) (bool, error) {
			return true, nil
		},
		EnqueueFunc: func(_ context.Context, id uuid.UUID) error {
			enqueuedID = id
			return nil
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, nil)
	err := uc.JoinQueue(context.Background(), userID)

	require.NoError(t, err)
	assert.Equal(t, userID, enqueuedID)
}

func TestJoinQueue_AlreadyInQueue(t *testing.T) {
	mmRepo := &testutil.MockMatchmakingRepository{
		SetActiveFunc: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, nil
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, nil)
	err := uc.JoinQueue(context.Background(), uuid.New())

	require.Error(t, err)
	assert.Contains(t, err.Error(), "already_in_queue")
}

func TestJoinQueue_SetActiveFails(t *testing.T) {
	mmRepo := &testutil.MockMatchmakingRepository{
		SetActiveFunc: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, errors.New("redis error")
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, nil)
	err := uc.JoinQueue(context.Background(), uuid.New())

	require.Error(t, err)
	assert.Contains(t, err.Error(), "set active")
}

func TestJoinQueue_EnqueueFails_ClearsActive(t *testing.T) {
	var clearActiveCalled bool

	mmRepo := &testutil.MockMatchmakingRepository{
		SetActiveFunc: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return true, nil
		},
		EnqueueFunc: func(_ context.Context, _ uuid.UUID) error {
			return errors.New("enqueue error")
		},
		ClearActiveFunc: func(_ context.Context, _ uuid.UUID) error {
			clearActiveCalled = true
			return nil
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, nil)
	err := uc.JoinQueue(context.Background(), uuid.New())

	require.Error(t, err)
	assert.Contains(t, err.Error(), "enqueue")
	assert.True(t, clearActiveCalled, "ClearActive should be called on Enqueue failure")
}

func TestLeaveQueue_Success(t *testing.T) {
	var removeOrder, clearOrder int
	callCount := 0

	mmRepo := &testutil.MockMatchmakingRepository{
		RemoveFunc: func(_ context.Context, _ uuid.UUID) error {
			callCount++
			removeOrder = callCount
			return nil
		},
		ClearActiveFunc: func(_ context.Context, _ uuid.UUID) error {
			callCount++
			clearOrder = callCount
			return nil
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, nil)
	err := uc.LeaveQueue(context.Background(), uuid.New())

	require.NoError(t, err)
	assert.Equal(t, 1, removeOrder, "Remove should be called first")
	assert.Equal(t, 2, clearOrder, "ClearActive should be called second")
}

func TestLeaveQueue_RemoveFails(t *testing.T) {
	mmRepo := &testutil.MockMatchmakingRepository{
		RemoveFunc: func(_ context.Context, _ uuid.UUID) error {
			return errors.New("remove error")
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, nil)
	err := uc.LeaveQueue(context.Background(), uuid.New())

	require.Error(t, err)
	assert.Contains(t, err.Error(), "remove from queue")
}

func TestTryMatch_Success(t *testing.T) {
	p1ID := uuid.New()
	p2ID := uuid.New()
	var clearedIDs []uuid.UUID

	player1 := &entity.User{ID: p1ID, GitHubLogin: "player1", Rate: 1500}
	player2 := &entity.User{ID: p2ID, GitHubLogin: "player2", Rate: 1600}

	mmRepo := &testutil.MockMatchmakingRepository{
		DequeueFunc: func(_ context.Context) (uuid.UUID, uuid.UUID, error) {
			return p1ID, p2ID, nil
		},
		ClearActiveFunc: func(_ context.Context, id uuid.UUID) error {
			clearedIDs = append(clearedIDs, id)
			return nil
		},
	}

	userRepo := &testutil.MockUserRepository{
		GetByIDFunc: func(_ context.Context, id uuid.UUID) (*entity.User, error) {
			if id == p1ID {
				return player1, nil
			}
			return player2, nil
		},
	}

	roomRepo := &testutil.MockRoomRepository{
		CreateFunc: func(_ context.Context, room *entity.Room) error {
			return nil
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, roomRepo, userRepo)
	result, err := uc.TryMatch(context.Background())

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, player1, result.Player1)
	assert.Equal(t, player2, result.Player2)
	assert.Equal(t, p1ID, result.Room.Player1ID)
	assert.Equal(t, p2ID, result.Room.Player2ID)
	assert.Equal(t, "waiting", result.Room.Status)
	assert.Len(t, clearedIDs, 2)
	assert.Contains(t, clearedIDs, p1ID)
	assert.Contains(t, clearedIDs, p2ID)
}

func TestTryMatch_QueueInsufficient(t *testing.T) {
	mmRepo := &testutil.MockMatchmakingRepository{
		DequeueFunc: func(_ context.Context) (uuid.UUID, uuid.UUID, error) {
			return uuid.Nil, uuid.Nil, nil
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, nil)
	result, err := uc.TryMatch(context.Background())

	require.NoError(t, err)
	assert.Nil(t, result)
}

func TestTryMatch_GetPlayer1Fails(t *testing.T) {
	p1ID := uuid.New()
	p2ID := uuid.New()
	var clearedIDs []uuid.UUID

	mmRepo := &testutil.MockMatchmakingRepository{
		DequeueFunc: func(_ context.Context) (uuid.UUID, uuid.UUID, error) {
			return p1ID, p2ID, nil
		},
		ClearActiveFunc: func(_ context.Context, id uuid.UUID) error {
			clearedIDs = append(clearedIDs, id)
			return nil
		},
	}

	userRepo := &testutil.MockUserRepository{
		GetByIDFunc: func(_ context.Context, id uuid.UUID) (*entity.User, error) {
			return nil, errors.New("user not found")
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, userRepo)
	result, err := uc.TryMatch(context.Background())

	require.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "get player1")
	assert.Len(t, clearedIDs, 2, "ClearActive should be called for both players on error")
	assert.Contains(t, clearedIDs, p1ID)
	assert.Contains(t, clearedIDs, p2ID)
}

func TestTryMatch_GetPlayer2Fails(t *testing.T) {
	p1ID := uuid.New()
	p2ID := uuid.New()
	player1 := &entity.User{ID: p1ID}
	var clearedIDs []uuid.UUID

	mmRepo := &testutil.MockMatchmakingRepository{
		DequeueFunc: func(_ context.Context) (uuid.UUID, uuid.UUID, error) {
			return p1ID, p2ID, nil
		},
		ClearActiveFunc: func(_ context.Context, id uuid.UUID) error {
			clearedIDs = append(clearedIDs, id)
			return nil
		},
	}

	userRepo := &testutil.MockUserRepository{
		GetByIDFunc: func(_ context.Context, id uuid.UUID) (*entity.User, error) {
			if id == p1ID {
				return player1, nil
			}
			return nil, errors.New("user not found")
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, nil, userRepo)
	result, err := uc.TryMatch(context.Background())

	require.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "get player2")
	assert.Len(t, clearedIDs, 2, "ClearActive should be called for both players on error")
	assert.Contains(t, clearedIDs, p1ID)
	assert.Contains(t, clearedIDs, p2ID)
}

func TestTryMatch_CreateRoomFails(t *testing.T) {
	p1ID := uuid.New()
	p2ID := uuid.New()
	var clearedIDs []uuid.UUID

	mmRepo := &testutil.MockMatchmakingRepository{
		DequeueFunc: func(_ context.Context) (uuid.UUID, uuid.UUID, error) {
			return p1ID, p2ID, nil
		},
		ClearActiveFunc: func(_ context.Context, id uuid.UUID) error {
			clearedIDs = append(clearedIDs, id)
			return nil
		},
	}

	userRepo := &testutil.MockUserRepository{
		GetByIDFunc: func(_ context.Context, id uuid.UUID) (*entity.User, error) {
			return &entity.User{ID: id}, nil
		},
	}

	roomRepo := &testutil.MockRoomRepository{
		CreateFunc: func(_ context.Context, _ *entity.Room) error {
			return errors.New("db error")
		},
	}

	uc := NewMatchmakingUsecase(mmRepo, roomRepo, userRepo)
	result, err := uc.TryMatch(context.Background())

	require.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "create room")
	assert.Len(t, clearedIDs, 2, "ClearActive should be called for both players on error")
	assert.Contains(t, clearedIDs, p1ID)
	assert.Contains(t, clearedIDs, p2ID)
}
