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

初回はパッケージのダウンロードに時間がかかります。完了すると以下が自動で実行されます：

- PostgreSQL のデータディレクトリ初期化（`--no-locale --encoding=UTF8`）
- PostgreSQL の起動（`pg_ctl` による直接起動）
- `hackathon` データベース作成
- マイグレーション適用（初回のみ）

2回目以降の `devbox shell` では既存の状態を検出してスキップするため、高速に起動します。

### 3. フロントエンドの依存関係インストール

```bash
devbox run frontend:install
```

### 4. バックエンドの依存関係インストール

```bash
cd backend && go mod download && cd ..
```

### 5. 開発サーバーの起動

ターミナルを2つ開き、それぞれ `devbox shell` に入った状態で:

**バックエンド（Go + air によるホットリロード）:**

```bash
devbox run backend:dev
```

**フロントエンド（Next.js）:**

```bash
devbox run frontend:dev
```

| サービス         | URL                   |
| ---------------- | --------------------- |
| フロントエンド   | http://localhost:3000 |
| バックエンド API | http://localhost:8080 |

## 利用可能なスクリプト

| コマンド                      | 説明                                                |
| ----------------------------- | --------------------------------------------------- |
| `devbox run db:setup`         | DB作成 + マイグレーション（手動実行用、通常は不要） |
| `devbox run backend:dev`      | バックエンド開発サーバー（ホットリロード）          |
| `devbox run backend:run`      | バックエンド実行（ホットリロードなし）              |
| `devbox run backend:build`    | バックエンドビルド                                  |
| `devbox run frontend:dev`     | フロントエンド開発サーバー                          |
| `devbox run frontend:install` | フロントエンド依存関係インストール                  |
| `devbox run sqlc:generate`    | SQLCコード生成                                      |

## DB接続情報

devbox 環境では PostgreSQL に **UNIXソケット** で接続します。TCP接続（`localhost:5432`）ではありません。

| 項目           | 値                                    |
| -------------- | ------------------------------------- |
| ホスト         | `$PGHOST`（UNIXソケットディレクトリ） |
| データベース名 | `hackathon`                           |
| ユーザー       | OSのユーザー名（自動検出）            |
| パスワード     | なし（trust認証）                     |

バックエンドは `.env` がなくても devbox 環境変数（`$PGHOST`）を自動検出して接続します。

### psql で直接接続する場合

```bash
# devbox shell 内で
psql hackathon
```

## トラブルシューティング

### PostgreSQL が起動しない / データが壊れた

```bash
# PostgreSQLのデータディレクトリをリセット（開発データは消えます）
rm -rf .devbox/virtenv/postgresql/data
devbox shell   # init_hook で自動再初期化・DB作成・マイグレーションまで実行
```

### マイグレーションを再適用したい

```bash
# sentinelファイルを削除してから devbox shell に入り直す
rm .devbox/virtenv/postgresql/data/.migration_applied
devbox run db:setup
```

### ポートが競合する

```bash
# 何がポートを使っているか確認
lsof -i :8080   # バックエンド
lsof -i :3000   # フロントエンド
```

### process-compose のロックが残っている

```bash
# ソケット・ロックファイルを手動で削除
rm -f .devbox/virtenv/postgresql/.s.PGSQL.5432 .devbox/virtenv/postgresql/.s.PGSQL.5432.lock
devbox shell
```
