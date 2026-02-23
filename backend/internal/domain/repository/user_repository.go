package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
)

type UserRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*entity.User, error)
	GetByGitHubID(ctx context.Context, githubID int64) (*entity.User, error)
	GetByGitHubLogin(ctx context.Context, login string) (*entity.User, error)
	Create(ctx context.Context, user *entity.User) error
	UpdateGnuBalance(ctx context.Context, id uuid.UUID, balance int) error
}
