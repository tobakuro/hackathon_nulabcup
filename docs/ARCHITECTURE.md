# アーキテクチャ設計

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js |
| バックエンド | Go (Goroutine / Channel) |
| リアルタイム通信 | WebSocket (`gorilla/websocket`) |
| DB | PostgreSQL |
| インメモリDB | Redis (マッチングキュー・ルーム状態管理) |
| 認証 | GitHub OAuth (NextAuth.js) |
| LLM | Gemini API |

## システム構成図

```
[Browser]
    |
    | HTTP (REST)   WebSocket
    v
[Next.js Frontend]
    |
    | HTTP / WS
    v
[Go Backend]
    |--- [PostgreSQL] (ユーザー情報・対戦履歴)
    |--- [Redis]      (マッチングキュー・ルーム状態)
    |--- [GitHub API] (リポジトリ・コードフェッチ)
    |--- [LLM API]    (問題生成)
```

## 主要な処理フロー

1. ユーザーがGitHub OAuthでログイン
2. マッチングキュー（Redis）に入る
3. 対戦相手が見つかったら、ゲームルームをRedisに生成
4. サーバーがGitHub APIからコードを取得し、LLMで4択問題を生成（並行処理）
5. WebSocket経由で問題を配信し、ゲームループ開始
6. 試合終了後、ヌーをPostgreSQLに保存
