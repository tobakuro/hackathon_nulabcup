# Frontend

GitHub技術バトルゲームのフロントエンドです。Next.js で実装されており、GitHub OAuth 認証・Gemini API との連携・WebSocket によるリアルタイム通信を担います。

## 技術構成

- **フレームワーク**: Next.js (App Router)
- **認証**: NextAuth.js (GitHub OAuth)
- **リアルタイム通信**: WebSocket
- **LLM連携**: Gemini API (API Routes 経由)
- **DB**: Cloudflare D1 (Drizzle ORM)
- **スタイリング**: Tailwind CSS

## 開発環境での起動

プロジェクトルートで `devbox shell` に入った状態で実行してください。

```bash
# 依存関係のインストール（初回のみ）
devbox run frontend:install

# 開発サーバーの起動
devbox run frontend:dev
```

または `frontend/` ディレクトリで直接:

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 利用可能なスクリプト

| コマンド           | 説明                         |
| ------------------ | ---------------------------- |
| `npm run dev`      | 開発サーバー起動             |
| `npm run build`    | プロダクションビルド         |
| `npm run lint`     | ESLint によるコード検査      |
| `npm run test`     | Vitest によるユニットテスト  |
| `npm run test:e2e` | Playwright による E2E テスト |

## 環境変数

`.env.local` に以下の変数を設定してください。

```env
# GitHub OAuth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_SECRET=

# Gemini API
GEMINI_API_KEY=

```

## ディレクトリ構成

```
src/
├── app/           # Next.js App Router のページ・API Routes
├── components/    # UIコンポーネント
├── hooks/         # カスタムフック（WebSocket等）
├── lib/           # ユーティリティ・Gemini API クライアント
├── types/         # 型定義
├── db/            # Drizzle ORM スキーマ
└── e2e/           # Playwright E2E テスト
```
