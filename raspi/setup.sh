#!/usr/bin/env bash
# ==============================================================================
# raspi/setup.sh - Raspberry Pi 初回セットアップスクリプト
#
# 使い方（raspi 上で一度だけ実行）:
#   bash <このファイルへのパス>/raspi/setup.sh
#
# このスクリプトが行うこと:
#   1. 必須ツール（docker, git）の確認
#   2. Docker Compose の動作確認
#   3. 旧 systemd サービスの無効化（存在する場合）
#
# 注意:
#   セットアップ後のリポジトリ管理は GitHub Actions Runner が担います。
#   CI が actions-runner/_work/hackathon_nulabcup/ を自動的にチェックアウトします。
# ==============================================================================
set -euo pipefail

log()  { echo "[setup] $*"; }
die()  { echo "[setup] ERROR: $*" >&2; exit 1; }

# ============================================================
# 1. 必須ツールの確認
# ============================================================
log "=== Step 1: 必須ツールの確認 ==="

command -v git &>/dev/null || die "git がインストールされていません"
log "git: OK"

command -v docker &>/dev/null || die "docker がインストールされていません。https://docs.docker.com/engine/install/debian/ を参照してください"
log "docker: $(docker --version)"

# ============================================================
# 2. Docker Compose の動作確認
# ============================================================
log "=== Step 2: Docker Compose の動作確認 ==="

docker compose version &>/dev/null || die "docker compose が利用できません。Docker Engine 20.10+ をインストールしてください"
log "docker compose: $(docker compose version --short)"

# 現在のユーザーが docker グループに所属しているか確認
if ! docker info &>/dev/null; then
  log "docker コマンドに権限がありません。以下を実行してください:"
  log "  sudo usermod -aG docker \${USER}"
  log "  newgrp docker"
  die "docker の権限を設定してから再実行してください"
fi
log "docker 権限: OK"

# ============================================================
# 3. 旧 systemd サービスの無効化（存在する場合）
# ============================================================
log "=== Step 3: 旧 systemd サービスの無効化 ==="
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

for svc in backend.service frontend.service; do
  if [ -f "${SYSTEMD_USER_DIR}/${svc}" ]; then
    export XDG_RUNTIME_DIR="/run/user/$(id -u)"
    systemctl --user stop "${svc}" 2>/dev/null || true
    systemctl --user disable "${svc}" 2>/dev/null || true
    rm -f "${SYSTEMD_USER_DIR}/${svc}"
    log "${svc} を無効化・削除しました"
  else
    log "${svc} は存在しません（スキップ）"
  fi
done
systemctl --user daemon-reload 2>/dev/null || true

# ============================================================
# 完了メッセージ
# ============================================================
log ""
log "=== セットアップ完了！ ==="
log ""
log "【次のステップ】"
log "1. GitHub リポジトリに Secrets を登録:"
log "   FRONTEND_GITHUB_ID, FRONTEND_GITHUB_SECRET, FRONTEND_AUTH_URL"
log "   FRONTEND_NEXTAUTH_SECRET, FRONTEND_GEMINI_API_KEY, FRONTEND_DATABASE_URL"
log "   BACKEND_SERVER_PORT, BACKEND_DB_HOST (= postgres), BACKEND_DB_PORT"
log "   BACKEND_DB_USER, BACKEND_DB_PASSWORD, BACKEND_DB_NAME, BACKEND_DB_SSLMODE"
log "   BACKEND_REDIS_ADDR (= redis:6379), BACKEND_REDIS_PASSWORD, BACKEND_REDIS_DB"
log ""
log "2. GitHub Actions Runner のセットアップ（未済の場合）:"
log "   GitHub リポジトリ Settings > Actions > Runners > New self-hosted runner"
log "   OS: Linux / Architecture: ARM64"
log ""
log "3. Runner をサービスとして登録:"
log "   cd ~/actions-runner && sudo ./svc.sh install && sudo ./svc.sh start"
log ""
log "4. main ブランチに push すると CD が動作します"
log "   docker compose で全サービスが自動的に起動します"
log ""
log "5. サービス状態の確認:"
log "   docker compose -f raspi/compose.yml ps"
log "   docker compose -f raspi/compose.yml logs -f"
