# バックエンド実装詳細ドキュメント

Epic 5（バトルシステム・ゲームループ）を中心に、実装済みバックエンドの全体像を解説する。

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [エンドポイント一覧](#2-エンドポイント一覧)
3. [マッチングフロー（Epic 4）](#3-マッチングフロー-epic-4)
4. [ゲームルームフロー（Epic 5）](#4-ゲームルームフロー-epic-5)
5. [WebSocket イベント・アクション一覧](#5-websocket-イベントアクション一覧)
6. [エラー処理カタログ](#6-エラー処理カタログ)
7. [定数・パラメータ](#7-定数パラメータ)
8. [データ構造](#8-データ構造)

---

## 1. アーキテクチャ概要

```
フロントエンド (Next.js)
       │
       │ WebSocket / HTTP
       ▼
 Echo (Go HTTP/WS サーバー)
  ├─ /api/v1/users/me         ← REST
  ├─ /ws/matchmake            ← マッチング待機
  └─ /ws/room/:room_id        ← ゲームルーム
       │
  ┌────┴──────────────────┐
  │ MatchmakingUsecase    │  Redis キュー操作
  │ RoomManager           │  GameRoom 管理 (in-memory)
  └────────────────────────┘
       │
  ┌────┴──────────────────┐
  │ PostgreSQL            │  users, rooms テーブル
  │ Redis                 │  マッチングキュー + active フラグ
  └────────────────────────┘
```

### レイヤー構成

| レイヤー | パッケージ | 役割 |
|----------|-----------|------|
| Handler | `internal/handler` | HTTP/WS リクエスト受付、プロトコル変換 |
| Usecase | `internal/usecase` | ビジネスロジック（マッチング） |
| Domain | `internal/domain` | エンティティ定義・バリデーション |
| Infrastructure | `internal/infrastructure` | DB/Redis アクセス実装 |

---

## 2. エンドポイント一覧

| メソッド | パス | 種別 | ハンドラ |
|---------|------|------|---------|
| GET | `/api/v1/users/me` | REST | `UserHandler.GetMe` |
| GET | `/ws/matchmake` | WebSocket | `MatchmakeHandler.HandleMatchmake` |
| GET | `/ws/room/:room_id` | WebSocket | `RoomHandler.HandleRoom` |
| POST | `/api/dev/enqueue-test-user` | REST (開発環境のみ) | `DevHandler.EnqueueTestUser` |

WebSocket アップグレードは `gorilla/websocket` の `upgrader` で共通化されており、Origin チェックあり（後述）。

---

## 3. マッチングフロー (Epic 4)

### 3-1. 接続からキュー参加まで

```
クライアント                      サーバー
    │                               │
    │ GET /ws/matchmake             │
    │ ?github_login=xxx             │
    │ &github_id=yyy                │
    ├──────────────────────────────►│
    │                               │ ① github_login でユーザー検索
    │                               │   → 未登録なら github_id で自動作成
    │                               │ ② WebSocket アップグレード
    │                               │ ③ JoinQueue (Redis)
    │                               │   → SetActive (NX) で重複防止
    │                               │   → Enqueue (LIST RPUSH)
    │◄──────────────────────────────│ ev_queue_joined
    │                               │
    │   (待機中)                     │ Hub.Run が 500ms ごとに
    │                               │ TryMatch を実行
    │◄──────────────────────────────│ ev_match_found (マッチ成立時)
    │                               │   → room_id と opponent 情報を送信
```

**Hub.Run の動作**
- `time.Ticker` で 500ms ごとに `TryMatch` を呼ぶ
- `TryMatch` は Redis キューから2名 `Dequeue` し、DB にルームを作成
- 両プレイヤーそれぞれに `ev_match_found` を送信

### 3-2. キャンセル・切断

| トリガー | 処理 |
|---------|------|
| クライアントが `act_cancel_matchmaking` 送信 | `Hub.Unregister` → `LeaveQueue` |
| WebSocket 切断 | `defer h.hub.Unregister(userID)` により同上 |

---

## 4. ゲームルームフロー (Epic 5)

### 全体シーケンス

```
P0                          サーバー                         P1
 │                             │                              │
 │ GET /ws/room/:id?...        │   GET /ws/room/:id?...       │
 ├────────────────────────────►│◄─────────────────────────────┤
 │                             │ join() × 2                   │
 │                             │ P0 参加時: room を新規作成    │
 │                             │ P1 参加時: startCh を close  │
 │                             │ ↓ run() goroutine 開始 (P0)  │
 │◄────────────────────────────│─────────────────────────────►│
 │         ev_room_ready       │         ev_room_ready        │
 │                             │                              │
 │ act_submit_questions ───────►                              │
 │                             │◄──────── act_submit_questions│
 │                             │ 両問題揃ったらターン開始      │
 │                             │                              │
 │       ── ターン 1〜4 ──     │                              │
 │◄────────────────────────────│─────────────────────────────►│
 │         ev_turn_start       │         ev_turn_start        │
 │                             │                              │
 │ act_bet_gnu (任意) ─────────►                              │
 │ act_submit_answer ──────────►                              │
 │                             │◄──────────── act_bet_gnu     │
 │                             │◄────────── act_submit_answer │
 │                             │                              │
 │◄────────────────────────────│─────────────────────────────►│
 │        ev_turn_result       │        ev_turn_result        │
 │                             │                              │
 │       (4ターン完了後)        │                              │
 │◄────────────────────────────│─────────────────────────────►│
 │         ev_game_end         │         ev_game_end          │
 │                             │ DB: gnu_balance 更新          │
```

### 4-1. 接続・ユーザー解決 (`ws_room_handler.go`)

1. `room_id` を UUID としてパース
2. `github_login` クエリパラメータを必須チェック
3. `GetOrCreateUser` でユーザー取得/自動作成
4. WebSocket アップグレード
5. `RoomManager.Join` でルームに参加（idx 取得）
6. `idx == 0` のプレイヤーが `room.run()` goroutine を起動
7. `room.startReaderLoop(idx)` を goroutine で起動
8. `<-doneCh` でハンドラをブロック（切断まで HTTP レスポンスを維持）

### 4-2. GameRoom の goroutine 構成

```
HandleRoom (goroutine per player)
    ├─ room.run()            ← ゲームループ (idx==0 が起動)
    └─ startReaderLoop(idx)  ← WS 読み取り専用
           └─ msgCh (バッファ 32) に転送
```

- `run()` は `msgCh` と `disconnCh` を `select` で待ち受けるシングルスレッドループ
- `startReaderLoop` は各プレイヤーごとに独立した goroutine
- 書き込みは `gamePlayerState.send()` が `writeMu` で mutex 保護

### 4-3. 問題受取フェーズ

- 両プレイヤーから `act_submit_questions` を受け取るまでループ
- タイムアウト: **60秒** (`questionWaitLimit`)
- 問題構造: `my_questions[2]`（自分が解く用）と `for_opponent[2]`（相手が解く用）

**ターン割り当て**

| ターン | P0 が解く問題 | P1 が解く問題 |
|-------|-------------|-------------|
| 1 | P1 の `for_opponent[0]`（Easy） | P0 の `for_opponent[0]`（Easy） |
| 2 | P0 の `my_questions[0]`（Easy） | P1 の `my_questions[0]`（Easy） |
| 3 | P1 の `for_opponent[1]`（Normal） | P0 の `for_opponent[1]`（Normal） |
| 4 | P0 の `my_questions[1]`（Hard） | P1 の `my_questions[1]`（Hard） |

### 4-4. ターンループ（4回繰り返し）

```
1. ev_turn_start 送信（各プレイヤーに自分の問題と gnu_balance を通知）
2. 15秒タイマー開始
3. メッセージ受付ループ:
   - act_bet_gnu    → ベット額をセット (回答前のみ有効)
   - act_submit_answer → 回答を記録
   - 両者回答済み or タイムアウト → ループ脱出
4. ターン結果計算（ポイント加減算）
5. ev_turn_result 送信
```

### 4-5. ポイント計算ロジック

```
正解時: earned = baseGnuPerCorrect(100) + bet
不正解時: loss = bet  (gnu_balance が 0 未満になる場合は 0 に切り捨て)
```

- `gnuDeltas[i]` = そのターンの増減額
- `totalGnuEarned[i]` = 試合全体の累計増減
- `correctCounts[i]` = 正解数

### 4-6. 勝敗判定

1. 正解数が多い方が勝ち
2. 正解数が同じ場合は `totalGnuEarned` 合計が多い方が勝ち
3. どちらも同じ場合は引き分け（`result = "draw"`）

### 4-7. ゲーム終了処理

1. `ev_game_end` を両プレイヤーに送信
2. DB 更新: 各プレイヤーの `gnu_balance` を `UpdateGnuBalance` で保存
   - タイムアウト: **10秒** (`context.WithTimeout`)
   - DB 更新失敗はログのみ（ゲームは終了済みとして処理続行）

### 4-8. TKO 処理（切断時）

ターン中にプレイヤーが切断した場合:

1. `disconnCh` に切断プレイヤーの idx を送信
2. `handleTKO` が呼ばれる
3. 残存プレイヤーに `tkoBonus`（300 gnu）を付与
4. `ev_tko` を残存プレイヤーに送信
5. 両プレイヤーの `gnu_balance` を DB 更新

ゲーム開始前（問題フェーズ含む）に切断した場合:
- `notifyOpponentDisconnect` で相手に `ev_error` (code: `opponent_disconnected`) を送信

---

## 5. WebSocket イベント・アクション一覧

### サーバー → クライアント（イベント）

| type | フェーズ | ペイロード概要 |
|------|---------|--------------|
| `ev_queue_joined` | マッチング待機 | `message` |
| `ev_match_found` | マッチング成立 | `room_id`, `opponent.{id, github_login, rate}` |
| `ev_room_ready` | ルーム参加完了 | `your_gnu_balance`, `opponent.{id, github_login, rate, gnu_balance}` |
| `ev_turn_start` | 各ターン開始 | `turn`, `total_turns`, `difficulty`, `question_text`, `choices`, `time_limit_sec`, `your_gnu_balance`, `min_bet`, `max_bet` |
| `ev_bet_confirmed` | ベット確定 | `amount`, `min_bet`, `max_bet` |
| `ev_turn_result` | ターン結果 | `turn`, `correct_answer`, `correct_index`, `your_answer`, `is_correct`, `tips`, `gnu_delta`, `your_gnu_balance`, `opponent_is_correct`, `opponent_gnu_delta` |
| `ev_game_end` | ゲーム終了 | `result(win/lose/draw)`, `your_correct_count`, `opponent_correct_count`, `your_final_gnu`, `opponent_final_gnu`, `gnu_earned_this_game` |
| `ev_tko` | TKO勝利 | `message`, `tko_bonus`, `your_final_gnu` |
| `ev_error` | 各種エラー | `code`, `message`（+ エラー固有フィールド） |

### クライアント → サーバー（アクション）

| type | フェーズ | ペイロード | 制約 |
|------|---------|-----------|------|
| `act_cancel_matchmaking` | マッチング待機 | なし | — |
| `act_submit_questions` | 問題フェーズ | `my_questions[2]`, `for_opponent[2]` | 1回のみ有効 |
| `act_bet_gnu` | 各ターン | `amount: int` | 回答前のみ変更可能 |
| `act_submit_answer` | 各ターン | `choice_index: int`, `time_ms: int` | 二重回答は無視 |

---

## 6. エラー処理カタログ

### HTTP エラー（WebSocket アップグレード前）

| 条件 | HTTPステータス | メッセージ |
|------|--------------|-----------|
| `room_id` が UUID として不正 | 400 | `"invalid room_id"` |
| `github_login` が空 | 400 | `"github_login is required"` |
| `github_id` が整数としてパース不可 | 400 | `"invalid github_id"` |
| ユーザー取得/作成で DB エラー | 500 | `"failed to get or create user"` |
| ユーザー検索失敗 (matchmake) | 500 | `"failed to get user"` |
| ユーザー作成失敗 (matchmake) | 500 | `"failed to create user"` |
| Origin ヘッダーが許可リスト外 | WebSocket 拒否 | — |

### WebSocket ev_error（接続後）

| `code` | 発生タイミング | 説明 |
|--------|-------------|------|
| `join_failed` | ルーム参加時 | ルームが満員（3人目以降の接続） |
| `already_in_queue` | マッチング参加時 | 既にキューに入っている |
| `queue_error` | マッチング参加時 | Redis への Enqueue 失敗 |
| `server_busy` | ターン中メッセージ送信 | `msgCh` バッファ(32)が満杯でメッセージをドロップ |
| `invalid_bet` | `act_bet_gnu` 処理 | `amount < minBet(0)` または `amount > gnuBalance` |
| `invalid_questions` | `act_submit_questions` 処理 | 問題数不足 or `Question.Validate()` 失敗 |
| `question_timeout` | 問題フェーズ | 60秒以内に両プレイヤーの問題が揃わない |
| `opponent_disconnected` | ゲーム開始前の切断 | 相手がルーム参加前または問題フェーズ中に切断 |

### Question.Validate() のバリデーション

`entity.Question` は `act_submit_questions` 受信時にバリデーションされる。

| 条件 | エラーメッセージ |
|------|---------------|
| `len(choices) != 4` | `"question must have exactly 4 choices"` |
| `correct_answer` が `choices` に含まれない | `"correct_answer must be one of the choices"` |

### DB 更新エラー

| 箇所 | 処理 | ゲームへの影響 |
|------|------|-------------|
| `UpdateGnuBalance`（ゲーム終了時） | ログ出力のみ | ゲームは正常終了済み、次回ログイン時に不整合が残る |
| `UpdateGnuBalance`（TKO時） | ログ出力のみ | 同上 |

### マッチングエラー時のリカバリ

`TryMatch` でデキュー成功後にエラーが発生した場合:

1. `requeueBoth()` → 両プレイヤーをキューに再投入
2. `clearBoth()` → active フラグをクリア
3. 次の 500ms 周期で再マッチング試行

| 失敗箇所 | リカバリ動作 |
|---------|------------|
| `GetByID` (player1) | requeueBoth + clearBoth |
| `GetByID` (player2) | requeueBoth + clearBoth |
| `roomRepo.Create` | requeueBoth + clearBoth |
| `Enqueue` (JoinQueue 内) | `ClearActive` でフラグのみ削除（キューには未追加） |

### WebSocket 切断検出

`startReaderLoop` 内で `ReadMessage` がエラーを返した時:
- `websocket.IsUnexpectedCloseError` で異常切断か否かを判別してログ出力
- `CloseGoingAway` / `CloseNormalClosure` は正常切断として静かに終了
- どちらの場合も `doneCh` を close し `disconnCh` にインデックスを送信

---

## 7. 定数・パラメータ

| 定数名 | 値 | 説明 |
|-------|----|------|
| `turnDuration` | 15秒 | 1ターンの回答制限時間 |
| `questionWaitLimit` | 60秒 | 問題受取フェーズのタイムアウト |
| `baseGnuPerCorrect` | 100 | 正解時の基本獲得 GNU |
| `tkoBonus` | 300 | TKO 勝利ボーナス |
| `minBet` | 0 | ベット最小値（ノーリスク可） |
| `NumChoices` | 4 | 選択肢数 |
| Hub ポーリング間隔 | 500ms | マッチング試行の周期 |
| `msgCh` バッファサイズ | 32 | 同時受信メッセージ最大数 |
| `disconnCh` バッファサイズ | 2 | 切断通知チャネルのバッファ |

---

## 8. データ構造

### entity.User

```go
type User struct {
    ID             uuid.UUID
    GitHubID       int64
    GitHubLogin    string
    GnuBalance     int       // ゲーム中はメモリ上で管理、終了時に DB 永続化
    Rate           int
    EncryptedToken string    // JSON 非出力
    CreatedAt      time.Time
    UpdatedAt      time.Time
}
```

### entity.Question

```go
type Question struct {
    Difficulty    string   // "easy" / "normal" / "hard"
    QuestionText  string
    CorrectAnswer string   // choices のいずれかと一致必須
    Tips          string   // ターン結果時に表示
    Choices       []string // 必ず4要素
}
```

### entity.Room

```go
type Room struct {
    ID        uuid.UUID
    Player1ID uuid.UUID
    Player2ID uuid.UUID
    Status    RoomStatus  // "waiting" | "in_progress" | "finished"
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

### gamePlayerState（in-memory のみ）

```go
type gamePlayerState struct {
    user       *entity.User
    conn       *websocket.Conn
    questions  *QuestionSet  // act_submit_questions で設定
    gnuBalance int           // ゲーム開始時に user.GnuBalance をコピー
    doneCh     chan struct{}  // 読み取りループ終了時に close
    writeMu    sync.Mutex    // 書き込みの排他制御
}
```

### QuestionSet（フロントエンドから受信）

```go
type QuestionSet struct {
    MyQuestions []entity.Question // [0]=Easy, [1]=Hard  (自分用)
    ForOpponent []entity.Question // [0]=Easy, [1]=Normal (相手用)
}
```

---

## 補足: Origin チェック

WebSocket アップグレード時に `ALLOWED_ORIGINS` 環境変数（カンマ区切り）でホワイトリストを管理。未設定時のデフォルトは `http://localhost:3000`。許可外の Origin からの接続は upgrader がアップグレードを拒否しログを出力する。

## 補足: ユーザー自動作成の競合処理

`GetOrCreateUser`（RoomManager）では、`Create` 時に PostgreSQL UNIQUE 制約違反（エラーコード `23505`）が発生した場合、同時リクエストによる競合と判断して `GetByGitHubLogin` を再度呼び出して既存レコードを返す。これにより複数タブ・再接続時の整合性を保つ。
