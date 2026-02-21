package entity

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID             uuid.UUID `json:"id"`
	GitHubID       int64     `json:"github_id"`
	GitHubLogin    string    `json:"github_login"`
	GnuBalance     int       `json:"gnu_balance"`
	Rate           int       `json:"rate"`
	EncryptedToken string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
