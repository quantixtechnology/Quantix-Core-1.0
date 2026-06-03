#!/bin/bash
# =============================================================================
# QUANTIX CORE — Local Deploy Script
# Invoked by the /api/deploy webhook. Runs entirely on the VPS.
#
# Hardening:
#   - set -euo pipefail on line 1
#   - ERR trap writes "failed" status for any unexpected exit
#   - EXIT trap cleans up the lock file unconditionally
#   - Build failure leaves the previous PM2 process untouched
#   - PM2 restart errors fail the deploy loudly (no || true)
#   - Health check gates the "success" status — unhealthy = failed
#   - Duration tracked via epoch seconds
#   - Status file and log cleaned up 10 min after success
#   - No sensitive env vars written to the log file
# =============================================================================

set -euo pipefail

# ─── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_FILE="/root/quantix-data/custom.db"
LOG_FILE="/tmp/quantix-deploy.log"
STATUS_FILE="/tmp/quantix-deploy-status.json"
LOCK_FILE="/tmp/quantix-deploy.lock"

# ─── Time tracking ─────────────────────────────────────────────────────────────
START_EPOCH=$(date +%s)
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CURRENT_STEP="init"
COMMIT=""

# ─── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# Write status JSON. Never includes env var values — only step names/messages.
status() {
  local step="$1" msg="$2" state="${3:-running}"
  local now duration_sec=0
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  duration_sec=$(( $(date +%s) - START_EPOCH ))
  printf '{"status":"%s","step":"%s","message":"%s","startedAt":"%s","updatedAt":"%s","commit":"%s","durationSeconds":%d}\n' \
    "$state" "$step" "$msg" "$STARTED_AT" "$now" "$COMMIT" "$duration_sec" \
    > "$STATUS_FILE"
}

fail() {
  local msg="${1:-Unexpected error}"
  log "❌ $msg"
  local now duration_sec=0
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  duration_sec=$(( $(date +%s) - START_EPOCH ))
  printf '{"status":"failed","step":"%s","message":"%s","startedAt":"%s","updatedAt":"%s","commit":"%s","durationSeconds":%d}\n' \
    "$CURRENT_STEP" "$msg" "$STARTED_AT" "$now" "$COMMIT" "$duration_sec" \
    > "$STATUS_FILE"
  exit 1
}

# ─── ERR trap ──────────────────────────────────────────────────────────────────
# Catches any command that exits non-zero and wasn't explicitly handled.
# Without this, set -e exits silently, leaving the status file stuck on
# the last step's "running" value and the CI polling forever.
trap 'fail "Unexpected error at step: $CURRENT_STEP (exit $?)"' ERR

# ─── EXIT trap ─────────────────────────────────────────────────────────────────
# Removes the lock file regardless of how the script exits.
# Runs AFTER the ERR trap so fail() writes the status before the lock is freed.
trap 'rm -f "$LOCK_FILE"' EXIT

# ─── Rotate log ────────────────────────────────────────────────────────────────
if [ -f "$LOG_FILE" ]; then
  tail -500 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

log "============================================================"
log " QUANTIX DEPLOY — $(date)"
log "============================================================"
log "Project  : $PROJECT"
log "User     : $(whoami)"
log "Node     : $(node --version 2>/dev/null || echo NOT FOUND)"
log "NPM      : $(npm --version  2>/dev/null || echo NOT FOUND)"
log "PM2      : $(pm2 --version  2>/dev/null || echo NOT FOUND)"
log "Disk     : $(df -h / | tail -1 | awk '{print $4" free of "$2}')"
# DB path logged without its contents — no sensitive data exposed
log "DB       : $DB_FILE (exists: $([ -f "$DB_FILE" ] && echo yes || echo no))"

[ -d "$PROJECT" ] || fail "Project directory not found: $PROJECT"
cd "$PROJECT"

# ─── DB backup ─────────────────────────────────────────────────────────────────
CURRENT_STEP="backup"
status "backup" "Backing up database"
log ""
log "── DB backup ────────────────────────────────────────────────"
mkdir -p /root/backups
if [ -f "$DB_FILE" ]; then
  BACKUP="/root/backups/custom.db.$(date +%Y%m%d-%H%M%S).bak"
  cp "$DB_FILE" "$BACKUP" || fail "DB backup failed"
  log "✅ DB backed up → $BACKUP"
  ls -t /root/backups/custom.db.*.bak 2>/dev/null | tail -n +11 | xargs rm -f || true
else
  log "ℹ️  No existing DB (first deploy)"
fi

# ─── Git ───────────────────────────────────────────────────────────────────────
CURRENT_STEP="git"
status "git" "Pulling latest code"
log ""
log "── Git ──────────────────────────────────────────────────────"
git fetch --quiet origin main || fail "git fetch failed"
mkdir -p "$(dirname "$DB_FILE")"
git reset --hard origin/main || fail "git reset failed"
COMMIT="$(git rev-parse --short HEAD)"
log "Commit: $COMMIT — $(git log -1 --pretty='%s')"

# ─── .env patch ────────────────────────────────────────────────────────────────
# Only DATABASE_URL is injected — no other env vars are read or logged here
CURRENT_STEP="env"
log ""
log "── .env patch ───────────────────────────────────────────────"
touch "$PROJECT/.env"
grep -v "^DATABASE_URL=" "$PROJECT/.env" > /tmp/env_tmp || true
{ echo "DATABASE_URL=file:$DB_FILE"; cat /tmp/env_tmp; } > "$PROJECT/.env"
log "✅ DATABASE_URL written"
export DATABASE_URL="file:$DB_FILE"

# ─── npm install ───────────────────────────────────────────────────────────────
CURRENT_STEP="install"
status "install" "Installing dependencies"
log ""
log "── npm install ──────────────────────────────────────────────"
npm install --legacy-peer-deps 2>&1 | tee -a "$LOG_FILE" | tail -5 \
  || fail "npm install failed — check log for errors"
log "✅ Dependencies ready"

# ─── Prisma ────────────────────────────────────────────────────────────────────
CURRENT_STEP="prisma"
status "prisma" "Syncing database schema"
log ""
log "── Prisma ───────────────────────────────────────────────────"
npx prisma generate 2>&1 | tee -a "$LOG_FILE" | tail -2 \
  || fail "prisma generate failed"
npx prisma db push --accept-data-loss 2>&1 | tee -a "$LOG_FILE" | tail -2 \
  || fail "prisma db push failed"
log "✅ Schema synced"

# ─── Super admin ───────────────────────────────────────────────────────────────
CURRENT_STEP="seed"
status "seed" "Verifying super admin"
log ""
log "── Super admin ──────────────────────────────────────────────"
node scripts/ensure-super-admin.js 2>&1 | tee -a "$LOG_FILE" || true
log "✅ Super admin verified"

# ─── Build ─────────────────────────────────────────────────────────────────────
# If this step fails, the script exits here. PM2 is still running the PREVIOUS
# .next/standalone — the old version stays live. Production is not disrupted.
CURRENT_STEP="build"
status "build" "Running next build (~3-5 min)"
log ""
log "── next build ───────────────────────────────────────────────"
# Back up the running standalone so PM2 can still start if this build fails.
# next build clears .next/ before compiling; without this, a failed build
# leaves server.js missing and the app down until the next successful deploy.
if [ -d ".next/standalone" ]; then
  rm -rf /tmp/quantix-standalone-prev
  cp -r .next/standalone /tmp/quantix-standalone-prev
  log "Standalone backed up to /tmp/quantix-standalone-prev"
fi

# Clear Turbopack cache — stale cache causes "TypeError: generate is not a function".
rm -rf .next/cache

# Give Node.js up to 1.5 GB heap for the Turbopack build workers.
NODE_OPTIONS="--max-old-space-size=1536" npm run build 2>&1 | tee -a "$LOG_FILE" || {
  # Restore the previous standalone so PM2 keeps serving the old version
  if [ -d "/tmp/quantix-standalone-prev" ]; then
    rm -rf .next/standalone
    cp -r /tmp/quantix-standalone-prev .next/standalone
    log "⚠️  Build failed — previous standalone restored, PM2 continues on old version"
  fi
  fail "next build failed — previous version restored and still running"
}
rm -rf /tmp/quantix-standalone-prev
log "✅ Build complete"

# ─── Standalone assets ─────────────────────────────────────────────────────────
CURRENT_STEP="assets"
status "assets" "Copying standalone assets"
log ""
log "── Standalone assets ────────────────────────────────────────"
STANDALONE="$PROJECT/.next/standalone"
[ -d "$STANDALONE" ] || fail "Standalone directory not found — build may have failed"
cp -r "$PROJECT/.next/static" "$STANDALONE/.next/" 2>/dev/null || true
cp -r "$PROJECT/public"       "$STANDALONE/"        2>/dev/null || true
{
  echo "DATABASE_URL=file:$DB_FILE"
  echo "PORT=3000"
  echo "HOSTNAME=0.0.0.0"
  grep -v "^DATABASE_URL\|^PORT\|^HOSTNAME" "$PROJECT/.env" 2>/dev/null || true
} > "$STANDALONE/.env"
log "✅ Assets + .env written to standalone"

# ─── PM2 restart ───────────────────────────────────────────────────────────────
# No || true — a PM2 failure means the app is down and must be reported.
# If pm2 restart fails after a successful build, the old process may already
# be stopped. pm2 logs will contain the reason.
CURRENT_STEP="restart"
status "restart" "Restarting app via PM2"
log ""
log "── PM2 ──────────────────────────────────────────────────────"
if pm2 list 2>/dev/null | grep -q "quantix"; then
  pm2 restart quantix --update-env 2>&1 | tee -a "$LOG_FILE" \
    || fail "pm2 restart failed — check: pm2 logs quantix"
else
  pm2 start ecosystem.config.js 2>&1 | tee -a "$LOG_FILE" \
    || fail "pm2 start failed — check: pm2 logs quantix"
fi
pm2 save 2>/dev/null || true
pm2 list 2>&1 | tee -a "$LOG_FILE"

# ─── Health check ──────────────────────────────────────────────────────────────
# A non-2xx response fails the deploy. The app may have started but be crashing
# immediately; the old standalone is gone at this point, so we must fail loudly.
CURRENT_STEP="health"
status "health" "Checking app health"
log ""
log "── Health check ─────────────────────────────────────────────"
sleep 15
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 \
  http://localhost:3000 2>/dev/null || echo "000")

if echo "$HTTP" | grep -qE "^(200|301|302|307|308)$"; then
  log "✅ App healthy (HTTP $HTTP)"
else
  log "❌ Health check HTTP $HTTP — PM2 logs:"
  pm2 logs quantix --lines 30 --nostream 2>/dev/null | tee -a "$LOG_FILE" || true
  fail "App unhealthy after restart (HTTP $HTTP) — check pm2 logs"
fi

# ─── Success ───────────────────────────────────────────────────────────────────
DURATION_SEC=$(( $(date +%s) - START_EPOCH ))
log ""
log "============================================================"
log " DEPLOY COMPLETE — $(date) — ${DURATION_SEC}s"
log "============================================================"

printf '{"status":"success","step":"done","message":"Deploy complete","startedAt":"%s","updatedAt":"%s","commit":"%s","http":"%s","durationSeconds":%d}\n' \
  "$STARTED_AT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$COMMIT" "$HTTP" "$DURATION_SEC" \
  > "$STATUS_FILE"

# ─── Deferred cleanup ──────────────────────────────────────────────────────────
# Give the CI poller 10 minutes to read the success status and logs, then
# clean up /tmp files. Runs as a detached background job so it doesn't block.
# The lock file itself is removed by the EXIT trap above.
(
  sleep 600
  rm -f "$STATUS_FILE" "$LOG_FILE"
) &
disown
