# マッチング機能実装計画（Issue #21）

## Context

現在のプロジェクトはログイン画面のみ実装済み。Issue #21 では「マッチングキューに登録 → 2人揃ったらマッチ成立 → ルーム作成 → ルームページに遷移」の一連のフローを、フロントエンド・バックエンド両方で実装する。既存ドキュメント（`docs/API_SCHEMA.md`, `docs/ARCHITECTURE.md`）の設計に準拠する。

---

## Walkthrough（全体フロー）

```
1. ユーザーがGitHubでログイン（実装済み）
2. ログイン後、ロビー画面（/lobby）へ遷移
3. 「対戦を探す」ボタンを押す
4. フロントが ws://localhost:8080/ws/matchmake?user_id={uuid} に接続
5. バックエンドが Redis の matchmaking:queue に RPUSH
6. Hub goroutine がキューを監視、2人揃ったら LPOP×2
7. Room UUID 生成、Redis に room:{id}:state を HSET、PostgreSQL に rooms INSERT
8. 両プレイヤーに ev_match_found（room_id, 対戦相手情報）を送信
9. フロントが /room/{roomId} に遷移
10. ルームページで ws://localhost:8080/ws/room/{room_id} に接続（ゲーム本体は今後実装）
```

---

## 実装内容

### Phase 1: バックエンド — エンティティ・インターフェース定義

**新規作成:**

| ファイル                                                       | 責務                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `backend/internal/domain/entity/room.go`                       | Room エンティティ（ID, Player1ID, Player2ID, Status, CreatedAt, UpdatedAt） |
| `backend/internal/domain/repository/matchmaking_repository.go` | マッチングキュー操作インターフェース（Enqueue, Dequeue, Remove, IsActive）  |
| `backend/internal/domain/repository/room_repository.go`        | ルーム操作インターフェース（Create, GetByID）                               |

**既存参照:** `backend/internal/domain/repository/user_repository.go` のパターンに従う

### Phase 2: バックエンド — DB マイグレーション・sqlc

**新規作成:**

| ファイル                                     | 内容                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `backend/db/migrations/002_create_rooms.sql` | rooms テーブル（id, player1_id, player2_id, status, created_at, updated_at） |
| `backend/db/queries/rooms.sql`               | CreateRoom, GetRoomByID, UpdateRoomStatus クエリ                             |

`docs/API_SCHEMA.md` に定義済みの `match_histories` テーブルはゲーム完了時に使うため、この Issue では rooms テーブルのみ作成。

実行: `cd backend/db && sqlc generate`

### Phase 3: バックエンド — リポジトリ実装

**新規作成:**

| ファイル                                                                | 責務                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `backend/internal/infrastructure/persistence/matchmaking_repository.go` | Redis でキュー操作（RPUSH, LPOP, LREM, SETNX で重複防止） |
| `backend/internal/infrastructure/persistence/room_repository.go`        | Redis（HSET/HGETALL）+ PostgreSQL（sqlc）でルーム管理     |

**Redis キー設計（`docs/API_SCHEMA.md` 準拠）:**

| キー                           | 型     | 用途                                       |
| ------------------------------ | ------ | ------------------------------------------ |
| `matchmaking:queue`            | List   | 待機ユーザーID のFIFOキュー                |
| `matchmaking:active:{user_id}` | String | 重複登録防止フラグ（TTL 300秒）            |
| `room:{room_id}:state`         | Hash   | player1_id, player2_id, status, created_at |

### Phase 4: バックエンド — ユースケース・Hub・ハンドラ

**新規作成:**

| ファイル                                          | 責務                                                            |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `backend/internal/usecase/matchmaking_usecase.go` | Enqueue（重複チェック付き）, Dequeue, Cancel のビジネスロジック |
| `backend/internal/handler/matchmaking_hub.go`     | 接続マップ管理（sync.RWMutex）+ マッチングループ goroutine      |

**変更:**

| ファイル                                           | 変更内容                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `backend/internal/handler/ws_matchmake_handler.go` | エコーバック削除 → Hub への登録、ev_match_found/ev_queue_joined/ev_error 送信、キャンセル・切断処理 |
| `backend/internal/handler/router.go`               | NewRouter の引数に Hub を追加（必要なら）                                                           |
| `backend/cmd/server/main.go`                       | Redis クライアントを各リポジトリに注入、Hub 生成・goroutine 起動、MatchmakeHandler に依存注入       |

**WebSocket メッセージプロトコル（`docs/API_SCHEMA.md` 準拠）:**

Server → Client:

```json
{"type": "ev_queue_joined", "payload": {"message": "マッチング待機中..."}}
{"type": "ev_match_found", "payload": {"room_id": "uuid", "opponent": {"id": "uuid", "github_login": "name", "rate": 1500}}}
{"type": "ev_error", "payload": {"code": "already_in_queue", "message": "..."}}
```

Client → Server:

```json
{ "type": "act_cancel_matchmaking" }
```

**Hub のマッチングループ:**

1. `matchmaking:queue` の LLEN を確認
2. 2人以上なら LPOP×2（2回目が nil なら1人目を RPUSH で戻す）
3. Room UUID 生成 → Redis に state 保存 → PostgreSQL に INSERT
4. 両プレイヤーの WebSocket 接続に `ev_match_found` 送信
5. 接続マップから削除
6. 2人未満なら 500ms スリープ

### Phase 5: フロントエンド — ユーティリティ・フック

**新規作成:**

| ファイル                             | 責務                                                            |
| ------------------------------------ | --------------------------------------------------------------- |
| `frontend/src/lib/ws.ts`             | WebSocket URL 生成（`NEXT_PUBLIC_WS_URL` 環境変数ベース）       |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket カスタムフック（接続/切断/メッセージ送受信/状態管理） |

### Phase 6: フロントエンド — ロビーページ

**新規作成:**

| ファイル                                      | 責務                                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/app/lobby/page.tsx`             | ロビーページ（Server Component）。認証チェック → 未認証なら `/` にリダイレクト                                                               |
| `frontend/src/app/lobby/MatchmakingPanel.tsx` | マッチング操作（Client Component）。「対戦を探す」ボタン → WS接続 → 待機アニメーション → `ev_match_found` で `/room/{roomId}` に router.push |

### Phase 7: フロントエンド — ルームページ

**新規作成:**

| ファイル                                      | 責務                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `frontend/src/app/room/[roomId]/page.tsx`     | ルームページ（Server Component）。roomId をパスパラメータから取得                               |
| `frontend/src/app/room/[roomId]/GameRoom.tsx` | ルーム Client Component。`/ws/room/{roomId}` に接続し、接続確認のみ（ゲームロジックは別 Issue） |

### Phase 8: フロントエンド — 既存ページ修正

**変更:**

| ファイル                                  | 変更内容                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `frontend/src/components/AuthButtons.tsx` | ログイン済み時に「ロビーへ」ボタンを追加（Link で `/lobby` へ遷移） |
| `frontend/src/app/page.tsx`               | 変更なし（AuthButtons 経由で遷移）                                  |

---

## 切断・エラー処理

- **マッチング待機中の切断**: Hub が Close 検知 → Redis キューから LREM + active フラグ DEL
- **重複登録**: `matchmaking:active:{user_id}` の SETNX で防止、既にあれば `ev_error` 返却
- **Hub goroutine**: `context.Context` で制御、サーバーシャットダウン時にキャンセル
- **LPOP の片方 nil**: 取り出した1人を RPUSH で戻す
- **フロント接続エラー**: エラーメッセージ表示 + 「再試行」ボタン（自動再接続はしない）

---

## 検証方法

1. `devbox shell` で PostgreSQL / Redis を起動
2. `devbox run db:setup` でマイグレーション適用（002_create_rooms.sql）
3. `cd backend/db && sqlc generate` で Go コード再生成
4. `devbox run backend:dev` でバックエンドを起動
5. `devbox run frontend:dev` でフロントエンドを起動
6. ブラウザ2つ（またはシークレットウィンドウ）でそれぞれ GitHub ログイン
7. 両方でロビー画面から「対戦を探す」をクリック
8. マッチング成立 → 両方が `/room/{roomId}` に遷移することを確認
9. `wscat` 等で `/ws/matchmake` に直接接続してメッセージを確認することも可能
