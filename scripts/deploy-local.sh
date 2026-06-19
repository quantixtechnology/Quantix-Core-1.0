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

DB_FILE="/home/ubuntu/data/custom.db"
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
# Atomic: write to a tmp file then rename so readers never see a partial file.
status() {
  local step="$1" msg="$2" state="${3:-running}"
  local now duration_sec=0
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  duration_sec=$(( $(date +%s) - START_EPOCH ))
  printf '{"status":"%s","step":"%s","message":"%s","startedAt":"%s","updatedAt":"%s","commit":"%s","durationSeconds":%d}\n' \
    "$state" "$step" "$msg" "$STARTED_AT" "$now" "$COMMIT" "$duration_sec" \
    > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE" || true
}

fail() {
  local msg="${1:-Unexpected error}"
  log "❌ $msg"
  local now duration_sec=0
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  duration_sec=$(( $(date +%s) - START_EPOCH ))
  printf '{"status":"failed","step":"%s","message":"%s","startedAt":"%s","updatedAt":"%s","commit":"%s","durationSeconds":%d}\n' \
    "$CURRENT_STEP" "$msg" "$STARTED_AT" "$now" "$COMMIT" "$duration_sec" \
    > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE" || true
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
BACKUP_DIR="/home/ubuntu/db-backups"
mkdir -p "$BACKUP_DIR"
log "[DB] Path: $DB_FILE"
if [ -f "$DB_FILE" ]; then
  log "[DB] Exists: yes"
  BACKUP="$BACKUP_DIR/custom.db.$(date +%Y%m%d-%H%M%S).bak"
  log "[DB] Backup destination: $BACKUP"
  cp "$DB_FILE" "$BACKUP" || { log "⚠️ DB backup failed, continuing anyway"; true; }
  log "✅ DB backed up → $BACKUP"
  ls -t "$BACKUP_DIR"/custom.db.*.bak 2>/dev/null | tail -n +11 | xargs rm -f || true
else
  log "[DB] Exists: no"
  log "⚠️ Database missing at $DB_FILE. Skipping backup and continuing deployment."
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
# ── Backup running standalone ────────────────────────────────────────────────
# If this build fails, the restore block below puts this copy back so PM2
# keeps serving the previous version.
if [ -d ".next/standalone" ]; then
  rm -rf /tmp/quantix-standalone-prev
  cp -r .next/standalone /tmp/quantix-standalone-prev
  log "Standalone backed up to /tmp/quantix-standalone-prev"
fi

# ── Wipe .next entirely before building ──────────────────────────────────────
# WHY: Next.js file-tracing (outputFileTracingRoot = project root) includes
# every file under the root that isn't explicitly excluded.  A previous
# .next/standalone/ build is itself a full project-tree copy.  If .next/
# is still present when 'next build' runs, the tracer absorbs the old
# standalone into the new one, producing recursive nesting such as:
#   .next/standalone/Quantix-Core-1.0/.next/standalone/Quantix-Core-1.0/…
# That shifts the server.js depth on every deploy, breaks the PM2 args path,
# and causes 'pm2 startOrRestart' to hang because it can't find server.js.
#
# The standalone was backed up above; if the build fails it is restored.
# outputFileTracingExcludes: { '*': ['.next/**', …] } in next.config.js is
# belt-and-braces for direct 'next build' runs that bypass this script.
rm -rf .next
log "Removed previous .next for clean build (standalone backed up)"

# Log the build environment for diagnostics
log "Node $(node --version) | NPM $(npm --version) | ulimit nofile=$(ulimit -n)"

# Run the build inside a completely clean environment.
#
# ROOT CAUSE: Next.js 16 uses Turbopack as the default production bundler.
# Turbopack spawns a build worker (turbopack-build/index.js) that inherits
# the full process.env via worker.js:81 `...process.env`. PM2 injects
# HOSTNAME=0.0.0.0 into the entire process tree. Turbopack's native Rust
# binding uses HOSTNAME for worker-to-main IPC: it binds its server to
# 0.0.0.0 (valid) but then hands that address to sub-workers as the connect
# target (invalid — 0.0.0.0 cannot be used as a connection destination).
# Workers fail to initialise, the native `generate()` callback is never
# registered, and the build throws "TypeError: generate is not a function"
# before any route compilation begins.
#
# THREE-LAYER DEFENCE:
#  1. env -i  — strips HOSTNAME=0.0.0.0 (and all other PM2 vars) so the
#               Turbopack worker never sees the bad address.
#  2. NEXT_TURBOPACK_USE_WORKER=0 — forces Turbopack to run in-process
#               (no worker spawn), bypassing IPC entirely as belt-and-braces.
#  3. next.config.js (CJS) instead of next.config.ts — eliminates the
#               SWC transpilation step at config-load time, removing a second
#               native-binary dependency before Turbopack even starts.
#
# Manual builds succeed because a developer shell never has HOSTNAME=0.0.0.0.
( env -i \
    HOME="/root" \
    USER="root" \
    PATH="$PATH" \
    LANG="en_US.UTF-8" \
    NODE_ENV="production" \
    DATABASE_URL="file:$DB_FILE" \
    NEXT_TELEMETRY_DISABLED="1" \
    NODE_OPTIONS="--max-old-space-size=1536" \
    NEXT_TURBOPACK_USE_WORKER="0" \
    npm run build 2>&1 | tee -a "$LOG_FILE" ) || {
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
# outputFileTracingRoot is set to __dirname (project root) in next.config.js,
# so server.js lands at .next/standalone/server.js with no subdirectory nesting.
# The find is kept dynamic so the deploy survives any future path change.
CURRENT_STEP="assets"
status "assets" "Copying standalone assets"
log ""
log "── Standalone assets ────────────────────────────────────────"
SERVER_JS=$(find "$PROJECT/.next/standalone" -maxdepth 2 -name "server.js" \
  -not -path "*/node_modules/*" 2>/dev/null | head -1)
[ -n "$SERVER_JS" ] || fail "Standalone server.js not found — build may have failed"
STANDALONE="$(dirname "$SERVER_JS")"
log "Standalone dir: $STANDALONE"
# Static assets at the standalone root (where Next.js expects them)
cp -r "$PROJECT/.next/static" "$PROJECT/.next/standalone/.next/" 2>/dev/null || true
cp -r "$PROJECT/public"       "$PROJECT/.next/standalone/"        2>/dev/null || true
# .env written next to server.js so the runtime picks it up regardless of cwd
{
  echo "DATABASE_URL=file:$DB_FILE"
  echo "PORT=3000"
  echo "HOSTNAME=0.0.0.0"
  grep -v "^DATABASE_URL\|^PORT\|^HOSTNAME" "$PROJECT/.env" 2>/dev/null || true
} > "$STANDALONE/.env"
log "✅ Assets + .env written to standalone"

# ─── PM2 restart ───────────────────────────────────────────────────────────────
# Use startOrRestart so ecosystem.config.js is always the source of truth for
# the script path. plain `pm2 restart` keeps the old path; `startOrRestart`
# re-reads the config file, which is what we want after a path change.
CURRENT_STEP="restart"
status "restart" "Restarting app via PM2"
log ""
log "── PM2 ──────────────────────────────────────────────────────"
pm2 startOrRestart "$PROJECT/ecosystem.config.js" --update-env 2>&1 | tee -a "$LOG_FILE" \
  || fail "pm2 restart failed — check: pm2 logs quantix"
pm2 save 2>/dev/null || true
# || true: pm2 list failure must not abort the deploy — the restart already succeeded.
pm2 list 2>&1 | tee -a "$LOG_FILE" || true

# ─── Health check ──────────────────────────────────────────────────────────────
# Retry up to 8 times with 5 s gaps (40 s total window).
# WHY retry: pm2 startOrRestart returns as soon as the process is "online" at
# the PM2 level, but the Next.js standalone may still be binding its port and
# loading modules. A single 15 s sleep was sometimes not enough on a loaded VPS.
# A non-2xx on every attempt fails the deploy. The old standalone is gone at
# this point so we must fail loudly — autorestart will keep trying to serve,
# but CI must know it failed.
CURRENT_STEP="health"
status "health" "Checking app health"
log ""
log "── Health check ─────────────────────────────────────────────"
HTTP="000"
for attempt in 1 2 3 4 5 6 7 8; do
  sleep 5
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    http://localhost:3000 2>/dev/null || echo "000")
  if echo "$HTTP" | grep -qE "^(200|301|302|307|308)$"; then
    log "✅ App healthy (HTTP $HTTP, attempt $attempt)"
    break
  fi
  log "⏳ Attempt $attempt/8 — HTTP $HTTP, retrying…"
  HTTP="000"
done

if [ "$HTTP" = "000" ] || ! echo "$HTTP" | grep -qE "^(200|301|302|307|308)$"; then
  log "❌ Health check failed after 8 attempts (last HTTP $HTTP) — PM2 logs:"
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
  > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"

# ─── Deferred cleanup ──────────────────────────────────────────────────────────
# Give the CI poller 10 minutes to read the success status and logs, then
# clean up /tmp files. Runs as a detached background job so it doesn't block.
# The lock file itself is removed by the EXIT trap above.
(
  sleep 600
  rm -f "$STATUS_FILE" "$LOG_FILE"
) &
disown
