package handler

import (
	"encoding/json"
	"log"
	"math/rand/v2"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
)

// botQuestions は Bot が送信するダミー問題セット
var botQuestions = []entity.Question{
	{
		Difficulty:    "easy",
		QuestionText:  "Go 言語で変数を宣言するキーワードはどれ？",
		CorrectAnswer: "var",
		Tips:          "var キーワードを使うと型推論なしで変数宣言できます。",
		Choices:       []string{"var", "let", "val", "dim"},
	},
	{
		Difficulty:    "hard",
		QuestionText:  "Go の goroutine 間でデータを安全に共有するための推奨手段はどれ？",
		CorrectAnswer: "channel",
		Tips:          "\"Do not communicate by sharing memory; instead, share memory by communicating.\"",
		Choices:       []string{"channel", "mutex のみ", "グローバル変数", "atomic だけ"},
	},
	{
		Difficulty:    "easy",
		QuestionText:  "HTTP ステータスコード 404 が示すものは？",
		CorrectAnswer: "Not Found",
		Tips:          "404 はリソースが見つからないことを示します。",
		Choices:       []string{"Not Found", "Internal Server Error", "Unauthorized", "Bad Request"},
	},
	{
		Difficulty:    "normal",
		QuestionText:  "Git で直前のコミットメッセージを修正するコマンドはどれ？",
		CorrectAnswer: "git commit --amend",
		Tips:          "--amend は直前のコミットを上書き修正します。push 済みの場合は force push が必要です。",
		Choices:       []string{"git commit --amend", "git rebase -i", "git reset HEAD~1", "git revert HEAD"},
	},
}

// RunBotPlayer は指定ルームに Bot として接続し、自動でゲームをプレイする
// serverAddr: "localhost:8080" 形式
func RunBotPlayer(serverAddr string, roomID uuid.UUID, botUser *entity.User) {
	wsURL := "ws://" + serverAddr + "/ws/room/" + roomID.String() +
		"?github_login=" + botUser.GitHubLogin +
		"&github_id=999999999"

	log.Printf("bot: connecting to %s", wsURL)

	// 少し待ってから接続（人間プレイヤーが先に接続するための猶予）
	time.Sleep(500 * time.Millisecond)

	// Origin ヘッダーを付けてサーバー側の Origin チェックを通過させる
	header := http.Header{}
	header.Set("Origin", "http://localhost:3000")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		log.Printf("bot: failed to connect: %v", err)
		return
	}
	defer func() {
		if err := conn.Close(); err != nil {
			log.Printf("bot: close error: %v", err)
		}
	}()

	log.Printf("bot: connected to room %s", roomID)

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("bot: unexpected close: %v", err)
			} else {
				log.Printf("bot: connection closed")
			}
			return
		}

		var msg struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		log.Printf("bot: received %s", msg.Type)

		switch msg.Type {
		case "ev_room_ready":
			// 問題を送信
			time.Sleep(300 * time.Millisecond)
			sendBotMessage(conn, map[string]any{
				"type": "act_submit_questions",
				"payload": map[string]any{
					"my_questions": botQuestions[:2],
					"for_opponent": botQuestions[2:],
				},
			})
			log.Printf("bot: submitted questions")

		case "ev_turn_start":
			var payload struct {
				Choices      []string `json:"choices"`
				MaxBet       int      `json:"max_bet"`
				TimeLimitSec int      `json:"time_limit_sec"`
			}
			if err := json.Unmarshal(msg.Payload, &payload); err != nil {
				continue
			}

			// ランダムなベット（0〜所持の20%）
			bet := 0
			if payload.MaxBet > 0 {
				bet = rand.IntN(payload.MaxBet/5 + 1)
			}
			time.Sleep(time.Duration(500+rand.IntN(1000)) * time.Millisecond)
			sendBotMessage(conn, map[string]any{
				"type":    "act_bet_gnu",
				"payload": map[string]any{"amount": bet},
			})

			// ランダムな時間後に回答（人間らしく）
			thinkMs := 2000 + rand.IntN(8000)
			time.Sleep(time.Duration(thinkMs) * time.Millisecond)

			// ランダムに回答（約50%の正解率）
			choiceIdx := rand.IntN(len(payload.Choices))
			sendBotMessage(conn, map[string]any{
				"type": "act_submit_answer",
				"payload": map[string]any{
					"choice_index": choiceIdx,
					"time_ms":      thinkMs,
				},
			})
			log.Printf("bot: answered choice %d", choiceIdx)

		case "ev_game_end", "ev_tko":
			log.Printf("bot: game finished")
			return

		case "ev_error":
			var errPayload struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}
			if err := json.Unmarshal(msg.Payload, &errPayload); err == nil {
				log.Printf("bot: received error: %s - %s", errPayload.Code, errPayload.Message)
			}
			return
		}
	}
}

func sendBotMessage(conn *websocket.Conn, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("bot: marshal error: %v", err)
		return
	}
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("bot: write error: %v", err)
	}
}
