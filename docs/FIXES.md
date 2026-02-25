# FIXES

この会話で対応したコードレビュー指摘の修正まとめ。

---

## 1. Markdownフェンスブロックへの言語指定追加

**対象ファイル:** `docs/GAMELOGIC_GAMELOOP.md`

言語指定なしのコードフェンス（MD040 警告）6箇所に `text` を付与した。

| 行 | 内容 |
|----|------|
| 22 | アーキテクチャ図 |
| 71 | マッチングシーケンス図 |
| 110 | ゲームルームシーケンス図 |
| 157 | goroutine 構成図 |
| 185 | ターンループ手順 |
| 198 | ポイント計算式 |

---

## 2. エンドポイント一覧への `start-bot-match` 追記

**対象ファイル:** `docs/GAMELOGIC_GAMELOOP.md`

ルーターに実装済みだったが表に未記載だった開発用エンドポイントを追記した。

```
POST /api/dev/start-bot-match  (開発環境のみ)  DevHandler.StartBotMatch
```

---

## 3. `/api/v1/users/me` の認可バイパス修正

**対象ファイル:**
- `backend/internal/handler/auth_middleware.go`（新規作成）
- `backend/internal/handler/user_handler.go`
- `backend/internal/handler/router.go`
- `frontend/src/app/lobby/page.tsx`

**問題:** `?github_login=xxx` クエリパラメータを無検証で信頼していたため、任意のユーザー名を指定して他ユーザー情報を取得できる認可バイパスが存在した。

**修正内容:**
- `GitHubAuthMiddleware` を新規作成。`Authorization: Bearer <token>` を受け取り、GitHub API (`/user`) でトークンを検証して `github_login` をコンテキストにセットする。
- `GetMe` ハンドラを `c.QueryParam` から `c.Get("github_login")` に変更。
- `/api/v1/users/me` ルートに `GitHubAuthMiddleware` を適用。
- フロントエンドのリクエストを `?github_login=...` から `Authorization: Bearer <accessToken>` ヘッダーに変更。

---

## 4. マッチ成立通知の無言破棄修正

**対象ファイル:** `backend/internal/handler/matchmaking_hub.go`

**問題:** Bot サブスクライバへの通知で `default:` を使っていたため、goroutine 起動から `<-matchCh` 到達までの間にマッチが確定すると通知が無言で破棄され、Bot が接続できない状態になっていた。

**修正内容:** `default:` を `case <-time.After(200 * time.Millisecond):` に変更し、最大 200ms 待機後にドロップした場合はログを出力するようにした。

---

## 5. `getOrCreateTestBot` の同時作成競合対策

**対象ファイル:** `backend/internal/handler/dev_handler.go`

**問題:** 並列リクエスト時に両方が `sql.ErrNoRows` を受けて `Create` を試みると、片方が一意制約エラーで 500 を返していた。

**修正内容:** `Create` 失敗時に `GetByGitHubLogin` で再取得を試み、取得できれば既存ユーザーを返すフォールバックを追加した。

---

## 6. Bot の Origin 環境変数化

**対象ファイル:** `backend/internal/handler/bot_player.go`

**問題:** WebSocket 接続時の `Origin` ヘッダーが `http://localhost:3000` 固定だったため、`ALLOWED_ORIGINS` が別値の環境では Bot のハンドシェイクが常に失敗していた。

**修正内容:** `BOT_ORIGIN` 環境変数を参照し、未設定時のみ `http://localhost:3000` をデフォルトとして使うように変更した。

---

## 7. Go lint エラー修正

### 7-1. `errcheck` — `conn.Close` の戻り値未チェック

**対象ファイル:** `backend/internal/handler/bot_player.go`

`defer conn.Close()` を `defer func() { if err := conn.Close(); ... }()` に変更し、エラーをログ出力するようにした。

### 7-2. `gofmt` — マップリテラルの余分なスペース

**対象ファイル:** `backend/internal/handler/bot_player.go`

`"my_questions":  botQuestions[:2]` など、キーと値の間に余分なスペースが混在していたものを `gofmt` 準拠に修正した。

### 7-3. `unused` — 未使用型 `matchNotify`

**対象ファイル:** `backend/internal/handler/matchmaking_hub.go`

実際には `matchSubs map[uuid.UUID]chan<- *usecase.MatchmakingResult` で直接チャネルを管理しており不要になっていた `matchNotify` 型を削除した。

---

## 8. フロントエンド lint 警告修正 (oxlint)

### 8-1. `exhaustive-deps` — `useCallback` の依存配列に `close` が欠落

**対象ファイル:** `frontend/src/app/lobby/MatchmakingPanel.tsx`

`handleMessage` が `useWebSocket` より前に定義されており、`close()` を deps に追加すると循環依存になる構造だった。`ev_match_found` 受信後は `router.push` でページ遷移するため WebSocket は自動クリーンアップされることから、`handleMessage` 内の `close()` 呼び出しを削除して解消した。

### 8-2. a11y 警告 — クリック可能な非インタラクティブ要素

**対象ファイル:** `frontend/src/components/RepoManager.tsx`

リポジトリ展開ヘッダー (`div`) にクリックハンドラがあり、`click-events-have-key-events` / `no-static-element-interactions` / `prefer-tag-over-role` の警告が出ていた。内側に `<button>` をネストしているため `<button>` への置き換えは不可で、`{/* oxlint-disable-next-line ... */}` で抑制しつつ `onKeyDown` を追加してキーボード操作にも対応した。

ローディング中のプログレスバー `div`（`onClick={(e) => e.stopPropagation()}`）には `role="presentation"` と `onKeyDown` を追加した。
