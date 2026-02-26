# HANDOFF.md

## 概要

このmdは二人対戦のバックとフロントの実装で行った内容をまとめたものです。

---

## 1. 実装済み機能一覧

### Epic 4: マッチングシステム ✅

| Issue | 内容 | ファイル |
|-------|------|---------|
| 4-1 | WebSocket接続・マッチングキュー管理 | `handler/matchmaking_hub.go`, `handler/ws_matchmake_handler.go` |
| 4-2 | マッチング成立イベント送信 (`ev_match_found`) | `handler/matchmaking_hub.go` |

### Epic 5: バトルシステム・ゲームループ ✅

| Issue | 内容 | ファイル |
|-------|------|---------|
| 5-1 | ゲームルームと進行ループ | `handler/game_room.go`, `handler/room_manager.go` |
| 5-2 | ターン開始・出題イベント (`ev_turn_start`) | `handler/game_room.go` |
| 5-3 | ベット処理 (`act_bet_gnu`) | `handler/game_room.go` |
| 5-4 | 回答・勝敗・ポイント計算 (`act_submit_answer`) | `handler/game_room.go` |
| 5-5 | ターン結果・Tips送信 (`ev_turn_result`) | `handler/game_room.go` |
| 5-6 | 試合終了・リザルト処理 (`ev_game_end`) | `handler/game_room.go` |
| 5-7 | 切断時のTKO処理 (`ev_tko`) | `handler/game_room.go` |

### フロントエンド: ゲームUI ✅

| 画面 | 内容 | ファイル |
|------|------|---------|
| ゲームルーム | 全フェーズ対応のゲームUI | `app/room/[roomId]/GameRoom.tsx` |
| ゲームルームページ | 認証・セッション連携 | `app/room/[roomId]/page.tsx` |
| ロビー | マッチング待機・Bot対戦ボタン | `app/lobby/MatchmakingPanel.tsx` |
| WebSocket Hook | 重複接続防止・StrictMode対応 | `hooks/useWebSocket.ts` |

### フロントエンド: 問題準備フェーズUI ✅

| 内容 | ファイル |
|------|---------|
| Bot対戦時: `ev_room_ready` 受信後に固定ダミー問題を即時自動送信 | `app/room/[roomId]/GameRoom.tsx` |
| 通常対戦時: リポジトリ選択UI表示 → Geminiで問題生成 → `act_submit_questions` 送信 | `app/room/[roomId]/GameRoom.tsx` |
| `QuizQuestion`（Gemini形式）→ `BackendQuestion`（バックエンド形式）の変換 | `app/room/[roomId]/GameRoom.tsx` |

### フロントエンド: UX改善・バグ修正 ✅

| 内容 | ファイル |
|------|---------|
| `ev_match_found` 受信時に `close()` を呼んでからページ遷移（WS二重接続防止） | `app/lobby/MatchmakingPanel.tsx` |
| `preparing_questions` フェーズに60秒カウントダウンバー追加（残り30秒→黄、15秒→赤） | `app/room/[roomId]/GameRoom.tsx` |
| `waiting_room_ready` に「相手が問題を準備中...」メッセージ追加（通常対戦のみ） | `app/room/[roomId]/GameRoom.tsx` |

### バックエンド: `GET /api/v1/users/me` 実装

| 内容 | ファイル |
|------|---------|
| `GetMe` を `?github_login=` クエリパラメータでユーザー特定する方式に実装 | `handler/user_handler.go` |
| `UserUsecase.GetMeByGitHubLogin()` 追加 | `usecase/user_usecase.go` |

### フロントエンド: ロビー画面にGNU残高・レート表示 ✅

| 内容 | ファイル |
|------|---------|
| サーバーコンポーネントで `/api/v1/users/me` を呼び、ユーザーカードに🦬残高・★レートを表示 | `app/lobby/page.tsx` |

### Dev: Botテストプレイ機能 ✅

| 内容 | ファイル |
|------|---------|
| Bot自動プレイgoroutine | `handler/bot_player.go` |
| Bot起動エンドポイント | `handler/dev_handler.go` |
| マッチ通知チャネル | `handler/matchmaking_hub.go` |

---

## 2. アーキテクチャ

```
フロントエンド (Next.js / localhost:3000)
  │
  ├─ WS /ws/matchmake?github_login=&github_id=
  │    └─ MatchmakingPanel.tsx
  │
  └─ WS /ws/room/{roomId}?github_login=&github_id=
       └─ GameRoom.tsx
            │
            ├─ フェーズ: connecting
            │             → preparing_questions  ← 今回追加
            │             → waiting_room_ready
            │             → turn_start → answering
            │             → turn_result → game_end / tko / error
            └─ 送受信: useWebSocket.ts フック

バックエンド (Go/Echo / localhost:8080)
  │
  ├─ Hub.Run()  500ms ごとに TryMatch → ev_match_found
  ├─ RoomHandler.HandleRoom()
  │    └─ GameRoom.run()  ← goroutine (idx==0 が起動)
  │         ├─ 問題受取フェーズ (60秒タイムアウト)
  │         ├─ ターンループ×4
  │         │    ├─ ev_turn_start → act_bet_gnu → act_submit_answer
  │         │    └─ ev_turn_result
  │         └─ ev_game_end + DB更新 (gnu_balance)
  │
  └─ DevHandler (ENV=development のみ有効)
       ├─ POST /api/dev/enqueue-test-user
       └─ POST /api/dev/start-bot-match
            └─ RunBotPlayer goroutine (自動問題送信・回答)

PostgreSQL: users, rooms テーブル
Redis:      マッチングキュー (LIST), activeフラグ (SET NX)
```

---

## 3. WebSocket イベント仕様

### サーバー → クライアント

| type | 発生タイミング | 主なペイロード |
|------|-------------|--------------|
| `ev_queue_joined` | キュー参加時 | `message` |
| `ev_match_found` | マッチ成立 | `room_id`, `opponent.{id,github_login,rate}` |
| `ev_room_ready` | 両プレイヤー接続完了 | `your_gnu_balance`, `opponent.{id,github_login,rate,gnu_balance}` |
| `ev_turn_start` | 各ターン開始 | `turn`, `total_turns`, `difficulty`, `question_text`, `choices[]`, `time_limit_sec`, `your_gnu_balance`, `min_bet`, `max_bet` |
| `ev_bet_confirmed` | ベット確定 | `amount`, `min_bet`, `max_bet` |
| `ev_turn_result` | ターン終了 | `turn`, `correct_answer`, `correct_index`, `your_answer`, `is_correct`, `tips`, `gnu_delta`, `your_gnu_balance`, `opponent_is_correct`, `opponent_gnu_delta` |
| `ev_game_end` | ゲーム終了 | `result(win/lose/draw)`, `your_correct_count`, `opponent_correct_count`, `your_final_gnu`, `opponent_final_gnu`, `gnu_earned_this_game` |
| `ev_tko` | 相手切断によるTKO勝利 | `message`, `tko_bonus`, `your_final_gnu` |
| `ev_error` | 各種エラー | `code`, `message` |

### クライアント → サーバー

| type | フェーズ | ペイロード |
|------|---------|-----------|
| `act_cancel_matchmaking` | マッチング待機 | なし |
| `act_submit_questions` | ゲーム開始前 | `my_questions[2]`, `for_opponent[2]` |
| `act_bet_gnu` | 各ターン（回答前のみ） | `amount: int` |
| `act_submit_answer` | 各ターン（1回のみ有効） | `choice_index: int`, `time_ms: int` |

---

## 4. ゲームロジック詳細

### 問題割り当て（4ターン固定）

| ターン | P0 が解く | P1 が解く |
|-------|---------|---------|
| 1 | P1 の `for_opponent[0]`（Easy） | P0 の `for_opponent[0]`（Easy） |
| 2 | P0 の `my_questions[0]`（Easy） | P1 の `my_questions[0]`（Easy） |
| 3 | P1 の `for_opponent[1]`（Normal） | P0 の `for_opponent[1]`（Normal） |
| 4 | P0 の `my_questions[1]`（Hard） | P1 の `my_questions[1]`（Hard） |

### ポイント計算

```
正解: earned = 100(base) + bet  → gnu_balance += earned
不正解: loss = bet               → gnu_balance -= loss (最低 0)
```

### 勝敗判定

1. 正解数が多い方が勝ち
2. 同数の場合は `totalGnuEarned` 合計が多い方が勝ち
3. 両方同じ → 引き分け

### タイマー・制限

| 定数 | 値 |
|------|---|
| `turnDuration` | 15秒 |
| `questionWaitLimit` | 60秒 |
| `baseGnuPerCorrect` | 100 |
| `tkoBonus` | 300 |
| `minBet` | 0 |

---

## 5. ファイル構成（変更・追加したファイル）

```
backend/
├─ cmd/server/main.go                          ← NewDevHandler に hub を渡す修正
├─ internal/handler/
│   ├─ game_room.go                            ← ゲームループ全体（既存）
│   ├─ room_manager.go                         ← ルーム管理（既存）
│   ├─ ws_room_handler.go                      ← WS エンドポイント（既存）
│   ├─ matchmaking_hub.go                      ← SubscribeMatch/UnsubscribeMatch 追加
│   ├─ dev_handler.go                          ← StartBotMatch エンドポイント追加
│   ├─ bot_player.go                           ← 新規作成（Bot自動プレイ）
│   ├─ router.go                               ← /api/dev/start-bot-match 登録
│   └─ user_handler.go                         ← GetMe を ?github_login= クエリパラメータ方式に実装
└─ internal/usecase/
    └─ user_usecase.go                         ← GetMeByGitHubLogin() 追加

frontend/
├─ src/app/room/[roomId]/
│   ├─ page.tsx                                ← github_login/github_id をセッションから渡す修正
│   └─ GameRoom.tsx                            ← 問題準備フェーズUI・60秒カウントダウン・相手待ちメッセージ追加
├─ src/app/lobby/
│   ├─ MatchmakingPanel.tsx                    ← Bot対戦ボタン追加・ev_match_found時close()修正
│   └─ page.tsx                                ← GNU残高・レート表示追加
└─ src/hooks/useWebSocket.ts                   ← 重複接続防止・StrictMode対応

devbox.json                                    ← ENV=development 追加
docs/
├─ BACKEND.md                                  ← バックエンド実装詳細ドキュメント（新規）
└─ HANDOFF.md                                  ← このファイル
```

---

## 6. 開発環境・起動方法

```bash
# 初回セットアップ
devbox run setup

# バックエンド起動（ホットリロード）
devbox run backend:dev

# フロントエンド起動
devbox run frontend:dev
```

環境変数は `devbox.json` の `env` セクションで管理：

```json
{
  "env": {
    "PGDATA": "$HOME/.local/share/hackathon_nulabcup/postgresql/data",
    "PGHOST": "/tmp",
    "ENV": "development"
  }
}
```

フロントエンドの環境変数は `frontend/.env` で管理（GitHub OAuth, Gemini API Key）。

---

## 7. Bot テストプレイ手順

1. バックエンド・フロントエンドを起動
2. `/lobby` を開いてログイン状態を確認
3. **「🤖 DEV: Bot と対戦する」** ボタンをクリック（開発環境のみ表示）
4. 自動でマッチング成立 → `/room/{roomId}` に遷移
5. フロントが `ev_room_ready` を受信すると、相手が `test-bot` と判定して固定ダミー問題を即時送信
6. Bot が以下を自動実行:
   - ダミー問題4問を送信（Go・HTTP・Git 系の固定問題）
   - 各ターンで 0〜maxBet/5 のランダムベット
   - 2〜10秒後にランダム回答（正解率約25%）

**Bot のダミー問題（`for_opponent` として相手に出題される）**

| 難易度 | 問題 | 正解 |
|--------|------|------|
| easy | HTTP 404 が示すものは？ | Not Found |
| normal | Git で直前のコミットを修正するコマンドは？ | git commit --amend |

**フロント側のダミー問題（`BOT_DUMMY_QUESTIONS` / Bot対戦時のみ使用）**

| 難易度 | 役割 | 問題 |
|--------|------|------|
| easy | my_questions[0] | Next.js で「use client」を書く目的は？ |
| hard | my_questions[1] | Go の goroutine でデータ競合を防ぐ推奨手段は？ |
| easy | for_opponent[0] | HTTP 404 が示すものは？ |
| normal | for_opponent[1] | Git で直前のコミットを修正するコマンドは？ |

---

## 8. 二人対戦フローの現在の実装状況

### Bot対戦 ✅ 動作確認可能

```
ロビー「🤖 Bot と対戦」
  → /api/dev/start-bot-match (POST)
  → Bot がキュー参加 → マッチ成立
  → ev_room_ready 受信
      人間: BOT_DUMMY_QUESTIONS を即時送信 ✅
      Bot:  bot_player.go が固定問題を自動送信 ✅
  → ev_turn_start (×4ターン)
      人間: UIで回答
      Bot:  ランダム回答（2〜10秒後）
  → ev_game_end / ev_tko
```

### 通常（プレイヤー）対戦 ⚠️ 動作するが未完成

```
ロビー「⚔️ 対戦を探す」
  → マッチングキュー待機
  → マッチ成立
  → ev_room_ready 受信
      両プレイヤー: preparing_questions フェーズへ
        → DBのリポジトリ一覧を表示
        → リポジトリ選択 → Gemini で問題生成（数十秒）
        → act_submit_questions 送信（60秒タイムアウト以内に必要）
  → ev_turn_start (×4ターン)
      両プレイヤー: UIで回答
  → ev_game_end
```

---

## 9. 残りの実装タスク（優先度順）

### ✅ 実装済み（2026-02-25 完了）

| タスク | 対応内容 |
|--------|---------|
| ~~残タスク-1~~ WS二重接続 | `ev_match_found` 時に `close()` してから遷移 |
| ~~残タスク-2~~ 問題準備フェーズのカウントダウン | 60秒カウントダウンバーを追加 |
| ~~残タスク-3~~ `GET /api/v1/users/me` | `?github_login=` パラメータで実装 |
| ~~残タスク-4~~ ロビーのGNU残高・レート表示 | サーバーコンポーネントでAPIを叩き表示 |
| ~~残タスク-5~~ 相手待ち状態の明示 | `waiting_room_ready` に「相手が問題を準備中...」追加 |

### 🟢 低優先度（将来的な改善）

#### [残タスク-6] レーティング変動ロジック（バックエンド）
- **問題**: 勝敗による `rate` の更新ロジックが未実装。全ユーザーの `rate: 0` のまま
- **対処**: `ev_game_end` 処理内でElo等のレーティング計算を行い `UpdateRate` を実装する
- **ファイル**: `backend/internal/handler/game_room.go`, `backend/internal/domain/repository/user_repository.go`

#### [残タスク-7] GitHubアクセストークンの暗号化保存
- **問題**: `encrypted_token` カラムは存在するが暗号化未実装
- **ファイル**: 認証関連全般

#### [残タスク-8] ゲームループ中の `ev_error(question_timeout)` 受信時の画面遷移
- **問題**: `GameRoom.tsx` の `ev_error` ハンドラは `opponent_disconnected` のみ `error` フェーズに遷移し、`question_timeout` 等は `console.warn` のみでUIが固まる
- **対処**: `question_timeout` コードを受信したらエラーメッセージを出してロビーに戻る導線を出す
- **ファイル**: `frontend/src/app/room/[roomId]/GameRoom.tsx`

---

## 10. 既知の問題・注意点

### フロントエンド

- **StrictMode 二重実行**: React の開発モードでは `useEffect` が2回実行される。`useWebSocket.ts` で「既接続なら `connect()` を無視」する処理を入れているが、アンマウント→再マウントのタイミングによっては切断が起きる場合がある。本番ビルドでは問題なし。
- **`sendMessageRef` パターン**: `GameRoom.tsx` では `useWebSocket` の戻り値 `sendMessage` を `onMessage` コールバック内から参照する際、循環参照を避けるために `sendMessageRef.current = sendMessage` を使っている。この ref はレンダリングのたびに更新されるため常に最新の関数を指す。

### バックエンド

- **gnu_balance の DB 更新失敗**: ゲーム終了時の `UpdateGnuBalance` が失敗してもゲームは正常終了する。エラーはログのみ。不整合が残る可能性がある。
- **test-bot のキュー残留**: `start-bot-match` 失敗時にキューに残る場合がある。`ClearActive` でフラグは消えるが LPOP 済みなのでキューには残らない。

### 環境

- **`ENV=development`** が設定されていないと `/api/dev/*` のルートが登録されない。`devbox.json` に設定済みだが、devbox を再起動しないと反映されない場合がある。
- **`BOT_SERVER_ADDR`** 環境変数でBotの接続先を変更可能（デフォルト: `localhost:8080`）。
