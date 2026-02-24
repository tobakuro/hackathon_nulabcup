# API・スキーマ設計

## REST API エンドポイント

### 認証・ユーザー

| Method | Path               | 概要                                               |
| ------ | ------------------ | -------------------------------------------------- |
| GET    | `/api/v1/users/me` | ログインユーザーのプロフィール・ヌー・レートを返す |

## WebSocket エンドポイント

| Path                            | 概要                    |
| ------------------------------- | ----------------------- |
| `ws://{host}/ws/matchmake`      | マッチング用WebSocket   |
| `ws://{host}/ws/room/{room_id}` | ゲームルーム用WebSocket |

---

## WebSocket イベント仕様

### Server → Client

| イベント名       | タイミング     | ペイロード概要             |
| ---------------- | -------------- | -------------------------- |
| `ev_match_found` | マッチング成立 | Room ID・対戦相手情報      |
| `ev_turn_start`  | ターン開始     | 問題データ・制限時間       |
| `ev_turn_result` | ターン終了     | 正解・両者の獲得ヌー・Tips |
| `ev_game_end`    | 試合終了       | 最終リザルト               |

### Client → Server

| アクション名        | タイミング | ペイロード概要               |
| ------------------- | ---------- | ---------------------------- |
| `act_bet_gnu`       | ベット     | 賭けるヌー数                 |
| `act_submit_answer` | 回答送信   | 選択肢インデックス・回答時間 |

---

## LLM レスポンス JSONスキーマ

問題生成APIのレスポンスとして、LLMに以下のJSON形式を強制する。

```json
{
  "type": "object",
  "properties": {
    "difficulty": {
      "type": "string",
      "enum": ["Easy", "Normal", "Hard"]
    },
    "question_text": {
      "type": "string",
      "description": "問題文（例: この関数の実行結果として正しいものはどれ？）"
    },
    "choices": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 4,
      "maxItems": 4,
      "description": "4つの選択肢の配列"
    },
    "correct_answer": {
      "type": "string",
      "description": "正解の選択肢テキストそのもの（インデックスではなく文字列で保持）"
    },
    "tips": {
      "type": "string",
      "description": "正解の理由と、コードをより良くするための技術的アドバイス"
    }
  },
  "required": ["difficulty", "question_text", "choices", "correct_answer", "tips"]
}
```

> `correct_answer` を文字列で持たせる理由: LLMがインデックスと選択肢の整合をミスするケースを防ぐ。Go側で `slices.Index(choices, correct_answer)` でインデックスを導出する。

---

## DBスキーマ（PostgreSQL）

### users テーブル

| カラム名        | 型          | 説明                             |
| --------------- | ----------- | -------------------------------- |
| id              | UUID        | PK                               |
| github_id       | BIGINT      | GitHub ユーザーID                |
| github_login    | VARCHAR     | GitHubユーザー名                 |
| gnu_balance     | INT         | 保有ヌー（初期値: 1000）         |
| rate            | INT         | レーティング（初期値: 1500）     |
| encrypted_token | TEXT        | 暗号化済みGitHubアクセストークン |
| created_at      | TIMESTAMPTZ | 作成日時                         |
| updated_at      | TIMESTAMPTZ | 更新日時                         |

### match_histories テーブル

| カラム名   | 型          | 説明                           |
| ---------- | ----------- | ------------------------------ |
| id         | UUID        | PK                             |
| room_id    | UUID        | ゲームルームID                 |
| player1_id | UUID        | FK → users.id                  |
| player2_id | UUID        | FK → users.id                  |
| winner_id  | UUID        | FK → users.id（NULL=引き分け） |
| gnu_diff   | INT         | ヌーの増減量                   |
| played_at  | TIMESTAMPTZ | 対戦日時                       |

---

## Redisキー設計

| キー                       | 型   | 説明                                     |
| -------------------------- | ---- | ---------------------------------------- |
| `matchmaking:queue`        | List | マッチング待機ユーザーのリスト           |
| `room:{room_id}:state`     | Hash | ゲームルームの状態（ターン数・スコア等） |
| `room:{room_id}:questions` | List | 生成済み問題のリスト                     |
