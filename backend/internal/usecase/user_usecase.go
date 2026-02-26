package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

type UserUsecase struct {
	userRepo repository.UserRepository
}

func NewUserUsecase(userRepo repository.UserRepository) *UserUsecase {
	return &UserUsecase{userRepo: userRepo}
}

func (uc *UserUsecase) GetMe(ctx context.Context, userID uuid.UUID) (*entity.User, error) {
	return uc.userRepo.GetByID(ctx, userID)
}

func (uc *UserUsecase) GetMeByGitHubLogin(ctx context.Context, login string) (*entity.User, error) {
	return uc.userRepo.GetByGitHubLogin(ctx, login)
}
