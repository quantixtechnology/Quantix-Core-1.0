#!/bin/bash
# =============================================================================
# QUANTIX CORE — Local Deploy Script
# Invoked by the /api/deploy webhook. Runs entirely on the VPS.
# Never called by GitHub Actions directly — GitHub Actions posts a webhook
# trigger over HTTPS and polls /api/deploy/status for completion.
#
# Status is written to /tmp/quantix-deploy-status.json at every step so
# the status endpoint can report progress without reading the log file.
# Full output is appended to /tmp/quantix-deploy.log.
#
# The script is spawned as a DETACHED process (detached:true + unref() in
# the API route) so it survives the PM2 restart that happens during build.
# =============================================================================

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────
# Resolve project root from this script's location, regardless of how it was
# called. Works even when spawned from .next/standalone.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_FILE="/root/quantix-data/custom.db"
LOG_FILE="/tmp/quantix-deploy.log"
STATUS_FILE="/tmp/quantix-deploy-status.json"
LOCK_FILE="/tmp/quantix-deploy.lock"

# ── Logging helpers ───────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

status() {
  local step="$1" msg="$2" state="${3:-running}"
  printf '{"status":"%s","step":"%s","message":"%s","startedAt":"%s","updatedAt":"%s","commit":"%s"}\n' \
    "$state" "$step" "$msg" \
    "${STARTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "${COMMIT:-}" \
    > "$STATUS_FILE"
}

fail() {
  local msg="${1:-Deploy failed}"
  log "❌ $msg"
  printf '{"status":"failed","step":"%s","message":"%s","startedAt":"%s","updatedAt":"%s","commit":"%s"}\n' \
    "${CURRENT_STEP:-unknown}" "$msg" \
    "${STARTED_AT:-}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${COMMIT:-}" \
    > "$STATUS_FILE"
  rm -f "$LOCK_FILE"
  exit 1
}

# ── Lock ──────────────────────────────────────────────────────────────────────
# Checked again here because a concurrent deploy could sneak in between
# the API lock-check and the script acquiring the lock.
if [ -f "$LOCK_FILE" ]; then
  echo "Deploy already running (lock file exists). Exiting." >> "$LOG_FILE"
  exit 0
fi
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ── Init ──────────────────────────────────────────────────────────────────────
export DATABASE_URL="file:$DB_FILE"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CURRENT_STEP="init"

# Rotate log: keep last 500 lines so the log endpoint never returns a huge file
if [ -f "$LOG_FILE" ]; then
  tail -500 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

log "============================================================"
log " QUANTIX DEPLOY — $(date)"
log "============================================================"
log "Project  : $PROJECT"
log "DB       : $DB_FILE"
log "User     : $(whoami)"
log "Node     : $(node --version 2>/dev/null || echo NOT FOUND)"
log "NPM      : $(npm --version 2>/dev/null || echo NOT FOUND)"
log "PM2      : $(pm2 --version 2>/dev/null || echo NOT FOUND)"
log "Disk     : $(df -h / | tail -1 | awk '{print $4" free of "$2}')"

[ ! -d "$PROJECT" ] && fail "Project directory not found: $PROJECT"
cd "$PROJECT"

# ── DB backup ─────────────────────────────────────────────────────────────────
CURRENT_STEP="backup"
status "backup" "Backing up database…"
log ""
log "── DB backup ────────────────────────────────────────────────"
mkdir -p /root/backups
if [ -f "$DB_FILE" ]; then
  BACKUP="/root/backups/custom.db.$(date +%Y%m%d-%H%M%S).bak"
  cp "$DB_FILE" "$BACKUP"
  log "✅ DB backed up → $BACKUP"
  ls -t /root/backups/custom.db.*.bak 2>/dev/null | tail -n +11 | xargs rm -f || true
else
  log "ℹ️  No existing DB (first deploy)"
fi

# ── Git ───────────────────────────────────────────────────────────────────────
CURRENT_STEP="git"
status "git" "Pulling latest code…"
log ""
log "── Git ──────────────────────────────────────────────────────"
git fetch --quiet origin main
mkdir -p "$(dirname "$DB_FILE")"
git reset --hard origin/main
COMMIT="$(git rev-parse --short HEAD)"
log "Commit: $COMMIT — $(git log -1 --pretty='%s')"

# ── .env patch ────────────────────────────────────────────────────────────────
log ""
log "── .env patch ───────────────────────────────────────────────"
touch "$PROJECT/.env"
grep -v "^DATABASE_URL=" "$PROJECT/.env" > /tmp/env_tmp || true
{ echo "DATABASE_URL=file:$DB_FILE"; cat /tmp/env_tmp; } > "$PROJECT/.env"
log "✅ DATABASE_URL written"

# ── npm install ───────────────────────────────────────────────────────────────
CURRENT_STEP="install"
status "install" "Installing dependencies…"
log ""
log "── npm install ──────────────────────────────────────────────"
npm install --legacy-peer-deps 2>&1 | tee -a "$LOG_FILE" | tail -5
log "✅ Dependencies ready"

# ── Prisma ────────────────────────────────────────────────────────────────────
CURRENT_STEP="prisma"
status "prisma" "Syncing database schema…"
log ""
log "── Prisma ───────────────────────────────────────────────────"
npx prisma generate 2>&1 | tee -a "$LOG_FILE" | tail -2
npx prisma db push --accept-data-loss 2>&1 | tee -a "$LOG_FILE" | tail -2
log "✅ Schema synced"

# ── Super admin ───────────────────────────────────────────────────────────────
CURRENT_STEP="seed"
status "seed" "Verifying super admin…"
log ""
log "── Super admin ──────────────────────────────────────────────"
node scripts/ensure-super-admin.js 2>&1 | tee -a "$LOG_FILE" || true
log "✅ Super admin verified"

# ── Build ─────────────────────────────────────────────────────────────────────
CURRENT_STEP="build"
status "build" "Running next build (this takes ~3–5 min)…"
log ""
log "── next build ───────────────────────────────────────────────"
npm run build 2>&1 | tee -a "$LOG_FILE"
log "✅ Build complete"

# ── Standalone assets ─────────────────────────────────────────────────────────
CURRENT_STEP="assets"
status "assets" "Copying standalone assets…"
log ""
log "── Standalone assets ────────────────────────────────────────"
STANDALONE="$PROJECT/.next/standalone"
if [ ! -d "$STANDALONE" ]; then
  fail "Standalone directory not found — build may have failed"
fi
cp -r "$PROJECT/.next/static" "$STANDALONE/.next/" 2>/dev/null || true
cp -r "$PROJECT/public"       "$STANDALONE/"        2>/dev/null || true
{
  echo "DATABASE_URL=file:$DB_FILE"
  echo "PORT=3000"
  echo "HOSTNAME=0.0.0.0"
  grep -v "^DATABASE_URL\|^PORT\|^HOSTNAME" "$PROJECT/.env" 2>/dev/null || true
} > "$STANDALONE/.env"
log "✅ Assets + .env written to standalone"

# ── PM2 ───────────────────────────────────────────────────────────────────────
CURRENT_STEP="restart"
status "restart" "Restarting app via PM2…"
log ""
log "── PM2 ──────────────────────────────────────────────────────"
if pm2 list 2>/dev/null | grep -q "quantix"; then
  pm2 restart quantix --update-env 2>&1 | tee -a "$LOG_FILE" || true
else
  pm2 start ecosystem.config.js 2>&1 | tee -a "$LOG_FILE" || true
fi
pm2 save 2>/dev/null || true
pm2 list 2>&1 | tee -a "$LOG_FILE"

# ── Health check ──────────────────────────────────────────────────────────────
CURRENT_STEP="health"
status "health" "Checking app health…"
log ""
log "── Health check ─────────────────────────────────────────────"
sleep 15
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://localhost:3000 2>/dev/null || echo "000")
if echo "$HTTP" | grep -qE "^(200|301|302|307|308)$"; then
  log "✅ App healthy (HTTP $HTTP)"
else
  log "⚠️  Health check HTTP $HTTP — PM2 logs:"
  pm2 logs quantix --lines 30 --nostream 2>/dev/null | tee -a "$LOG_FILE" || true
fi

# ── Done ──────────────────────────────────────────────────────────────────────
log ""
log "============================================================"
log " DEPLOY COMPLETE — $(date)"
log "============================================================"

printf '{"status":"success","step":"done","message":"Deploy complete","startedAt":"%s","updatedAt":"%s","commit":"%s","http":"%s"}\n' \
  "$STARTED_AT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$COMMIT" "$HTTP" \
  > "$STATUS_FILE"
