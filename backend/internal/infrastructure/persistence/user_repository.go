package persistence

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/infrastructure/postgres/sqlc"
)

type userRepository struct {
	q *sqlc.Queries
}

func NewUserRepository(q *sqlc.Queries) repository.UserRepository {
	return &userRepository{q: q}
}

func (r *userRepository) GetByID(ctx context.Context, id uuid.UUID) (*entity.User, error) {
	u, err := r.q.GetUserByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return toEntityUser(u), nil
}

func (r *userRepository) GetByGitHubID(ctx context.Context, githubID int64) (*entity.User, error) {
	u, err := r.q.GetUserByGitHubID(ctx, githubID)
	if err != nil {
		return nil, fmt.Errorf("get user by github id: %w", err)
	}
	return toEntityUser(u), nil
}

func (r *userRepository) Create(ctx context.Context, user *entity.User) error {
	created, err := r.q.CreateUser(ctx, sqlc.CreateUserParams{
		GithubID:       user.GitHubID,
		GithubLogin:    user.GitHubLogin,
		EncryptedToken: user.EncryptedToken,
	})
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	user.ID = created.ID
	user.GnuBalance = int(created.GnuBalance)
	user.Rate = int(created.Rate)
	user.CreatedAt = created.CreatedAt
	user.UpdatedAt = created.UpdatedAt
	return nil
}

func (r *userRepository) UpdateGnuBalance(ctx context.Context, id uuid.UUID, balance int) error {
	return r.q.UpdateGnuBalance(ctx, sqlc.UpdateGnuBalanceParams{
		ID:         id,
		GnuBalance: int32(balance),
	})
}

func toEntityUser(u sqlc.User) *entity.User {
	return &entity.User{
		ID:             u.ID,
		GitHubID:       u.GithubID,
		GitHubLogin:    u.GithubLogin,
		GnuBalance:     int(u.GnuBalance),
		Rate:           int(u.Rate),
		EncryptedToken: u.EncryptedToken,
		CreatedAt:      u.CreatedAt,
		UpdatedAt:      u.UpdatedAt,
	}
}
