package usecase

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

// ErrAlreadyInQueue はユーザーが既にマッチングキューにいる場合のエラー
var ErrAlreadyInQueue = errors.New("already_in_queue")

type MatchmakingResult struct {
	Room    *entity.Room
	Player1 *entity.User
	Player2 *entity.User
}

type MatchmakingUsecase struct {
	matchmakingRepo repository.MatchmakingRepository
	roomRepo        repository.RoomRepository
	userRepo        repository.UserRepository
}

func NewMatchmakingUsecase(
	matchmakingRepo repository.MatchmakingRepository,
	roomRepo repository.RoomRepository,
	userRepo repository.UserRepository,
) *MatchmakingUsecase {
	return &MatchmakingUsecase{
		matchmakingRepo: matchmakingRepo,
		roomRepo:        roomRepo,
		userRepo:        userRepo,
	}
}

func (uc *MatchmakingUsecase) JoinQueue(ctx context.Context, userID uuid.UUID) error {
	ok, err := uc.matchmakingRepo.SetActive(ctx, userID)
	if err != nil {
		return fmt.Errorf("set active: %w", err)
	}
	if !ok {
		return ErrAlreadyInQueue
	}

	if err := uc.matchmakingRepo.Enqueue(ctx, userID); err != nil {
		if clearErr := uc.matchmakingRepo.ClearActive(ctx, userID); clearErr != nil {
			log.Printf("matchmaking: clear active on enqueue failure: %v", clearErr)
		}
		return fmt.Errorf("enqueue: %w", err)
	}
	return nil
}

func (uc *MatchmakingUsecase) LeaveQueue(ctx context.Context, userID uuid.UUID) error {
	if err := uc.matchmakingRepo.Remove(ctx, userID); err != nil {
		return fmt.Errorf("remove from queue: %w", err)
	}
	if err := uc.matchmakingRepo.ClearActive(ctx, userID); err != nil {
		return fmt.Errorf("clear active: %w", err)
	}
	return nil
}

func (uc *MatchmakingUsecase) TryMatch(ctx context.Context) (*MatchmakingResult, error) {
	p1ID, p2ID, err := uc.matchmakingRepo.Dequeue(ctx)
	if err != nil {
		return nil, fmt.Errorf("dequeue: %w", err)
	}
	if p1ID == uuid.Nil || p2ID == uuid.Nil {
		return nil, nil
	}

	// Dequeue 成功後のエラーパスでは active フラグをクリアしてキューに戻す
	clearBoth := func() {
		if clearErr := uc.matchmakingRepo.ClearActive(ctx, p1ID); clearErr != nil {
			log.Printf("matchmaking: clear active p1: %v", clearErr)
		}
		if clearErr := uc.matchmakingRepo.ClearActive(ctx, p2ID); clearErr != nil {
			log.Printf("matchmaking: clear active p2: %v", clearErr)
		}
	}
	requeueBoth := func() {
		if reqErr := uc.matchmakingRepo.Enqueue(ctx, p1ID); reqErr != nil {
			log.Printf("matchmaking: requeue p1: %v", reqErr)
		}
		if reqErr := uc.matchmakingRepo.Enqueue(ctx, p2ID); reqErr != nil {
			log.Printf("matchmaking: requeue p2: %v", reqErr)
		}
	}

	// ユーザー情報取得
	player1, err := uc.userRepo.GetByID(ctx, p1ID)
	if err != nil {
		requeueBoth()
		clearBoth()
		return nil, fmt.Errorf("get player1: %w", err)
	}
	player2, err := uc.userRepo.GetByID(ctx, p2ID)
	if err != nil {
		requeueBoth()
		clearBoth()
		return nil, fmt.Errorf("get player2: %w", err)
	}

	// ルーム生成
	room := &entity.Room{
		ID:        uuid.New(),
		Player1ID: p1ID,
		Player2ID: p2ID,
		Status:    entity.RoomStatusWaiting,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := uc.roomRepo.Create(ctx, room); err != nil {
		requeueBoth()
		clearBoth()
		return nil, fmt.Errorf("create room: %w", err)
	}

	// active フラグをクリア（正常系）
	clearBoth()

	return &MatchmakingResult{
		Room:    room,
		Player1: player1,
		Player2: player2,
	}, nil
}
