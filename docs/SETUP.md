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

- PostgreSQL のデータディレクトリ初期化（`initdb --no-locale --encoding=UTF8`）
- 環境変数のエクスポート（`PGHOST=/tmp` など）

### 3. 初回セットアップ（推奨）

**ワンコマンドでセットアップ:**

```bash
devbox run setup
```

これにより以下が自動実行されます：
- サービス起動（PostgreSQL, Redis）
- フロントエンド依存関係インストール
- データベース作成とマイグレーション適用

**または手動で各ステップ実行:**

```bash
# サービスを起動
devbox services start

# フロントエンド依存関係インストール
devbox run frontend:install

# データベースとマイグレーション
devbox run db:setup
```

### 4. 開発サーバーの起動

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

| コマンド                      | 説明                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `devbox run setup`            | 初回セットアップ（サービス起動 + npm install + DB作成）     |
| `devbox services start`       | サービス（PostgreSQL, Redis）を起動                         |
| `devbox services stop`        | サービスを停止                                              |
| `devbox services ls`          | サービスの状態確認                                          |
| `devbox run db:setup`         | DB作成 + マイグレーション（手動実行用）                      |
| `devbox run backend:dev`      | バックエンド開発サーバー（ホットリロード）                   |
| `devbox run backend:run`      | バックエンド実行（ホットリロードなし）                       |
| `devbox run backend:build`    | バックエンドビルド                                          |
| `devbox run frontend:dev`     | フロントエンド開発サーバー                                   |
| `devbox run frontend:install` | フロントエンド依存関係インストール                           |
| `devbox run sqlc:generate`    | SQLCコード生成                                              |

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
# サービスを停止
devbox services stop

# PostgreSQLのデータディレクトリをリセット（開発データは消えます）
rm -rf ~/.local/share/hackathon_nulabcup/postgresql/data

# devbox shellに入り直してinitdbを実行
exit
devbox shell

# サービスを再起動
devbox services start

# データベースをセットアップ
devbox run db:setup
```

### マイグレーションを再適用したい

```bash
devbox run db:setup
```

### サービスの状態を確認したい

```bash
# 実行中のサービス一覧
devbox services ls

# PostgreSQLの接続確認
pg_isready -h /tmp

# プロセス確認
ps aux | grep postgres
ps aux | grep redis
```

### ポートが競合する

```bash
# 何がポートを使っているか確認
lsof -i :8080   # バックエンド
lsof -i :3000   # フロントエンド
lsof -i :5432   # PostgreSQL（通常はUnixソケットなので不要）

# プロセスを停止
kill -9 $(lsof -ti:8080)
kill -9 $(lsof -ti:3000)
```

### サービスが正常に停止しない

```bash
# devbox servicesを強制停止
devbox services stop

# それでもダメな場合はプロセスを直接停止
pkill -f process-compose
pkill postgres
pkill redis-server
```
