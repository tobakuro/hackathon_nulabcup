# Raspberry Pi Self-hosted Runner CD環境セットアップ

raspi を GitHub Actions Self-hosted Runner として登録し、`git push` → 自動デプロイを実現する手順。

## 全体の流れ

```
git push origin main
  → GitHub が変更を検知
  → raspi の Runner が job を受け取る
  → checkout → .env 生成 → ビルド → systemctl restart
```

---

## 前提条件

- Raspberry Pi (ARM64) が起動していること
- GitHub リポジトリの Admin 権限があること
- raspi に SSH またはターミナルでアクセスできること

---

## Step 1: devbox のインストール

```bash
curl -fsSL https://get.jetify.com/devbox | bash
```

インストール後、シェルを再起動するか以下を実行：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

## Step 2: リポジトリのクローン

```bash
git clone https://github.com/tobakuro/hackathon_nulabcup.git ~/workspace/hackathon_nulabcup
cd ~/workspace/hackathon_nulabcup
devbox install  # Node.js・Go 等のパッケージをインストール（初回は時間がかかる）
```

---

## Step 3: Runner のダウンロード

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner

curl -o actions-runner-linux-arm64-2.331.0.tar.gz \
  -L https://github.com/actions/runner/releases/download/v2.331.0/actions-runner-linux-arm64-2.331.0.tar.gz

tar xzf ./actions-runner-linux-arm64-2.331.0.tar.gz
```

---

## Step 4: GitHub からトークンを取得

1. GitHub リポジトリを開く
2. **Settings > Actions > Runners > New self-hosted runner**
3. OS: **Linux** / Architecture: **ARM64** を選択
4. 表示された `--token XXXXX` の値をコピーする

> ⚠️ トークンの有効期限は **1時間**。取得後すぐに次のステップへ

---

## Step 5: Runner を設定

```bash
cd ~/actions-runner

./config.sh \
  --url https://github.com/tobakuro/hackathon_nulabcup \
  --token <Step4で取得したトークン>
```

質問が来たらすべて **Enter** で進める：

```
Runner Group name: [Enter]
Runner name:       [Enter]
Additional labels: [Enter]
Work folder:       [Enter]
```

最後に `Runner successfully added and configured.` と出れば成功。

---

## Step 6: サービスとして登録（再起動後も自動起動）

```bash
cd ~/actions-runner

sudo ./svc.sh install
sudo ./svc.sh start

# 確認
sudo ./svc.sh status
# → Active: active (running) と Connected to GitHub が出ればOK
```

---

## Step 7: ログアウト後もサービスを継続させる

```bash
loginctl enable-linger $USER
```

---

## Step 8: systemd サービスの登録

```bash
cd ~/workspace/hackathon_nulabcup
git pull origin main
bash raspi/setup.sh
```

setup.sh が行うこと：

- `/opt/backend/` ディレクトリの作成
- `~/.config/systemd/user/backend.service` の登録
- `~/.config/systemd/user/frontend.service` の登録
- `systemctl --user enable` で自動起動を有効化

---

## Step 9: DB / Redis の起動

```bash
cd ~/workspace/hackathon_nulabcup
docker compose -f raspi/compose.yml up -d
```

---

## Step 10: GitHub Secrets の登録

リポジトリ → **Settings > Secrets and variables > Actions > New repository secret**

| Secret 名 | 説明 |
|---|---|
| `FRONTEND_GITHUB_ID` | GitHub OAuth Client ID |
| `FRONTEND_GITHUB_SECRET` | GitHub OAuth Client Secret |
| `FRONTEND_AUTH_URL` | 公開 URL（例: `http://nulab.uomi.site`） |
| `FRONTEND_NEXTAUTH_SECRET` | NextAuth 署名用シークレット |
| `FRONTEND_GEMINI_API_KEY` | Gemini API キー |
| `BACKEND_SERVER_PORT` | `8080` |
| `BACKEND_DB_HOST` | `127.0.0.1` |
| `BACKEND_DB_PORT` | `5432` |
| `BACKEND_DB_USER` | `hackathon` |
| `BACKEND_DB_PASSWORD` | DB パスワード |
| `BACKEND_DB_NAME` | `hackathon` |
| `BACKEND_DB_SSLMODE` | `disable` |
| `BACKEND_REDIS_ADDR` | `127.0.0.1:6379` |
| `BACKEND_REDIS_PASSWORD` | （空でよければ空） |
| `BACKEND_REDIS_DB` | `0` |

> `GITHUB_ID` は GitHub Actions の予約変数と衝突するため、Secret 名は `FRONTEND_GITHUB_ID` とする

---

## Step 11: 動作確認

```bash
# Mac 側で frontend/ に変更を加えて push
echo "" >> frontend/README.md
git add frontend/README.md
git commit -m "test: CD動作確認"
git push origin main
```

GitHub の **Actions タブ** で "Deploy to Raspberry Pi" ジョブが動けば完了。

raspi 側でサービス状態を確認：

```bash
systemctl --user status frontend.service backend.service
journalctl --user -u frontend.service -f
```

---

## トラブルシューティング

### `404 Not Found` エラーが出る（config.sh 実行時）

トークンの有効期限切れ。Step 4 からやり直してトークンを再発行する。

### `Cannot configure the runner because it is already configured`

一度削除してから再設定する：

```bash
cd ~/actions-runner

sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token <新しいトークン>

# その後 Step 5〜6 を再実行
```

### `systemctl --user` が D-Bus エラーになる

Runner はシステムサービスとして動くためログインセッションの環境変数がない。
ワークフローの `run:` に以下を追加する：

```yaml
run: |
  export XDG_RUNTIME_DIR=/run/user/$(id -u)
  systemctl --user restart your.service
```

### ジョブが `Waiting for a runner` のまま動かない

`runs-on` のラベルと Runner のラベルが一致していない。
ワークフローの設定を確認する：

```yaml
runs-on: [self-hosted, Linux, ARM64]
```

---

## ワークフローの仕組み

`raspi-deploy.yml` は `dorny/paths-filter` で変更ファイルを検出し、必要なジョブだけ実行する。

| 変更パス | 実行されるジョブ |
|---|---|
| `backend/**`, `raspi/backend.service`, `devbox.json` | `deploy-backend` |
| `frontend/**`, `raspi/frontend.service`, `devbox.json` | `deploy-frontend` |


## サービスの起動・停止は以下のコマンドで行う：
```bash

cd ~/actions-runner

# 1. サービス停止・アンインストール
sudo ./svc.sh stop
sudo ./svc.sh uninstall

# 2. 設定を削除（同じトークンで OK）
./config.sh remove --token BIQBUCGXUUR4ZYUOMEQJT4LJT5CYG

# 3. raspi ラベル付きで再設定（同じトークンで OK）
./config.sh \
  --url https://github.com/tobakuro/hackathon_nulabcup \
  --token BIQBUCGXUUR4ZYUOMEQJT4LJT5CYG \
  --labels raspi

# 4. サービスとして再登録
sudo ./svc.sh install
sudo ./svc.sh start

# 確認
sudo ./svc.sh status
```