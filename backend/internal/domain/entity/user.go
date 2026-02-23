package entity

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	GitHubLogin    string    `json:"github_login"`
	EncryptedToken string    `json:"-"`
	GitHubID       int64     `json:"github_id"`
	GnuBalance     int       `json:"gnu_balance"`
	Rate           int       `json:"rate"`
	ID             uuid.UUID `json:"id"`
}
