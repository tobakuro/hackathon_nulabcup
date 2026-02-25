package handler

import (
	"log"
	"os"

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

	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogMethod:  true,
		LogURI:     true,
		LogStatus:  true,
		LogLatency: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			log.Printf("%s %s %d %s", v.Method, v.URI, v.Status, v.Latency)
			return nil
		},
	}))
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
	if os.Getenv("ENV") == "development" && devHandler != nil {
		dev := e.Group("/api/dev")
		dev.POST("/enqueue-test-user", devHandler.EnqueueTestUser)
		dev.POST("/start-bot-match", devHandler.StartBotMatch)
	}

	return e
}
