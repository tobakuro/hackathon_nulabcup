# デプロイ手順

## アーキテクチャ概要

| レイヤー | サービス |
|---|---|
| DB (PostgreSQL) | Supabase |
| Redis | Upstash |
| Go バックエンド | Google Cloud Run |
| Next.js フロントエンド | Cloudflare Pages (OpenNext.js) |
| CI/CD | GitHub Actions |

---

## 1. Supabase (PostgreSQL) セットアップ

### 1-1. プロジェクト作成

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. リージョン・パスワードを設定

### 1-2. 接続 URL の取得

**Settings → Database → Connection string** を開く。

- **Transaction Pooler**（サーバーレス用・Cloud Run / Cloudflare 向け）
  ```
  postgresql://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres
  ```
- **Direct connection**（マイグレーション用）
  ```
  postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
  ```

> Cloud Run / Cloudflare Pages からは **Transaction Pooler** を使う。`drizzle-kit migrate` などのマイグレーション時は **Direct connection** を使う。

### 1-3. マイグレーション実行（初回）

```bash
# frontend ディレクトリで
DATABASE_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  npx drizzle-kit migrate
```

---

## 2. Upstash (Redis) セットアップ

### 2-1. データベース作成

1. [Upstash Console](https://console.upstash.com) でデータベースを作成
2. リージョンを選択（サービスに近いリージョン推奨）

### 2-2. 接続情報の取得

Upstash ダッシュボード → **Details** タブで確認:

| 用途 | 値 |
|---|---|
| Go (go-redis) | `rediss://default:<password>@<host>:<port>` |
| REST API (HTTP) | `https://<host>` + Token |

> `rediss://`（s が2つ）は TLS 接続。Upstash は TLS 必須。

---

## 3. Google Cloud (Cloud Run) セットアップ

### 3-1. 前提条件

- `gcloud` CLI インストール済み・ログイン済み
- プロジェクトに **請求先アカウントが設定済み**

### 3-2. API の有効化

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project <PROJECT_ID>
```

### 3-3. Artifact Registry リポジトリ作成

```bash
gcloud artifacts repositories create backend \
  --repository-format=docker \
  --location=asia-northeast1 \
  --project <PROJECT_ID>
```

### 3-4. Service Account 作成・権限付与

```bash
PROJECT_ID="<PROJECT_ID>"
SA_EMAIL="github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# SA 作成
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer" \
  --project "$PROJECT_ID"

# 権限付与
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

### 3-5. Workload Identity Federation 設定

GitHub Actions がサービスアカウントキーなしで GCP に認証できるようにする。

```bash
PROJECT_ID="<PROJECT_ID>"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
GITHUB_REPO="<owner>/<repo>"

# Pool 作成
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project "$PROJECT_ID"

# Provider 作成
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
  --project "$PROJECT_ID"

# SA にバインド
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}"
```

取得できる値:
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `GCP_SERVICE_ACCOUNT`: `github-actions-deployer@<PROJECT_ID>.iam.gserviceaccount.com`

---

## 4. Cloudflare Pages セットアップ

### 4-1. Pages プロジェクト作成

```bash
cd frontend
npx wrangler pages project create <project-name>
```

### 4-2. 必要な情報

| 項目 | 取得場所 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare ダッシュボード → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ダッシュボード → 右サイドバー |
| `CLOUDFLARE_PAGES_PROJECT` | 作成したプロジェクト名 |

### 4-3. ローカルビルド確認

```bash
cd frontend
npm run build:cf   # OpenNextJS で Cloudflare 向けビルド
```

---

## 5. GitHub Secrets の登録

以下のコマンドで一括登録:

```bash
REPO="<owner>/<repo>"

gh secret set GCP_PROJECT_ID                 --repo "$REPO" --body "<value>"
gh secret set GCP_REGION                     --repo "$REPO" --body "asia-northeast1"
gh secret set GCP_SERVICE_ACCOUNT            --repo "$REPO" --body "<value>"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$REPO" --body "<value>"
gh secret set BACKEND_DATABASE_URL           --repo "$REPO" --body "<Transaction Pooler URL>"
gh secret set BACKEND_REDIS_URL              --repo "$REPO" --body "<rediss://...>"
gh secret set FRONTEND_DATABASE_URL          --repo "$REPO" --body "<Transaction Pooler URL>"
gh secret set FRONTEND_BACKEND_URL           --repo "$REPO" --body "<Cloud Run URL>"  # 初回デプロイ後
gh secret set CLOUDFLARE_API_TOKEN           --repo "$REPO" --body "<value>"
gh secret set CLOUDFLARE_ACCOUNT_ID          --repo "$REPO" --body "<value>"
gh secret set CLOUDFLARE_PAGES_PROJECT       --repo "$REPO" --body "<value>"

# 既存 (認証・フロントエンド用)
gh secret set FRONTEND_GITHUB_ID             --repo "$REPO" --body "<value>"
gh secret set FRONTEND_GITHUB_SECRET         --repo "$REPO" --body "<value>"
gh secret set FRONTEND_AUTH_URL              --repo "$REPO" --body "<value>"
gh secret set FRONTEND_NEXTAUTH_SECRET       --repo "$REPO" --body "<value>"
gh secret set FRONTEND_GEMINI_API_KEY        --repo "$REPO" --body "<value>"
```

---

## 6. デプロイフロー

`main` ブランチへの push で `.github/workflows/deploy.yml` が自動実行される。

```
push to main
  │
  ├─ deploy-backend
  │    1. Google Cloud 認証 (Workload Identity)
  │    2. Docker イメージビルド → Artifact Registry にプッシュ
  │    3. Cloud Run にデプロイ
  │
  └─ deploy-frontend (deploy-backend 完了後)
       1. npm ci
       2. npm run build:cf (OpenNextJS)
       3. wrangler pages deploy
```

### 初回デプロイ後の追加作業

Cloud Run のサービス URL を確認して `FRONTEND_BACKEND_URL` Secret に登録:

```bash
gcloud run services describe backend \
  --region asia-northeast1 \
  --format="value(status.url)"
# → https://backend-xxxxxxxx-an.a.run.app

gh secret set FRONTEND_BACKEND_URL \
  --repo "<owner>/<repo>" \
  --body "https://backend-xxxxxxxx-an.a.run.app"
```

---

## 7. DB マイグレーション

デプロイとは別に、スキーマ変更時は手動でマイグレーションを実行する。

```bash
cd frontend

# Direct connection を使用 (Transaction Pooler は prepared statement 非対応)
DATABASE_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  npx drizzle-kit migrate
```

---

## 環境変数一覧

### Backend (Cloud Run)

| 変数名 | 説明 |
|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler URL |
| `REDIS_URL` | Upstash の `rediss://` URL |
| `SERVER_PORT` | `8080` (固定) |

### Frontend (Cloudflare Pages)

| 変数名 | 説明 |
|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler URL |
| `GITHUB_ID` | GitHub OAuth App ID |
| `GITHUB_SECRET` | GitHub OAuth App Secret |
| `AUTH_URL` | NextAuth コールバック URL |
| `NEXTAUTH_SECRET` | NextAuth シークレット |
| `GEMINI_API_KEY` | Google Gemini API キー |
| `NEXT_PUBLIC_BACKEND_URL` | Cloud Run の URL |
