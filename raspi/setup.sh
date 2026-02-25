#!/usr/bin/env bash
# ==============================================================================
# raspi/setup.sh - Raspberry Pi 初回セットアップスクリプト
#
# 使い方（raspi 上で一度だけ実行）:
#   bash <このファイルへのパス>/raspi/setup.sh
#
# このスクリプトが行うこと:
#   1. 必須ツール（devbox, git）の確認・インストール
#   2. loginctl enable-linger でログアウト後もサービス継続
#   3. /opt/backend/ ディレクトリの作成
#   4. devbox パッケージのインストール（nix ストアのウォームアップ）
#   5. systemd user サービスの登録（backend.service, frontend.service）
#   6. GitHub Actions Runner の PATH 設定
#
# 注意:
#   セットアップ後のリポジトリ管理は GitHub Actions Runner が担います。
#   CI が actions-runner/_work/hackathon_nulabcup/ を自動的にチェックアウトします。
# ==============================================================================
set -euo pipefail

# このスクリプト自身の場所を基準にパスを解決する（固定パス不要）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "${SCRIPT_DIR}")"  # raspi/ の親 = リポジトリルート
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

log()  { echo "[setup] $*"; }
die()  { echo "[setup] ERROR: $*" >&2; exit 1; }

# ============================================================
# 1. 必須ツール確認
# ============================================================
log "=== Step 1: 必須ツールの確認 ==="

command -v git &>/dev/null || die "git がインストールされていません"
log "git: OK"

# devbox がなければインストール
if ! command -v devbox &>/dev/null; then
  log "devbox をインストールします..."
  curl -fsSL https://get.jetify.com/devbox | bash
  export PATH="${HOME}/.local/bin:${PATH}"
  command -v devbox &>/dev/null || die "devbox のインストールに失敗しました。シェルを再起動して再実行してください"
fi
log "devbox: $(devbox version)"

# systemd user セッションの確認
systemctl --user status &>/dev/null || die "systemd user セッションが利用できません"
log "systemd user session: OK"

# ============================================================
# 2. ログアウト後もサービスを継続させる
# ============================================================
log "=== Step 2: loginctl linger の有効化 ==="
loginctl enable-linger "${USER}"
log "linger 有効化: OK"

# ============================================================
# 3. バックエンドバイナリ用ディレクトリの作成
# ============================================================
log "=== Step 3: /opt/backend ディレクトリの作成 ==="
if [ ! -d "/opt/backend" ]; then
  sudo mkdir -p /opt/backend
  sudo chown "${USER}:${USER}" /opt/backend
  log "/opt/backend を作成しました"
else
  log "/opt/backend はすでに存在します（オーナーと書き込み権限を確認します）"
  sudo chown "${USER}:${USER}" /opt/backend
  test -w /opt/backend || die "/opt/backend への書き込み権限がありません"
  log "/opt/backend の権限: OK"
fi

# ============================================================
# 4. devbox パッケージのインストール（nix ストアのウォームアップ）
# ============================================================
log "=== Step 4: devbox パッケージのインストール ==="
log "（初回は時間がかかります...）"
cd "${REPO_DIR}"
devbox install
log "devbox パッケージ: インストール完了"
log "（CI 実行時は actions-runner/_work/ 配下で自動的にセットアップされます）"

# ============================================================
# 5. systemd user サービスの登録
# ============================================================
log "=== Step 5: systemd user サービスの登録 ==="
mkdir -p "${SYSTEMD_USER_DIR}"

cp "${SCRIPT_DIR}/backend.service" "${SYSTEMD_USER_DIR}/backend.service"
log "backend.service をコピーしました"

cp "${SCRIPT_DIR}/frontend.service" "${SYSTEMD_USER_DIR}/frontend.service"
log "frontend.service をコピーしました"

# systemd にサービスを認識させる
systemctl --user daemon-reload
systemctl --user enable backend.service
systemctl --user enable frontend.service
log "サービスを有効化しました"

# ============================================================
# 6. GitHub Actions Runner の PATH 設定
# ============================================================
log "=== Step 6: GitHub Actions Runner の PATH 設定 ==="
RUNNER_ENV_FILE="${HOME}/actions-runner/.env"
if [ -d "${HOME}/actions-runner" ]; then
  # devbox の PATH を runner 環境に追加
  if ! grep -q "\.local/bin" "${RUNNER_ENV_FILE}" 2>/dev/null; then
    echo "PATH=${HOME}/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> "${RUNNER_ENV_FILE}"
    log "Runner の .env に PATH を追加しました"
    log "Runner を再起動してください: sudo ~/actions-runner/svc.sh restart"
  else
    log "Runner .env に devbox の PATH はすでに設定されています"
  fi
else
  log "GitHub Actions Runner がまだインストールされていません"
  log "GitHub リポジトリ Settings > Actions > Runners からセットアップしてください"
fi

# ============================================================
# 完了メッセージ
# ============================================================
log ""
log "=== セットアップ完了！ ==="
log ""
log "【次のステップ】"
log "1. GitHub リポジトリに Secrets を登録:"
log "   FRONTEND_GITHUB_ID, FRONTEND_GITHUB_SECRET, FRONTEND_AUTH_URL"
log "   FRONTEND_NEXTAUTH_SECRET, FRONTEND_GEMINI_API_KEY"
log "   BACKEND_SERVER_PORT, BACKEND_DB_HOST, BACKEND_DB_PORT"
log "   BACKEND_DB_USER, BACKEND_DB_PASSWORD, BACKEND_DB_NAME, BACKEND_DB_SSLMODE"
log "   BACKEND_REDIS_ADDR, BACKEND_REDIS_PASSWORD, BACKEND_REDIS_DB"
log ""
log "2. GitHub Actions Runner のセットアップ（未済の場合）:"
log "   GitHub リポジトリ Settings > Actions > Runners > New self-hosted runner"
log "   OS: Linux / Architecture: ARM64"
log ""
log "3. Runner をサービスとして登録:"
log "   cd ~/actions-runner && sudo ./svc.sh install && sudo ./svc.sh start"
log ""
log "4. main ブランチに push すると CD が動作します"
log "   （リポジトリは actions-runner/_work/ に自動チェックアウトされます）"
log ""
log "5. サービス状態の確認:"
log "   systemctl --user status backend.service frontend.service"
log "   journalctl --user -u frontend.service -f"
