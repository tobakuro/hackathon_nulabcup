package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/entity"
	"github.com/tobakuro/hackathon_nulabcup/backend/internal/domain/repository"
)

const (
	turnDuration      = 15 * time.Second
	questionWaitLimit = 60 * time.Second
	baseGnuPerCorrect = 100
	tkoBonus          = 300
	minBet            = 0 // ベット額の最小値（0 = ノーリスク）
)

// QuestionSet はフロントエンドが送信する問題セット
// MyQuestions[0]=Easy, MyQuestions[1]=Hard  (自分が解く)
// ForOpponent[0]=Easy, ForOpponent[1]=Normal (相手が解く)
type QuestionSet struct {
	MyQuestions []entity.Question `json:"my_questions"`
	ForOpponent []entity.Question `json:"for_opponent"`
}

// playerMsg はプレイヤー読み取りループから送られるメッセージ
type playerMsg struct {
	msgType string
	payload json.RawMessage
	idx     int
}

// betPayload は act_bet_gnu のペイロード
type betPayload struct {
	Amount int `json:"amount"`
}

// submitAnswerPayload は act_submit_answer のペイロード
type submitAnswerPayload struct {
	ChoiceIndex int `json:"choice_index"`
	TimeMs      int `json:"time_ms"`
}

// submitQuestionsPayload は act_submit_questions のペイロード
type submitQuestionsPayload struct {
	MyQuestions []entity.Question `json:"my_questions"`
	ForOpponent []entity.Question `json:"for_opponent"`
}

// gamePlayerState はプレイヤーごとのゲーム状態
type gamePlayerState struct {
	user       *entity.User
	conn       *websocket.Conn
	questions  *QuestionSet
	doneCh     chan struct{} // 読み取りループ終了時に close される
	writeMu    sync.Mutex
	gnuBalance int
}

func (p *gamePlayerState) send(msg WSMessage) {
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("game: marshal error: %v", err)
		return
	}
	if err := p.conn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("game: write error to %s: %v", p.user.GitHubLogin, err)
	}
}

// GameRoom は1試合のゲームルーム
type GameRoom struct {
	userRepo  repository.UserRepository
	players   [2]*gamePlayerState
	startCh   chan struct{} // 両プレイヤーが揃った時に close される
	msgCh     chan playerMsg
	disconnCh chan int // 切断したプレイヤーのインデックス
	id        uuid.UUID
	mu        sync.Mutex
	joined    int
	onClose   func()     // ルーム終了時に一度だけ呼ばれるコールバック
	closeOnce sync.Once
}

func newGameRoom(id uuid.UUID, userRepo repository.UserRepository, onClose func()) *GameRoom {
	return &GameRoom{
		id:        id,
		userRepo:  userRepo,
		startCh:   make(chan struct{}),
		msgCh:     make(chan playerMsg, 32),
		disconnCh: make(chan int, 2),
		onClose:   onClose,
	}
}

// join はプレイヤーをルームに参加させ、プレイヤーインデックスと doneCh を返す
func (r *GameRoom) join(conn *websocket.Conn, user *entity.User) (int, <-chan struct{}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.joined >= 2 {
		return -1, nil, fmt.Errorf("room is full")
	}
	idx := r.joined
	doneCh := make(chan struct{})
	r.players[idx] = &gamePlayerState{
		user:       user,
		conn:       conn,
		gnuBalance: user.GnuBalance,
		doneCh:     doneCh,
	}
	r.joined++
	if r.joined == 2 {
		close(r.startCh)
	}
	return idx, doneCh, nil
}

// startReaderLoop はプレイヤーの WebSocket を読み取り msgCh に転送する
// 切断時に doneCh を close して disconnCh にインデックスを送る
func (r *GameRoom) startReaderLoop(idx int) {
	p := r.players[idx]
	defer func() {
		close(p.doneCh)
		r.disconnCh <- idx
	}()

	for {
		_, data, err := p.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("game room %s: player[%d] unexpected close: %v", r.id, idx, err)
			}
			return
		}

		var raw struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(data, &raw); err != nil {
			log.Printf("game room %s: player[%d] invalid json: %v", r.id, idx, err)
			continue
		}

		select {
		case r.msgCh <- playerMsg{idx: idx, msgType: raw.Type, payload: raw.Payload}:
		default:
			log.Printf("game room %s: msgCh full, dropping message from player[%d]", r.id, idx)
			p.send(WSMessage{
				Type: "ev_error",
				Payload: map[string]any{
					"code":    "server_busy",
					"message": "サーバーが混雑しています。もう一度送信してください。",
				},
			})
		}
	}
}

// run はゲームループを実行する（goroutine で呼び出す）
func (r *GameRoom) run(ctx context.Context) {
	defer r.closeOnce.Do(r.onClose)
	log.Printf("game room %s: waiting for both players", r.id)

	// 両プレイヤーが揃うまで待つ
	select {
	case <-r.startCh:
	case idx := <-r.disconnCh:
		log.Printf("game room %s: player[%d] disconnected before game started", r.id, idx)
		r.notifyOpponentDisconnect(idx)
		return
	case <-ctx.Done():
		return
	}

	p0 := r.players[0]
	p1 := r.players[1]

	log.Printf("game room %s: both players joined, starting game", r.id)

	// ev_room_ready を両プレイヤーに送信
	for i, p := range r.players {
		opp := r.players[1-i]
		p.send(WSMessage{
			Type: "ev_room_ready",
			Payload: map[string]any{
				"your_gnu_balance": p.gnuBalance,
				"opponent": map[string]any{
					"id":           opp.user.ID.String(),
					"github_login": opp.user.GitHubLogin,
					"rate":         opp.user.Rate,
					"gnu_balance":  opp.gnuBalance,
				},
			},
		})
	}

	// ―― 問題受取フェーズ ――
	questionTimer := time.After(questionWaitLimit)
	questionsDone := [2]bool{}

	for !questionsDone[0] || !questionsDone[1] {
		select {
		case <-questionTimer:
			log.Printf("game room %s: timeout waiting for questions", r.id)
			r.sendBothError("question_timeout", "問題の送信がタイムアウトしました")
			return
		case idx := <-r.disconnCh:
			log.Printf("game room %s: player[%d] disconnected during question phase", r.id, idx)
			r.notifyOpponentDisconnect(idx)
			return
		case <-ctx.Done():
			return
		case msg := <-r.msgCh:
			if msg.msgType != "act_submit_questions" {
				continue
			}
			if questionsDone[msg.idx] {
				continue
			}
			var qs submitQuestionsPayload
			if err := json.Unmarshal(msg.payload, &qs); err != nil {
				log.Printf("game room %s: player[%d] invalid questions payload: %v", r.id, msg.idx, err)
				continue
			}
			if len(qs.MyQuestions) < 2 || len(qs.ForOpponent) < 2 {
				log.Printf("game room %s: player[%d] insufficient questions", r.id, msg.idx)
				r.players[msg.idx].send(WSMessage{
					Type: "ev_error",
					Payload: map[string]any{
						"code":    "invalid_questions",
						"message": "my_questions と for_opponent はそれぞれ2問必要です",
					},
				})
				continue
			}
			allQs := append(qs.MyQuestions[:2:2], qs.ForOpponent[:2]...)
			valid := true
			for _, q := range allQs {
				if err := q.Validate(); err != nil {
					log.Printf("game room %s: player[%d] invalid question: %v", r.id, msg.idx, err)
					r.players[msg.idx].send(WSMessage{
						Type: "ev_error",
						Payload: map[string]any{
							"code":    "invalid_questions",
							"message": err.Error(),
						},
					})
					valid = false
					break
				}
			}
			if !valid {
				continue
			}
			r.players[msg.idx].questions = &QuestionSet{
				MyQuestions: qs.MyQuestions,
				ForOpponent: qs.ForOpponent,
			}
			questionsDone[msg.idx] = true
			log.Printf("game room %s: player[%d] submitted questions", r.id, msg.idx)
		}
	}

	log.Printf("game room %s: all questions received, starting turns", r.id)

	// ―― ターン定義 ――
	// ターン0: p0 は p1 の for_opponent[0] (Easy), p1 は p0 の for_opponent[0] (Easy)
	// ターン1: p0 は p0 の my_questions[0] (Easy), p1 は p1 の my_questions[0] (Easy)
	// ターン2: p0 は p1 の for_opponent[1] (Normal), p1 は p0 の for_opponent[1] (Normal)
	// ターン3: p0 は p0 の my_questions[1] (Hard), p1 は p1 の my_questions[1] (Hard)
	type turnDef struct {
		qForP0 entity.Question
		qForP1 entity.Question
	}
	turns := []turnDef{
		{qForP0: p1.questions.ForOpponent[0], qForP1: p0.questions.ForOpponent[0]},
		{qForP0: p0.questions.MyQuestions[0], qForP1: p1.questions.MyQuestions[0]},
		{qForP0: p1.questions.ForOpponent[1], qForP1: p0.questions.ForOpponent[1]},
		{qForP0: p0.questions.MyQuestions[1], qForP1: p1.questions.MyQuestions[1]},
	}

	totalGnuEarned := [2]int{}
	correctCounts := [2]int{}

	// ―― ターンループ ――
	for turnIdx, turn := range turns {
		questions := [2]entity.Question{turn.qForP0, turn.qForP1}
		bets := [2]int{}
		answers := [2]int{-1, -1} // -1 = 未回答（タイムアウト）
		answered := [2]bool{}

		// ev_turn_start 送信
		for i, p := range r.players {
			q := questions[i]
			p.send(WSMessage{
				Type: "ev_turn_start",
				Payload: map[string]any{
					"turn":             turnIdx + 1,
					"total_turns":      4,
					"difficulty":       q.Difficulty,
					"question_text":    q.QuestionText,
					"choices":          q.Choices,
					"time_limit_sec":   15,
					"your_gnu_balance": p.gnuBalance,
					"min_bet":          minBet,
					"max_bet":          p.gnuBalance,
				},
			})
		}

		turnTimer := time.After(turnDuration)
		turnDone := false

		for !turnDone {
			select {
			case <-turnTimer:
				log.Printf("game room %s: turn %d timeout", r.id, turnIdx+1)
				turnDone = true

			case idx := <-r.disconnCh:
				log.Printf("game room %s: player[%d] disconnected during turn %d", r.id, idx, turnIdx+1)
				r.handleTKO(idx)
				return

			case <-ctx.Done():
				return

			case msg := <-r.msgCh:
				switch msg.msgType {
				case "act_bet_gnu":
					if answered[msg.idx] {
						continue // 回答後のベット変更は禁止
					}
					var bp betPayload
					if err := json.Unmarshal(msg.payload, &bp); err != nil {
						continue
					}
					maxBet := r.players[msg.idx].gnuBalance
					if bp.Amount < minBet || bp.Amount > maxBet {
						r.players[msg.idx].send(WSMessage{
							Type: "ev_error",
							Payload: map[string]any{
								"code":    "invalid_bet",
								"message": fmt.Sprintf("ベット額は %d 以上 %d 以下で指定してください", minBet, maxBet),
								"min_bet": minBet,
								"max_bet": maxBet,
							},
						})
						continue
					}
					bets[msg.idx] = bp.Amount
					r.players[msg.idx].send(WSMessage{
						Type: "ev_bet_confirmed",
						Payload: map[string]any{
							"amount":  bp.Amount,
							"min_bet": minBet,
							"max_bet": maxBet,
						},
					})
					log.Printf("game room %s: player[%d] bet %d gnu", r.id, msg.idx, bp.Amount)

				case "act_submit_answer":
					if answered[msg.idx] {
						continue // 二重回答は無視
					}
					var ap submitAnswerPayload
					if err := json.Unmarshal(msg.payload, &ap); err != nil {
						continue
					}
					answers[msg.idx] = ap.ChoiceIndex
					answered[msg.idx] = true
					log.Printf("game room %s: player[%d] answered %d", r.id, msg.idx, ap.ChoiceIndex)
					if answered[0] && answered[1] {
						turnDone = true
					}
				}
			}
		}

		// ―― ターン結果計算 ――
		gnuDeltas := [2]int{}
		corrects := [2]bool{}
		for i, p := range r.players {
			q := questions[i]
			correctIdx := q.CorrectIndex()
			isCorrect := answers[i] >= 0 && answers[i] == correctIdx
			corrects[i] = isCorrect
			if isCorrect {
				earned := baseGnuPerCorrect + bets[i]
				gnuDeltas[i] = earned
				p.gnuBalance += earned
				totalGnuEarned[i] += earned
				correctCounts[i]++
			} else {
				loss := bets[i]
				gnuDeltas[i] = -loss
				p.gnuBalance -= loss
				if p.gnuBalance < 0 {
					p.gnuBalance = 0
				}
				totalGnuEarned[i] -= loss
			}
		}

		// ev_turn_result 送信
		for i, p := range r.players {
			q := questions[i]
			p.send(WSMessage{
				Type: "ev_turn_result",
				Payload: map[string]any{
					"turn":                turnIdx + 1,
					"correct_answer":      q.CorrectAnswer,
					"correct_index":       q.CorrectIndex(),
					"your_answer":         answers[i],
					"is_correct":          corrects[i],
					"tips":                q.Tips,
					"gnu_delta":           gnuDeltas[i],
					"your_gnu_balance":    p.gnuBalance,
					"opponent_is_correct": corrects[1-i],
					"opponent_gnu_delta":  gnuDeltas[1-i],
				},
			})
		}

		log.Printf("game room %s: turn %d done | p0: correct=%v delta=%d | p1: correct=%v delta=%d",
			r.id, turnIdx+1, corrects[0], gnuDeltas[0], corrects[1], gnuDeltas[1])
	}

	// ―― 試合終了処理 ――
	winnerIdx := -1
	switch {
	case correctCounts[0] > correctCounts[1]:
		winnerIdx = 0
	case correctCounts[1] > correctCounts[0]:
		winnerIdx = 1
	case totalGnuEarned[0] > totalGnuEarned[1]:
		winnerIdx = 0
	case totalGnuEarned[1] > totalGnuEarned[0]:
		winnerIdx = 1
	}

	for i, p := range r.players {
		result := "draw"
		if winnerIdx == i {
			result = "win"
		} else if winnerIdx != -1 {
			result = "lose"
		}
		opp := r.players[1-i]
		p.send(WSMessage{
			Type: "ev_game_end",
			Payload: map[string]any{
				"result":                 result,
				"your_correct_count":     correctCounts[i],
				"opponent_correct_count": correctCounts[1-i],
				"your_final_gnu":         p.gnuBalance,
				"opponent_final_gnu":     opp.gnuBalance,
				"gnu_earned_this_game":   totalGnuEarned[i],
			},
		})
	}

	log.Printf("game room %s: game finished. winner idx=%d | p0 balance=%d | p1 balance=%d",
		r.id, winnerIdx, p0.gnuBalance, p1.gnuBalance)

	// DB 更新: gnu_balance
	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for _, p := range r.players {
		if err := r.userRepo.UpdateGnuBalance(dbCtx, p.user.ID, p.gnuBalance); err != nil {
			log.Printf("game room %s: failed to update gnu_balance for %s: %v",
				r.id, p.user.GitHubLogin, err)
		}
	}
}

// handleTKO は切断プレイヤーの TKO 処理を行う
func (r *GameRoom) handleTKO(disconnIdx int) {
	remainingIdx := 1 - disconnIdx
	winner := r.players[remainingIdx]
	if winner == nil {
		return
	}

	winner.gnuBalance += tkoBonus

	winner.send(WSMessage{
		Type: "ev_tko",
		Payload: map[string]any{
			"message":        "対戦相手が切断しました。TKO勝利です！",
			"tko_bonus":      tkoBonus,
			"your_final_gnu": winner.gnuBalance,
		},
	})

	// 両プレイヤーの gnu_balance を DB 更新
	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for _, p := range r.players {
		if p == nil {
			continue
		}
		if err := r.userRepo.UpdateGnuBalance(dbCtx, p.user.ID, p.gnuBalance); err != nil {
			log.Printf("game room %s: TKO: failed to update gnu_balance for %s: %v",
				r.id, p.user.GitHubLogin, err)
		}
	}

	log.Printf("game room %s: TKO. winner=%s (+%d gnu)", r.id, winner.user.GitHubLogin, tkoBonus)
}

// notifyOpponentDisconnect は相手プレイヤーに切断を通知する（ゲーム開始前）
func (r *GameRoom) notifyOpponentDisconnect(disconnIdx int) {
	opp := r.players[1-disconnIdx]
	if opp == nil {
		return
	}
	opp.send(WSMessage{
		Type: "ev_error",
		Payload: map[string]any{
			"code":    "opponent_disconnected",
			"message": "対戦相手が切断しました",
		},
	})
}

// sendBothError は両プレイヤーにエラーを送信する
func (r *GameRoom) sendBothError(code, message string) {
	for _, p := range r.players {
		if p != nil {
			p.send(WSMessage{
				Type: "ev_error",
				Payload: map[string]any{
					"code":    code,
					"message": message,
				},
			})
		}
	}
}
