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
// クエリパラメータ github_login でユーザーを特定する
func (h *UserHandler) GetMe(c echo.Context) error {
	githubLogin := c.QueryParam("github_login")
	if githubLogin == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	user, err := h.userUsecase.GetMeByGitHubLogin(c.Request().Context(), githubLogin)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	return c.JSON(http.StatusOK, user)
}
