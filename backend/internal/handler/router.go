package handler

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func NewRouter(
	userHandler *UserHandler,
	matchmakeHandler *MatchmakeHandler,
	roomHandler *RoomHandler,
	devHandler *DevHandler,
) *echo.Echo {
	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// REST API
	api := e.Group("/api/v1")
	api.GET("/users/me", userHandler.GetMe)

	// WebSocket
	ws := e.Group("/ws")
	ws.GET("/matchmake", matchmakeHandler.HandleMatchmake)
	ws.GET("/room/:room_id", roomHandler.HandleRoom)

	// Dev API (development only)
	dev := e.Group("/api/dev")
	dev.POST("/enqueue-test-user", devHandler.EnqueueTestUser)

	return e
}
