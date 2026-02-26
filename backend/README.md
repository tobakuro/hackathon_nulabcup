# Backend

GitHub技術バトルゲームのバックエンドです。Go で実装されており、WebSocket によるリアルタイムゲームロジック・マッチングキュー・DB 管理を担います。

## 技術構成

- **言語**: Go
- **リアルタイム通信**: WebSocket (`gorilla/websocket`)
- **DB**: PostgreSQL (SQLC + goose によるマイグレーション)
- **インメモリDB**: Redis（マッチングキュー・ルーム状態管理）
- **ホットリロード**: air

## 開発環境での起動

プロジェクトルートで `devbox shell` に入った状態で実行してください。

```bash
devbox run backend:dev
```

API サーバーは http://localhost:8080 で起動します。

## 主要なエンドポイント

詳細は [docs/API_SCHEMA.md](../docs/API_SCHEMA.md) を参照してください。

| エンドポイント | 説明 |
|---|---|
| `GET /health` | ヘルスチェック |
| `WS /ws/matchmake` | マッチングキューへの参加 |
| `WS /ws/room/:id` | ゲームルームへの接続 |

## ディレクトリ構成

```
backend/
├── cmd/server/        # エントリーポイント
├── internal/
│   ├── config/        # 設定読み込み
│   ├── domain/        # エンティティ・リポジトリインターフェース
│   ├── handler/       # HTTP・WebSocket ハンドラー
│   ├── infrastructure/ # DB・Redis 実装
│   └── usecase/       # ビジネスロジック
└── db/
    ├── migrations/    # goose マイグレーション
    └── queries/       # SQLC クエリ定義
```

