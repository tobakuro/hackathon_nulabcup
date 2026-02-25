package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

const githubUserAPI = "https://api.github.com/user"

// githubUser は GitHub API /user のレスポンスの必要フィールドのみ定義する
type githubUser struct {
	Login string `json:"login"`
}

// GitHubAuthMiddleware は Authorization: Bearer <token> ヘッダーを検証し、
// GitHub API でトークンを検証したうえで github_login をコンテキストにセットする
func GitHubAuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")

		login, err := resolveGitHubLogin(c.Request().Context(), token)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		}

		c.Set("github_login", login)
		return next(c)
	}
}

func resolveGitHubLogin(ctx context.Context, token string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, githubUserAPI, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("github api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("github api returned %d", resp.StatusCode)
	}

	var u githubUser
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if u.Login == "" {
		return "", fmt.Errorf("empty login")
	}
	return u.Login, nil
}
