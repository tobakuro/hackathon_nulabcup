package handler

import (
	"log"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type RoomHandler struct{}

func NewRoomHandler() *RoomHandler {
	return &RoomHandler{}
}

// HandleRoom はゲームルーム用WebSocketエンドポイント
func (h *RoomHandler) HandleRoom(c echo.Context) error {
	roomID := c.Param("room_id")

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	log.Printf("room %s: new connection from %s", roomID, ws.RemoteAddr())

	// TODO: ゲームループ実装
	// - ev_turn_start: ターン開始・問題配信
	// - act_bet_gnu: ベット受付
	// - act_submit_answer: 回答受付
	// - ev_turn_result: ターン結果送信
	// - ev_game_end: 試合終了
	for {
		msgType, msg, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("room %s: unexpected close: %v", roomID, err)
			}
			break
		}
		log.Printf("room %s: received: %s", roomID, msg)

		// エコーバック（仮実装）
		if err := ws.WriteMessage(msgType, msg); err != nil {
			log.Printf("room %s: write error: %v", roomID, err)
			break
		}
	}
	return nil
}
