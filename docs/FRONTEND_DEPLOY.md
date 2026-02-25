# フロントエンド Raspberry Pi デプロイガイド

フロントエンド（Next.js）を Raspberry Pi にデプロイするための手順書です。
バックエンドと同様に、GitHub Actions → cloudflared SSH → systemd の構成で自動デプロイされます。

## アーキテクチャ概要

```
GitHub (push to main)
  └─ GitHub Actions (.github/workflows/frontend-deploy.yml)
       ├─ CI: format / lint / typecheck / test
       └─ Deploy:
            ├─ npm run build (standalone)
            ├─ tar.gz にパッケージ
            ├─ cloudflared SSH で raspi に SCP
            └─ raspi で展開 + drizzle migrate + systemctl restart
```

**ポート割り当て:**

| サービス       | ポート | ドメイン                   |
| -------------- | ------ | -------------------------- |
| Grafana        | 3000   | -                          |
| Uptime Kuma    | 001   | -                          |
| Next.js        | 3002   | nulab.uomi.site            |
| Go バックエンド | 8080   | nulab-api.uomi.site        |

**Cloudflare Tunnel ルーティング:**

- `nulab.uomi.site` → `http://localhost:3002`
- `nulab-api.uomi.site` → `http://localhost:8080`

---

## Raspberry Pi 初期セットアップ（初回のみ）

### 1. Node.js 22 のインストール

```bash
# NodeSource リポジトリを追加（ARM64 対応）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 確認
node -v   # v22.x.x
npm -v    # 10.x.x
```

### 2. フロントエンド用ディレクトリの作成

```bash
# バックエンドと同様の構成
sudo mkdir -p /opt/frontend/app
sudo chown -R $(whoami):$(whoami) /opt/frontend
```

### 3. systemd ユーザーサービスの登録

```bash
# ユーザーサービスディレクトリ作成
mkdir -p ~/.config/systemd/user

# サービスファイルをコピー（リポジトリの raspi/frontend.service）
cp raspi/frontend.service ~/.config/systemd/user/frontend.service

# サービスのリロードと有効化
systemctl --user daemon-reload
systemctl --user enable frontend.service
```

> 環境変数（DB接続情報、APIキー等）は GitHub Secrets から自動で `/opt/frontend/.env` に生成されます。手動設定は不要です。

### 4. lingering の有効化

ユーザーがログアウトしてもサービスを動かし続けるために必要です：

```bash
sudo loginctl enable-linger $(whoami)
```

### 5. Cloudflare Tunnel の設定更新

Cloudflare Zero Trust ダッシュボードで、Tunnel のルーティングを更新します：

- `nulab.uomi.site` のサービスを `http://localhost:3002` に設定

---

## GitHub Secrets の設定

フロントエンドのデプロイには、既存のバックエンド用 Secrets に加えて以下が必要です。
デプロイ時にこれらの Secrets から Raspberry Pi 上に `.env` ファイルが自動生成されます。

### 既存 Secrets（バックエンドと共有）

| Secret 名            | 説明                            |
| --------------------- | ------------------------------- |
| `SSH_PRIVATE_KEY`     | raspi SSH 秘密鍵               |
| `RASPI_KNOWN_HOSTS`   | raspi のホスト鍵               |
| `RASPI_HOST`          | raspi のホスト名               |
| `RASPI_USER`          | raspi のユーザー名             |
| `CF_CLIENT_ID`        | Cloudflare Access Client ID    |
| `CF_CLIENT_SECRET`    | Cloudflare Access Client Secret|

### 追加が必要な Secrets（フロントエンド用）

| Secret 名                  | 値の例                                                    | 説明                            |
| -------------------------- | --------------------------------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_API_URL`      | `https://nulab-api.uomi.site`                             | バックエンド API の URL（ビルド時） |
| `NEXT_PUBLIC_WS_URL`       | `wss://nulab-api.uomi.site`                               | WebSocket の URL（ビルド時）      |
| `FRONTEND_DATABASE_URL`    | `postgres://hackathon:PASSWORD@localhost:5432/hackathon`   | DB 接続文字列                    |
| `FRONTEND_GITHUB_ID`       | GitHub OAuth App の Client ID                              | GitHub OAuth 認証用              |
| `FRONTEND_GITHUB_SECRET`   | GitHub OAuth App の Client Secret                          | GitHub OAuth 認証用              |
| `FRONTEND_NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成                           | NextAuth セッション暗号化キー     |
| `FRONTEND_AUTH_URL`        | `https://nulab.uomi.site`                                 | Auth.js のベース URL              |
| `FRONTEND_GEMINI_API_KEY`  | Gemini API キー                                            | LLM API 用                      |

**設定方法:** GitHub リポジトリ → Settings → Secrets and variables → Actions → New repository secret

> **仕組み:** デプロイ時に GitHub Secrets から `/opt/frontend/.env` が自動生成され、systemd の `EnvironmentFile=` で読み込まれます。
> raspi 上で手動で環境変数を設定する必要はありません。

---

## デプロイフロー

### 自動デプロイ（通常運用）

`frontend/**` 配下のファイルが `main` ブランチにプッシュされると、自動的にデプロイが走ります。

1. **CI ジョブ**: format / lint / typecheck / test
2. **Deploy ジョブ**（CI 成功後）:
   - Next.js standalone ビルド
   - `tar.gz` にパッケージ（drizzle migrations 含む）
   - cloudflared SSH で raspi に転送
   - 旧ビルドをバックアップ → 新ビルド展開 → drizzle migrate → restart
   - 30 秒間ヘルスチェック
   - 失敗時は自動ロールバック

### 手動デプロイ

raspi に SSH して手動デプロイする場合：

```bash
# ローカルでビルド（ARM64 の raspi 上で直接行う場合）
cd frontend
npm ci
npm run build

# standalone を配置
sudo systemctl --user stop frontend.service
rm -rf /opt/frontend/app.bak
mv /opt/frontend/app /opt/frontend/app.bak
mkdir /opt/frontend/app
cp -r .next/standalone/. /opt/frontend/app/
cp -r .next/static /opt/frontend/app/.next/static
cp -r public /opt/frontend/app/public 2>/dev/null || true

# マイグレーション
cd /opt/frontend/app
DATABASE_URL="postgres://hackathon:PASSWORD@localhost:5432/hackathon" npx drizzle-kit migrate

# 再起動
systemctl --user restart frontend.service
systemctl --user status frontend.service
```

---

## トラブルシューティング

### サービスの状態確認

```bash
systemctl --user status frontend.service
journalctl --user -u frontend.service --no-pager -n 50
```

### ロールバック

```bash
cd /opt/frontend
systemctl --user stop frontend.service
rm -rf app
mv app.bak app
systemctl --user restart frontend.service
```

### ポート確認

```bash
# 3002 が使われているか確認
ss -tlnp | grep 3002
curl -s http://localhost:3002 | head -20
```

### Node.js のバージョン問題

Next.js 16 は Node.js 22 が必要です。バージョンを確認してください：

```bash
node -v  # v22.x.x であること
```
