# Epic 5 実装概要

## 概要

Epic 5「バトルシステム・ゲームループ」のバックエンド実装を完了した。
Go の goroutine / channel / select を使ったリアルタイム対戦ゲームループが動作する状態になっている。

lint 修正・開発環境設定を実施した。
また、wscat を使った2プレイヤー手動対戦により全 Issue の動作確認済み。

---

## 実装済み Issue

| Issue | 内容 | 状態 |
|---|---|---|
| 5-1 | ゲームルームと進行ループ (Go select & channel) | ✅ |
| 5-2 | ターン開始・出題イベント (ev_turn_start) | ✅ |
| 5-3 | ベット処理 (act_bet_gnu) | ✅ |
| 5-4 | 回答受付・勝敗・ポイント計算 (act_submit_answer) | ✅ |
| 5-5 | ターン結果・Tips 送信 (ev_turn_result) | ✅ |
| 5-6 | 試合終了・リザルト処理 (ev_game_end) | ✅ |
| 5-7 | 切断時の TKO 処理 | ✅ |

---

## 作成・変更ファイル一覧

### 新規作成

| ファイル | 役割 |
|---|---|
| `backend/internal/domain/entity/question.go` | Question 型 + CorrectIndex() メソッド |
| `backend/internal/handler/game_room.go` | ゲームループ本体（主要ロジック） |
| `backend/internal/handler/room_manager.go` | ルームレジストリ |

### 変更

| ファイル | 変更内容 |
|---|---|
| `backend/cmd/server/main.go` | RoomManager・NewRoomHandler の DI 追加 |
| `backend/internal/handler/ws_room_handler.go` | フル実装（ユーザー取得・自動作成・ルーム接続・ゲームループ起動） |

---

## アーキテクチャ概要

```
ws_room_handler.go (HandleRoom)
        |
        v
RoomManager.Join()          ← ルームを getOrCreate して player を登録
        |
        v
GameRoom.join()             ← player[0] or player[1] としてセット
        |                      joined==2 で startCh を close
        |
        +-- go room.run()       ← player[0] の HTTP goroutine が起動（1回のみ）
        +-- go room.startReaderLoop(idx)  ← 各 player の HTTP goroutine が起動
        |
        v
<-doneCh                    ← 接続が閉じるまで HTTP goroutine をブロック
```

### GameRoom.run() フロー

```
1. <-startCh (両プレイヤー接続待ち)
2. ev_room_ready 送信
3. 問題受取フェーズ (60秒タイムアウト)
   - 両プレイヤーから act_submit_questions 待機
4. ターンループ (4回)
   a. ev_turn_start 送信（各プレイヤーに異なる問題）
   b. 15秒タイマー + select
      - act_bet_gnu  → ベット額を記録
      - act_submit_answer → 回答を記録、両者回答完了で即時終了
      - タイムアウト → 未回答は不正解扱い
      - 切断 → handleTKO
   c. ev_turn_result 送信
5. ev_game_end 送信
6. DB更新 (users.gnu_balance)
```

---

## WebSocket プロトコル

### Client → Server

| メッセージ型 | タイミング | ペイロード |
|---|---|---|
| `act_submit_questions` | ルーム接続後（ゲーム開始前） | `{my_questions: [Q, Q], for_opponent: [Q, Q]}` |
| `act_bet_gnu` | ターン中（回答前） | `{amount: int}` |
| `act_submit_answer` | ターン中 | `{choice_index: int, time_ms: int}` |

### Server → Client

| イベント型 | タイミング | ペイロード概要 |
|---|---|---|
| `ev_room_ready` | 両プレイヤー接続完了 | opponent 情報・自分の gnu_balance |
| `ev_turn_start` | 各ターン開始 | 問題文・選択肢・難易度・制限時間 |
| `ev_turn_result` | ターン終了 | 正解・tips・gnu 増減・双方の is_correct |
| `ev_game_end` | 4ターン終了後 | 勝敗・正解数・最終 gnu_balance |
| `ev_tko` | 対戦相手切断時 | TKO ボーナス (+300 Gnu)・最終残高 |
| `ev_error` | 各種エラー | code・message |

### act_submit_questions ペイロード詳細

```json
{
  "my_questions": [
    {"difficulty":"Easy", "question_text":"...", "choices":["A","B","C","D"], "correct_answer":"A", "tips":"..."},
    {"difficulty":"Hard", "question_text":"...", "choices":["A","B","C","D"], "correct_answer":"B", "tips":"..."}
  ],
  "for_opponent": [
    {"difficulty":"Easy", ...},
    {"difficulty":"Normal", ...}
  ]
}
```

---

## ターン構成（問題割り当て）

| ターン | Player A が解く問題 | Player B が解く問題 |
|---|---|---|
| 1 | B の for_opponent[0] (Easy, B's repo) | A の for_opponent[0] (Easy, A's repo) |
| 2 | A の my_questions[0] (Easy, A's repo) | B の my_questions[0] (Easy, B's repo) |
| 3 | B の for_opponent[1] (Normal, B's repo) | A の for_opponent[1] (Normal, A's repo) |
| 4 | A の my_questions[1] (Hard, A's repo) | B の my_questions[1] (Hard, B's repo) |

---

## スコア計算ロジック

```
正解: +100 Gnu + bet額
不正解: -bet額（bet=0なら変化なし）
TKO勝利: +300 Gnu ボーナス

勝敗判定:
  1. 正解数が多い方が勝ち
  2. 同点の場合: Gnu 獲得合計が多い方が勝ち
  3. それも同点: draw

試合終了時: users.gnu_balance を DB 更新（UpdateGnuBalance）
```

---

## 未実装・残課題

| 項目 | 内容 |
|---|---|
| `match_histories` テーブル保存 | 試合結果の永続化（現在は gnu_balance 更新のみ） |
| RoomRepository.UpdateStatus | ルームステータス (waiting → in_progress → finished) の DB 更新 |
| フロントエンド側実装 | Epic 6（バトル画面 UI 等） |
| Epic 2, 3 | ユーザー認証 API、LLM 問題生成エンジン |

---

## 動作確認済み（wscat による手動対戦）

フロントエンド（Epic 6）未実装の状態でも、wscat を使って全 Issue の動作を確認した。

### wscat とは

Node.js 製の WebSocket コマンドラインクライアント。インストール:

```bash
npm install -g wscat
```

接続コマンド例:
```bash
wscat -c "ws://localhost:8080/ws/matchmake?github_login=player1&github_id=1" -H "Origin: http://localhost:3000"
```

- `<` : サーバーから届いたメッセージ
- `>` : 自分が送信するメッセージ（プロンプトに入力して Enter）
- **注意**: `>` はシェルではなく WS 送信プロンプト。別コマンドを実行したい場合は新しいターミナルを開く

### 手動対戦の手順（ターミナル5本構成）

**T1: バックエンド起動**
```bash
devbox run backend:dev
```

**T2: player1 マッチング待機**
```bash
wscat -c "ws://localhost:8080/ws/matchmake?github_login=player1&github_id=1" -H "Origin: http://localhost:3000"
```

**T3: player2 マッチング待機**
```bash
wscat -c "ws://localhost:8080/ws/matchmake?github_login=player2&github_id=2" -H "Origin: http://localhost:3000"
```

→ T2・T3 両方に `ev_match_found` が届く。`room_id` をコピーする。

**T4: player1 ルーム接続**
```bash
wscat -c "ws://localhost:8080/ws/room/<room_id>?github_login=player1&github_id=1" -H "Origin: http://localhost:3000"
```

**T5: player2 ルーム接続**
```bash
wscat -c "ws://localhost:8080/ws/room/<room_id>?github_login=player2&github_id=2" -H "Origin: http://localhost:3000"
```

→ T4・T5 両方に `ev_room_ready` が届く。

**問題送信（T4・T5 両方）:**
```json
{"type":"act_submit_questions","payload":{"my_questions":[{"difficulty":"Easy","question_text":"Q1","choices":["A","B","C","D"],"correct_answer":"A","tips":"tip"},{"difficulty":"Hard","question_text":"Q2","choices":["A","B","C","D"],"correct_answer":"B","tips":"tip"}],"for_opponent":[{"difficulty":"Easy","question_text":"Q3","choices":["A","B","C","D"],"correct_answer":"C","tips":"tip"},{"difficulty":"Normal","question_text":"Q4","choices":["A","B","C","D"],"correct_answer":"D","tips":"tip"}]}}
```

**回答送信（T4・T5 両方、`ev_turn_start` ごとに4回）:**
```json
{"type":"act_submit_answer","payload":{"choice_index":0,"time_ms":3000}}
```

### 確認済みの動作結果

| 確認項目 | 結果 |
|---|---|
| `ev_room_ready` に opponent 情報・gnu_balance が含まれる | ✅ |
| `ev_turn_start` が4ターン、各プレイヤーに異なる問題で届く | ✅ |
| `ev_turn_result` に正解判定・gnu増減・相手の結果が含まれる | ✅ |
| タイムアウト時は `your_answer: -1`・不正解扱い | ✅ |
| 正解時に `gnu_delta: +100`・`your_gnu_balance` が増加 | ✅ |
| `ev_game_end` に勝敗・正解数・最終 gnu_balance が含まれる | ✅ |
| 勝者に `result: "win"`、敗者に `result: "lose"` が届く | ✅ |

### 注意事項

- `ev_room_ready` 受信後、**60秒以内**に `act_submit_questions` を送信しないとタイムアウトになる
- `ev_turn_start` 受信後、**15秒以内**に回答しないとタイムアウト（不正解扱い）
- Origin ヘッダーが必要: `-H "Origin: http://localhost:3000"` を必ず付ける

---

## 関連ドキュメント

- `docs/GAME_DESIGN.md` — ゲーム設計仕様
- `docs/API_SCHEMA.md` — WebSocket イベント・DB スキーマ
- `docs/ARCHITECTURE.md` — システム構成・処理フロー
- `docs/PROMPT.md` — LLM プロンプト設計（Epic 3 向け）
