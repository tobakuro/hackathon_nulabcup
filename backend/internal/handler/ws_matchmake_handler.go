package handler

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: 本番では適切なオリジンチェックを行う
	},
}

type MatchmakeHandler struct{}

func NewMatchmakeHandler() *MatchmakeHandler {
	return &MatchmakeHandler{}
}

// HandleMatchmake はマッチング用WebSocketエンドポイント
func (h *MatchmakeHandler) HandleMatchmake(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	log.Printf("matchmake: new connection from %s", ws.RemoteAddr())

	// TODO: マッチングキュー（Redis）への追加、マッチング成立時のev_match_found送信
	for {
		msgType, msg, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("matchmake: unexpected close: %v", err)
			}
			break
		}
		log.Printf("matchmake: received: %s", msg)

		// エコーバック（仮実装）
		if err := ws.WriteMessage(msgType, msg); err != nil {
			log.Printf("matchmake: write error: %v", err)
			break
		}
	}
	return nil
}
