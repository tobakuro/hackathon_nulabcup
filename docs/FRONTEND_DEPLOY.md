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

---

## ウォークスルー：デプロイの全体像

ここでは「`frontend/` 配下のコードを `main` にプッシュしてからRaspberry Pi上でサイトが動くまで」の流れを、ステップごとに解説します。

### 前提

```
┌─────────────┐     Cloudflare Tunnel      ┌──────────────────────────┐
│  ブラウザ     │ ◄──────────────────────► │  Raspberry Pi             │
│              │   nulab.uomi.site:443     │                          │
└─────────────┘                            │  ┌── frontend (:3002) ◄─┐│
                                           │  ├── backend  (:8080)   ││
      ┌─────────────┐  cloudflared SSH     │  ├── postgres (:5432)   ││
      │ GitHub       │ ──────────────────► │  └── redis    (:6379)   ││
      │ Actions      │  SCP + deploy       │                         ││
      └─────────────┘                      │  .env ← GitHub Secrets  ┘│
                                           └──────────────────────────┘
```

- フロントエンドは Next.js の **standalone モード** でビルドし、`node server.js` で実行
- DB（PostgreSQL）はRaspberry Pi上のDockerで動いており、`localhost:5432` で接続
- 環境変数はすべて **GitHub Secrets** で管理し、デプロイ時に raspi へ `.env` として配信

---

### Step 1: トリガー — `main` ブランチへのプッシュ

```yaml
# .github/workflows/frontend-deploy.yml
on:
  push:
    branches: [main]
    paths: ["frontend/**"]
```

`frontend/` 配下のファイルが `main` に入ると、GitHub Actions が起動します。
バックエンドのコードだけ変更した場合は走りません（`paths` フィルター）。

---

### Step 2: CI ジョブ — 品質チェック

```
format:check → lint → typecheck → test
```

devbox 環境内でフロントエンドの品質チェックを実施します。ここで失敗するとデプロイには進みません。
バックエンドの `backend-deploy.yml` と同じパターンです。

---

### Step 3: ビルド — Next.js standalone 出力

```yaml
env:
  NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}   # https://nulab-api.uomi.site
  NEXT_PUBLIC_WS_URL:  ${{ secrets.NEXT_PUBLIC_WS_URL }}    # wss://nulab-api.uomi.site
run: npm run build
```

`next.config.ts` で `output: "standalone"` を設定しているため、ビルド結果には:
- `server.js` — Node.js で直接実行可能なサーバー
- `.next/` — ビルド済みアセット
- `node_modules/` — 実行に必要な依存だけ含むサブセット

が生成されます。`NEXT_PUBLIC_*` はビルド時にJSにインライン埋め込みされるため、この時点で渡す必要があります。

---

### Step 4: パッケージング — tar.gz 作成

```bash
mkdir -p dist
cp -r .next/standalone/. dist/          # server.js + 最小node_modules
cp -r .next/static dist/.next/static    # CSS/JS等の静的アセット
cp -r public dist/public                # favicon等
cp drizzle.config.ts dist/              # DBマイグレーション用
cp -r drizzle dist/drizzle
cp -r src/db dist/src/db
tar -czf frontend-standalone.tar.gz -C dist .
```

standaloneは `server.js + node_modules` だけ出力しますが、静的ファイルとマイグレーション資材は手動コピーが必要です。全部まとめて1つの tar.gz にします。

---

### Step 5: SSH接続の準備 — cloudflared

```bash
scp -o ProxyCommand="cloudflared access ssh --hostname $RASPI_HOST ..."
```

raspiはCloudflare Tunnelの裏にいるため、直接SSHできません。
`cloudflared` の ProxyCommand を使うことで、Cloudflare Accessを経由してSSH/SCPが可能になります。
バックエンドデプロイの `backend-deploy.yml` とまったく同じ方式です。

---

### Step 6: .env 生成 — GitHub Secrets → Raspberry Pi

```bash
# GitHub Actions 上で .env ファイルを生成
printf 'DATABASE_URL=%s\n' "$FRONTEND_DATABASE_URL"
printf 'GITHUB_ID=%s\n'    "$FRONTEND_GITHUB_ID"
printf 'AUTH_URL=%s\n'      "$FRONTEND_AUTH_URL"
# ...

# SCP で raspi に転送
scp /tmp/frontend.env → /opt/frontend/.env
chmod 600 /opt/frontend/.env
```

**ポイント:**
- GitHub Secrets名には `FRONTEND_` プレフィックスを付けて管理（バックエンドと区別）
- `.env` に書き出す際はプレフィックスを外す（`FRONTEND_GITHUB_ID` → `GITHUB_ID=xxx`）
- `printf` を使うことでパスワード中の `$` `!` 等のシェルメタ文字を安全に処理
- `.env` のパーミッションは `600`（オーナーのみ読み書き可）

対応する `.env.example`:
```dotenv
GITHUB_ID=
GITHUB_SECRET=
AUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GEMINI_API_KEY=
```

---

### Step 7: デプロイ — 展開 & マイグレーション & 再起動

```
raspi 上で実行される処理:

1. /opt/frontend/app → app.bak にバックアップ
2. tar.gz を /opt/frontend/app に展開
3. /opt/frontend/.env から DATABASE_URL を読み取り
4. npx drizzle-kit migrate でスキーマ適用
5. systemctl --user restart frontend.service
6. 30秒間ヘルスチェック
7. 失敗時: app.bak → app に戻してロールバック
```

---

### Step 8: サービスの起動 — systemd

```ini
# raspi/frontend.service
[Service]
WorkingDirectory=/opt/frontend/app
ExecStart=/usr/bin/node server.js

Environment=NODE_ENV=production
Environment=PORT=3002
Environment=HOSTNAME=127.0.0.1

EnvironmentFile=/opt/frontend/.env    ← Step 6 で配置した .env
```

systemd が `server.js` を起動し、`.env` から環境変数を読み込みます。
- `PORT=3002` で待ち受け（3000はGrafana、3001はUptime Kumaが使用中）
- `HOSTNAME=127.0.0.1` でローカルのみバインド（外部からはCloudflare Tunnel経由）

---

### Step 9: 外部アクセス — Cloudflare Tunnel

```
ブラウザ → nulab.uomi.site (HTTPS)
                ↓
        Cloudflare Tunnel
                ↓
        localhost:3002 (Next.js)
                ↓
        localhost:5432 (PostgreSQL)  ← DB接続はlocalhostなのでOK
```

Cloudflare Tunnel がHTTPS終端とドメインルーティングを担当。
フロントエンドがraspi上で動くことで、PostgreSQLに `localhost` として接続でき、
Issue #86 の「フロントエンドからDBに接続できない」問題が解決します。

---

### バックエンドデプロイとの比較

| 項目 | バックエンド | フロントエンド |
|------|-------------|---------------|
| 言語 | Go (ARM64クロスコンパイル) | Node.js (standalone) |
| 成果物 | 単一バイナリ `server` | `server.js` + `node_modules/` + `.next/` (tar.gz) |
| 環境変数 | systemd `Environment=` | `.env` ファイル (GitHub Secretsから自動生成) |
| マイグレーション | goose (手動) | drizzle-kit migrate (デプロイ時自動) |
| ロールバック | なし | 自動 (app.bak から復元) |
| ポート | 8080 | 3002 |
