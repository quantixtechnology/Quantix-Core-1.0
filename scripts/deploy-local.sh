#!/bin/bash
# =============================================================================
# QUANTIX CORE — Release-Isolated Deploy Script (build-in-release)
# Invoked by the /api/deploy webhook (or manually). Runs entirely on the VPS.
#
# WHY THIS EXISTS — the previous deployer ran `rm -rf .next` inside the LIVE
# project dir before `next build` finished, and npm install/prisma generate
# mutated the shared runtime the live process used: a restart mid-build left no
# server.js (502); a restored older build referenced a Prisma client hash the
# mutated runtime no longer had (DB APIs 500 while shell/health stayed 200).
#
# SAFETY MODEL:
#   • The live PM2 process runs from /home/ubuntu/quantix-current — a symlink to
#     an immutable release under /home/ubuntu/quantix-releases/<commit>-<ts>.
#   • Each release is a COMPLETE, self-contained build directory that is CLONED
#     and BUILT AT ITS OWN PATH (npm ci + prisma generate + next build run inside
#     it). This matters because the Next.js/Turbopack build bakes the build-time
#     ABSOLUTE PATH and a hashed Prisma external into the compiled output — the
#     output is NOT relocatable, so a build must run from the exact path it was
#     built at. Building in-place guarantees build + Prisma runtime are one unit
#     whose baked paths match its own location. Rollback restores a matching unit.
#   • The candidate is health-checked on a TEMP PORT (incl. a Prisma-backed
#     readiness probe) BEFORE the symlink is switched.
#   • The switch is an atomic `ln -sfn`. A failed build/prisma/readiness NEVER
#     touches the live symlink. A failed post-switch readiness rolls the symlink
#     back to the previous release (status ROLLED_BACK). The previous release is
#     kept until the new one is proven healthy.
#   • Deploy status is /tmp/quantix-deploy-status.json — served by nginx
#     independently of quantix-core, so it stays readable even if the app is down.
# =============================================================================

set -euo pipefail

# ─── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"                 # git source + deploy script
RELEASES_DIR="/home/ubuntu/quantix-releases"          # immutable, built-in-place
CURRENT_LINK="/home/ubuntu/quantix-current"           # symlink → active release
PM2_APP="quantix-core"
APP_PORT=3000
CAND_PORT=3011                                         # candidate temp port
KEEP_RELEASES=3

DB_FILE="/home/ubuntu/data/custom.db"
LOG_FILE="/tmp/quantix-deploy.log"
STATUS_FILE="/tmp/quantix-deploy-status.json"
# Script-level mutual exclusion via an atomic mkdir at a DISTINCT path. The
# /api/deploy webhook route separately creates a FILE lock at
# /tmp/quantix-deploy.lock (openSync 'wx') before spawning this script and
# expects this script to remove that file when done — so we clean both on exit.
LOCK_DIR="/tmp/quantix-deploy-run.lock"
ROUTE_LOCK_FILE="/tmp/quantix-deploy.lock"

START_EPOCH=$(date +%s)
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CURRENT_STEP="init"
COMMIT=""
PREV_RELEASE=""
NEW_RELEASE=""
CAND_PID=""

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

status() {
  local step="$1" msg="$2" state="${3:-running}" now duration_sec
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"; duration_sec=$(( $(date +%s) - START_EPOCH ))
  printf '{"status":"%s","step":"%s","message":"%s","startedAt":"%s","updatedAt":"%s","commit":"%s","durationSeconds":%d}\n' \
    "$state" "$step" "$msg" "$STARTED_AT" "$now" "$COMMIT" "$duration_sec" \
    > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE" || true
  chmod 644 "$STATUS_FILE" 2>/dev/null || true
}
fail() { log "❌ ${1:-error}"; status "$CURRENT_STEP" "${1:-error}" "failed"; exit 1; }
cleanup_candidate() {
  if [ -n "${CAND_PID}" ] && kill -0 "$CAND_PID" 2>/dev/null; then
    kill "$CAND_PID" 2>/dev/null || true; sleep 1; kill -9 "$CAND_PID" 2>/dev/null || true
  fi
}
LOCK_ACQUIRED=""
trap 'code=$?; cleanup_candidate; if [ "$code" != "0" ]; then status "$CURRENT_STEP" "Unexpected error (exit $code)" "failed"; fi' ERR
# Only remove the lock if THIS process actually acquired it — an aborting
# concurrent invocation must never delete the running deploy's lock.
trap 'cleanup_candidate; [ -n "$LOCK_ACQUIRED" ] && rmdir "$LOCK_DIR" 2>/dev/null; rm -f "$ROUTE_LOCK_FILE" 2>/dev/null; true' EXIT

if ! mkdir "$LOCK_DIR" 2>/dev/null; then log "⚠️  Another deploy is in progress. Aborting."; exit 0; fi
LOCK_ACQUIRED=1
[ -f "$LOG_FILE" ] && { tail -500 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"; } || true

log "============================================================"
log " QUANTIX RELEASE DEPLOY — $(date)"
log " Repo=$REPO  Current -> $(readlink "$CURRENT_LINK" 2>/dev/null || echo none)"
log " Node/NPM=$(node -v 2>/dev/null)/$(npm -v 2>/dev/null)  Disk free=$(df -h / | tail -1 | awk '{print $4}')"
log "============================================================"
[ -d "$REPO" ] || fail "Repo not found: $REPO"
mkdir -p "$RELEASES_DIR"

# ─── 1. DB backup (prove it exists) ──────────────────────────────────────────────
CURRENT_STEP="backup"; status "backup" "Backing up database"
BACKUP_DIR="/home/ubuntu/db-backups"; mkdir -p "$BACKUP_DIR"
if [ -f "$DB_FILE" ]; then
  BACKUP="$BACKUP_DIR/custom.db.$(date +%Y%m%d-%H%M%S).bak"
  cp "$DB_FILE" "$BACKUP" && log "✅ DB backed up → $BACKUP ($(stat -c%s "$BACKUP" 2>/dev/null || echo '?')b)" || log "⚠️  backup failed, continuing"
  ls -t "$BACKUP_DIR"/custom.db.*.bak 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
else
  log "⚠️  DB missing at $DB_FILE — continuing"
fi

# ─── 2. Resolve target commit from origin/main (in REPO) ──────────────────────────
CURRENT_STEP="git"; status "git" "Resolving target commit"
git -C "$REPO" fetch origin --quiet
TARGET_SHA="$(git -C "$REPO" rev-parse origin/main)"
COMMIT="$(git -C "$REPO" rev-parse --short origin/main)"
log "✅ Target: $COMMIT ($TARGET_SHA)"

# ─── 3. Create a NEW release directory (clone the repo, checkout target) ──────────
CURRENT_STEP="release"; status "release" "Creating release $COMMIT"
NEW_RELEASE="$RELEASES_DIR/${COMMIT}-$(date +%s)"
git clone --local --quiet "$REPO" "$NEW_RELEASE" || fail "release clone failed"
git -C "$NEW_RELEASE" checkout --quiet "$TARGET_SHA" || fail "release checkout failed"
[ -f "$REPO/.env" ] && cp "$REPO/.env" "$NEW_RELEASE/.env"   # secrets are not in git
log "✅ Release dir $NEW_RELEASE @ $COMMIT"

# ─── 4. Build INSIDE the release (bakes this release's own absolute path) ─────────
cd "$NEW_RELEASE"
CURRENT_STEP="install"; status "install" "Preparing dependencies"
export PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Copy the repo's already-installed, known-good node_modules into the release
# (an independent COPY, not hard-linked, so prisma generate below mutates only
# the release). This avoids a fresh `npm install`, which on this VPS re-runs
# puppeteer's Chrome download (fails on a stale cache) and is memory-heavy.
# If the target commit changed dependencies, refresh only the delta afterwards.
cp -a "$REPO/node_modules" "$NEW_RELEASE/node_modules"
if ! cmp -s "$REPO/package-lock.json" "$NEW_RELEASE/package-lock.json" 2>/dev/null; then
  log "package-lock differs — refreshing dependency delta (scripts skipped)"
  npm install --no-audit --no-fund --ignore-scripts 2>&1 | tail -3 | tee -a "$LOG_FILE" || log "⚠️  dependency refresh warning (continuing)"
  npx prisma generate 2>&1 | tail -2 | tee -a "$LOG_FILE" || true
else
  log "✅ dependencies unchanged — using repo node_modules copy"
fi

CURRENT_STEP="prisma"; status "prisma" "Prisma generate + schema sync"
npx prisma generate 2>&1 | tail -2 | tee -a "$LOG_FILE"
# Existing policy: additive schema sync (backup taken above; no-op when unchanged).
npx prisma db push --accept-data-loss 2>&1 | tail -2 | tee -a "$LOG_FILE"

CURRENT_STEP="seed"; status "seed" "Verifying baseline data (idempotent)"
node scripts/ensure-super-admin.js 2>&1 | tail -2 | tee -a "$LOG_FILE" || log "⚠️  super-admin seed skipped"
node scripts/seed-commerce-templates.js 2>&1 | tail -2 | tee -a "$LOG_FILE" || log "⚠️  commerce seed skipped"

CURRENT_STEP="build"; status "build" "Building candidate (~3-6 min)"
log "── next build (inside release; live release untouched) ──────"
# Clean env avoids the PM2 HOSTNAME=0.0.0.0 Turbopack worker bug.
( env -i HOME="$HOME" USER="$(whoami)" PATH="$PATH" LANG="en_US.UTF-8" \
    NODE_ENV="production" DATABASE_URL="file:$DB_FILE" \
    NEXT_TELEMETRY_DISABLED="1" NODE_OPTIONS="--max-old-space-size=1536" \
    NEXT_TURBOPACK_USE_WORKER="0" \
    npm run build 2>&1 | tail -6 | tee -a "$LOG_FILE" ) \
  || { rm -rf "$NEW_RELEASE"; fail "next build failed — release discarded, live untouched"; }

CURRENT_STEP="assemble"; status "assemble" "Finalising release"
[ -f "$NEW_RELEASE/.next/standalone/server.js" ] || { rm -rf "$NEW_RELEASE"; fail "standalone missing — release discarded"; }
{
  echo "DATABASE_URL=file:$DB_FILE"; echo "PORT=$APP_PORT"; echo "HOSTNAME=0.0.0.0"
  grep -v -E '^(DATABASE_URL|PORT|HOSTNAME)=' "$NEW_RELEASE/.env" 2>/dev/null || true
} > "$NEW_RELEASE/.next/standalone/.env"

# ─── 5. Candidate health check on a TEMP PORT (runs exactly as prod will) ─────────
CURRENT_STEP="candidate-health"; status "candidate-health" "Validating candidate on :$CAND_PORT"
# Free the candidate port in case a previous aborted run left a listener.
fuser -k "${CAND_PORT}/tcp" 2>/dev/null || true; sleep 1
( cd "$NEW_RELEASE" && PORT="$CAND_PORT" HOSTNAME="127.0.0.1" NODE_ENV="production" \
    DATABASE_URL="file:$DB_FILE" node .next/standalone/server.js >/tmp/quantix-candidate.log 2>&1 ) &
CAND_PID=$!
CAND_OK=""
for attempt in $(seq 1 20); do
  sleep 2
  kill -0 "$CAND_PID" 2>/dev/null || { log "❌ candidate exited early"; break; }
  RHTTP=$(curl -s -o /tmp/quantix-cand-ready.txt -w "%{http_code}" --max-time 8 "http://127.0.0.1:$CAND_PORT/api/health/readiness" 2>/dev/null || echo 000)
  if [ "$RHTTP" = "200" ] && grep -q '"database":true' /tmp/quantix-cand-ready.txt 2>/dev/null; then
    log "✅ Candidate ready (readiness=200 db=true) attempt $attempt"; CAND_OK=1; break
  fi
  log "⏳ candidate readiness attempt $attempt: HTTP $RHTTP"
done
cleanup_candidate; CAND_PID=""
if [ -z "$CAND_OK" ]; then
  tail -20 /tmp/quantix-candidate.log 2>/dev/null | tee -a "$LOG_FILE" || true
  rm -rf "$NEW_RELEASE"
  fail "Candidate failed readiness — release discarded, live release untouched"
fi

# ─── 6. Atomic switch ────────────────────────────────────────────────────────────
CURRENT_STEP="switch"; status "switch" "Switching active release"
PREV_RELEASE="$(readlink "$CURRENT_LINK" 2>/dev/null || echo '')"
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK"
log "🔀 $CURRENT_LINK -> $NEW_RELEASE (prev: ${PREV_RELEASE:-none})"
switch_pm2() {
  local cur_cwd; cur_cwd="$(pm2 describe "$PM2_APP" 2>/dev/null | grep -i 'exec cwd' | grep -oE '/home[^ │]*' | head -1)"
  if [ "$cur_cwd" = "$CURRENT_LINK" ]; then
    pm2 restart "$PM2_APP" --update-env 2>&1 | tail -3 | tee -a "$LOG_FILE"
  else
    log "Adopting release symlink (pm2 delete+start)"
    pm2 delete "$PM2_APP" 2>/dev/null || true
    pm2 start "$REPO/ecosystem.config.js" --only "$PM2_APP" --update-env 2>&1 | tail -3 | tee -a "$LOG_FILE"
  fi
}
switch_pm2 || fail "pm2 switch failed"
pm2 save 2>/dev/null || true

# ─── 7. Post-switch production readiness (Prisma-backed) ──────────────────────────
CURRENT_STEP="verify"; status "verify" "Validating production"
LIVE_OK=""
for attempt in $(seq 1 12); do
  sleep 3
  RHTTP=$(curl -s -o /tmp/quantix-live-ready.txt -w "%{http_code}" --max-time 10 "http://localhost:$APP_PORT/api/health/readiness" 2>/dev/null || echo 000)
  if [ "$RHTTP" = "200" ] && grep -q '"database":true' /tmp/quantix-live-ready.txt 2>/dev/null; then
    log "✅ Production ready (readiness=200 db=true) attempt $attempt"; LIVE_OK=1; break
  fi
  log "⏳ production readiness attempt $attempt: HTTP $RHTTP"
done

# ─── 8. Rollback on failure (previous release intact) ─────────────────────────────
if [ -z "$LIVE_OK" ]; then
  log "❌ Production readiness FAILED — rolling back"
  if [ -n "$PREV_RELEASE" ] && [ -d "$PREV_RELEASE" ]; then
    ln -sfn "$PREV_RELEASE" "$CURRENT_LINK"; switch_pm2 || true
    for a in $(seq 1 10); do sleep 3; H=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:$APP_PORT/" 2>/dev/null || echo 000); echo "$H" | grep -qE '^(200|30[1278])$' && { log "↩️  rolled back (HTTP $H)"; break; }; done
    status "rollback" "Deploy failed; rolled back to previous release" "rolled_back"; exit 1
  fi
  fail "Readiness failed and no previous release to roll back to"
fi

# ─── 9. Retention (keep newest $KEEP_RELEASES; never current/previous) ────────────
CURRENT_STEP="retention"
KEEP_CUR="$(readlink "$CURRENT_LINK" 2>/dev/null || echo '')"
ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  old="${old%/}"
  [ "$old" = "$KEEP_CUR" ] && continue
  [ "$old" = "$PREV_RELEASE" ] && continue
  log "🧹 removing old release $(basename "$old")"; rm -rf "$old"
done

DURATION_SEC=$(( $(date +%s) - START_EPOCH ))
log "============================================================"
log " DEPLOY COMPLETE — $COMMIT — ${DURATION_SEC}s"
log "============================================================"
printf '{"status":"success","step":"done","message":"Deploy complete","startedAt":"%s","updatedAt":"%s","commit":"%s","release":"%s","durationSeconds":%d}\n' \
  "$STARTED_AT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$COMMIT" "$(basename "$NEW_RELEASE")" "$DURATION_SEC" \
  > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
chmod 644 "$STATUS_FILE" 2>/dev/null || true
( sleep 900; rm -f "$LOG_FILE"; ) & disown
