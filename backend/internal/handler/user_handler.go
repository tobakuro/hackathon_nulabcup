package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/usecase"
)

type UserHandler struct {
	userUsecase *usecase.UserUsecase
}

func NewUserHandler(uc *usecase.UserUsecase) *UserHandler {
	return &UserHandler{userUsecase: uc}
}

// GetMe は現在のログインユーザー情報を返す
// 認証済みコンテキスト（GitHubAuthMiddleware でセット済み）からユーザーを特定する
func (h *UserHandler) GetMe(c echo.Context) error {
	githubLogin, ok := c.Get("github_login").(string)
	if !ok || githubLogin == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	user, err := h.userUsecase.GetMeByGitHubLogin(c.Request().Context(), githubLogin)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, user)
}
