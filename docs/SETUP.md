# 開発環境セットアップガイド

0から開発に参加する人向けの手順書です。

## 前提条件

- **Git** がインストール済み
- **[devbox](https://www.jetify.com/devbox)** がインストール済み

```bash
# devbox のインストール（未導入の場合）
curl -fsSL https://get.jetify.com/devbox | bash
```

> devbox が Node.js, Go, PostgreSQL, Redis 等すべてのツールチェーンを自動で管理します。
> ローカルに個別インストールする必要はありません。

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/tobakuro/hackathon_nulabcup.git
cd hackathon_nulabcup
```

### 2. devbox shell に入る

```bash
devbox shell
```

初回はパッケージのダウンロードに時間がかかります。完了すると PostgreSQL のデータディレクトリが自動初期化されます。

### 3. サービス起動（PostgreSQL・Redis）

```bash
devbox services up --background
```

devbox の [process-compose](https://www.jetify.com/devbox/docs/guides/services/) がPostgreSQLとRedisをバックグラウンドで起動・管理します。

状態確認:
```bash
devbox services ls
```

停止:
```bash
devbox services stop
```

### 4. データベースのセットアップ

```bash
devbox run db:setup
```

`hackathon` データベースの作成とマイグレーションを実行します。

### 5. フロントエンドの依存関係インストール

```bash
devbox run frontend:install
```

### 6. バックエンドの依存関係インストール

```bash
cd backend && go mod download && cd ..
```

### 7. 開発サーバーの起動

ターミナルを2つ開き、それぞれ `devbox shell` に入った状態で:

**バックエンド（Go + air によるホットリロード）:**
```bash
devbox run backend:dev
```

**フロントエンド（Next.js）:**
```bash
devbox run frontend:dev
```

| サービス | URL |
|---|---|
| フロントエンド | http://localhost:3000 |
| バックエンド API | http://localhost:8080 |

## 利用可能なスクリプト

| コマンド | 説明 |
|---|---|
| `devbox services up --background` | PostgreSQL・Redis をバックグラウンド起動 |
| `devbox services stop` | サービス停止 |
| `devbox run db:setup` | DB作成 + マイグレーション |
| `devbox run backend:dev` | バックエンド開発サーバー（ホットリロード） |
| `devbox run backend:run` | バックエンド実行（ホットリロードなし） |
| `devbox run backend:build` | バックエンドビルド |
| `devbox run frontend:dev` | フロントエンド開発サーバー |
| `devbox run frontend:install` | フロントエンド依存関係インストール |
| `devbox run sqlc:generate` | SQLCコード生成 |

## DB接続情報

devbox 環境では PostgreSQL に **UNIXソケット** で接続します。TCP接続（`localhost:5432`）ではありません。

| 項目 | 値 |
|---|---|
| ホスト | `$PGHOST`（UNIXソケットディレクトリ） |
| データベース名 | `hackathon` |
| ユーザー | OSのユーザー名（自動検出） |
| パスワード | なし（trust認証） |

バックエンドは `.env` がなくても devbox 環境変数（`$PGHOST`）を自動検出して接続します。

### psql で直接接続する場合

```bash
# devbox shell 内で
psql hackathon
```

## トラブルシューティング

### PostgreSQL が起動しない

```bash
# データディレクトリを再初期化
rm -rf .devbox/virtenv/postgresql_18/data
devbox shell   # init_hook で自動再初期化
devbox services up --background
devbox run db:setup
```

### ポートが競合する

```bash
# 何がポートを使っているか確認
lsof -i :8080   # バックエンド
lsof -i :3000   # フロントエンド
```

### devbox services が動かない

```bash
# process-compose のプロセスが残っている場合
devbox services stop
devbox services up --background
```
