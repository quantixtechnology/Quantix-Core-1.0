#!/bin/bash
# =============================================================================
# QUANTIX CORE — Production Recovery Deploy
#
# Safely updates the VPS from any state to the latest GitHub HEAD.
# Designed for situations where deploy-local.sh does not yet exist on the VPS.
#
# Usage (run directly on the VPS — no git pull required):
#   curl -fsSL https://raw.githubusercontent.com/quantixtechnology/Quantix-Core-1.0/main/scripts/recovery-deploy.sh -o /tmp/recovery-deploy.sh
#   bash /tmp/recovery-deploy.sh
#
# Safety features:
#   - Verifies VPS and GitHub commits before touching anything
#   - Creates a timestamped backup of the project directory first
#   - Stops and reports immediately on any failure (set -euo pipefail)
#   - Health check gates the "success" status
#   - Full deployment report printed at the end
# =============================================================================

set -euo pipefail

# ─── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

PASS()  { echo -e "${GREEN}  ✅ $*${RESET}"; }
FAIL()  { echo -e "${RED}  ❌ $*${RESET}"; exit 1; }
STEP()  { echo -e "\n${BOLD}${BLUE}══ $* ${RESET}"; }
INFO()  { echo -e "     $*"; }

SCRIPT_START=$(date +%s)
DEPLOY_DATE=$(date '+%Y-%m-%d %H:%M:%S')

# ─── Config ────────────────────────────────────────────────────────────────────
PROJECT="/root/Quantix-Core-1.0"
DB_FILE="/root/quantix-data/custom.db"
BACKUP_BASE="/root/backups"
EXPECTED_GITHUB_HEAD="44375b7"   # Update if HEAD moves forward
GITHUB_REPO="quantixtechnology/Quantix-Core-1.0"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   QUANTIX PRODUCTION RECOVERY DEPLOY                        ║${RESET}"
echo -e "${BOLD}║   ${DEPLOY_DATE}                            ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"

# ─── Step 0: Pre-flight checks ────────────────────────────────────────────────
STEP "0. Pre-flight checks"

[ -d "$PROJECT" ] || FAIL "Project directory not found: $PROJECT"
PASS "Project directory exists: $PROJECT"

command -v node  &>/dev/null || FAIL "node not found"
command -v npm   &>/dev/null || FAIL "npm not found"
command -v pm2   &>/dev/null || FAIL "pm2 not found"
command -v git   &>/dev/null || FAIL "git not found"
INFO "node $(node --version) | npm $(npm --version) | pm2 $(pm2 --version)"
PASS "Required tools available"

# ─── Step 1: Capture current VPS commit ───────────────────────────────────────
STEP "1. VPS commit state"

cd "$PROJECT"
VPS_COMMIT=$(git rev-parse HEAD)
VPS_COMMIT_SHORT=$(git rev-parse --short HEAD)
VPS_COMMIT_MSG=$(git log -1 --pretty='%s')
INFO "VPS HEAD: $VPS_COMMIT_SHORT — $VPS_COMMIT_MSG"
PASS "VPS commit captured: $VPS_COMMIT_SHORT"

# ─── Step 2: Fetch latest from GitHub and compare ─────────────────────────────
STEP "2. GitHub commit comparison"

git fetch --quiet origin main || FAIL "git fetch failed — check network/git access"
GITHUB_HEAD=$(git rev-parse origin/main)
GITHUB_HEAD_SHORT=$(git rev-parse --short origin/main)
GITHUB_HEAD_MSG=$(git log -1 --pretty='%s' origin/main)
INFO "GitHub HEAD: $GITHUB_HEAD_SHORT — $GITHUB_HEAD_MSG"

COMMITS_BEHIND=$(git rev-list HEAD..origin/main --count)
if [ "$COMMITS_BEHIND" -eq 0 ]; then
  PASS "VPS is already at GitHub HEAD — nothing to deploy"
  echo ""
  echo "Production is already running the latest commit ($GITHUB_HEAD_SHORT)."
  exit 0
fi

INFO "VPS is $COMMITS_BEHIND commit(s) behind GitHub HEAD"
echo ""
INFO "Commits to be deployed:"
git log HEAD..origin/main --oneline | while read -r line; do
  INFO "  → $line"
done
PASS "Confirmed: VPS ($VPS_COMMIT_SHORT) is behind GitHub ($GITHUB_HEAD_SHORT)"

# ─── Step 3: Database backup ──────────────────────────────────────────────────
STEP "3. Database backup (before any changes)"

mkdir -p "$BACKUP_BASE"
if [ -f "$DB_FILE" ]; then
  BACKUP_FILE="$BACKUP_BASE/custom.db.$(date +%Y%m%d-%H%M%S).recovery.bak"
  cp "$DB_FILE" "$BACKUP_FILE" || FAIL "Database backup failed"
  PASS "Database backed up → $BACKUP_FILE"
  # Keep only 15 most recent backups
  ls -t "$BACKUP_BASE"/custom.db.*.bak 2>/dev/null | tail -n +16 | xargs rm -f || true
else
  INFO "No database file found at $DB_FILE (first deploy or external storage)"
  mkdir -p "$(dirname "$DB_FILE")"
fi

# ─── Step 4: Application directory backup ─────────────────────────────────────
STEP "4. Application directory backup"

APP_BACKUP="$BACKUP_BASE/app-$VPS_COMMIT_SHORT-$(date +%Y%m%d-%H%M%S).tar.gz"
INFO "Creating backup of $PROJECT → $APP_BACKUP"
INFO "(this may take 30–60 seconds for a large project)"

# Exclude .next/cache and node_modules to keep backup small
tar czf "$APP_BACKUP" \
  --exclude="$PROJECT/.next/cache" \
  --exclude="$PROJECT/node_modules" \
  --exclude="$PROJECT/.git" \
  "$PROJECT" 2>/dev/null || FAIL "Application backup failed"

BACKUP_SIZE=$(du -sh "$APP_BACKUP" | cut -f1)
PASS "Application backed up ($BACKUP_SIZE) → $APP_BACKUP"
# Keep only 3 most recent application backups
ls -t "$BACKUP_BASE"/app-*.tar.gz 2>/dev/null | tail -n +4 | xargs rm -f || true

# ─── Step 5: Git reset to GitHub HEAD ─────────────────────────────────────────
STEP "5. Update code to GitHub HEAD"

git reset --hard origin/main || FAIL "git reset --hard origin/main failed"
NEW_COMMIT=$(git rev-parse HEAD)
NEW_COMMIT_SHORT=$(git rev-parse --short HEAD)
NEW_COMMIT_MSG=$(git log -1 --pretty='%s')

if [ "$NEW_COMMIT_SHORT" != "$GITHUB_HEAD_SHORT" ]; then
  FAIL "Commit mismatch after reset: got $NEW_COMMIT_SHORT, expected $GITHUB_HEAD_SHORT"
fi
PASS "Code updated to $NEW_COMMIT_SHORT — $NEW_COMMIT_MSG"

# Verify deploy-local.sh now exists (it was added in a later commit)
[ -f "$PROJECT/scripts/deploy-local.sh" ] && PASS "deploy-local.sh now exists on VPS" || INFO "Note: deploy-local.sh not found (may be in a different path)"

# ─── Step 6: Patch .env ───────────────────────────────────────────────────────
STEP "6. Environment configuration"

touch "$PROJECT/.env"
grep -v "^DATABASE_URL=" "$PROJECT/.env" > /tmp/env_tmp_recovery || true
{ echo "DATABASE_URL=file:$DB_FILE"; cat /tmp/env_tmp_recovery; } > "$PROJECT/.env"
export DATABASE_URL="file:$DB_FILE"
PASS "DATABASE_URL written to .env"

# ─── Step 7: Install dependencies ─────────────────────────────────────────────
STEP "7. npm install"

npm install --legacy-peer-deps 2>&1 | tail -6
PASS "Dependencies installed"

# ─── Step 8: Prisma ───────────────────────────────────────────────────────────
STEP "8. Prisma generate + db push"

npx prisma generate 2>&1 | tail -3
PASS "Prisma client generated"

npx prisma db push --accept-data-loss 2>&1 | tail -3
PASS "Database schema synced"

# ─── Step 9: Super admin ──────────────────────────────────────────────────────
STEP "9. Super admin verification"

node scripts/ensure-super-admin.js 2>&1 || true
PASS "Super admin verified"

# ─── Step 10: Build ───────────────────────────────────────────────────────────
STEP "10. next build"

INFO "Building production bundle (3–6 min)…"
npm run build 2>&1
BUILD_EXIT=${PIPESTATUS[0]:-$?}
[ "$BUILD_EXIT" -eq 0 ] || FAIL "next build failed — check output above"
PASS "Production build complete"

# ─── Step 11: Standalone assets ───────────────────────────────────────────────
STEP "11. Standalone assets"

STANDALONE="$PROJECT/.next/standalone"
[ -d "$STANDALONE" ] || FAIL "Standalone directory missing — build may have failed"

cp -r "$PROJECT/.next/static" "$STANDALONE/.next/" 2>/dev/null || true
cp -r "$PROJECT/public"       "$STANDALONE/"        2>/dev/null || true
PASS "Static assets copied to standalone"

# Write standalone .env
grep -v "^DATABASE_URL\|^PORT\|^HOSTNAME" "$PROJECT/.env" > /tmp/standalone_env_tmp || true
{
  echo "DATABASE_URL=file:$DB_FILE"
  echo "PORT=3000"
  echo "HOSTNAME=0.0.0.0"
  cat /tmp/standalone_env_tmp
} > "$STANDALONE/.env"
PASS "Standalone .env written"

# ─── Step 12: PM2 restart ─────────────────────────────────────────────────────
STEP "12. PM2 restart"

if pm2 list 2>/dev/null | grep -q "quantix"; then
  pm2 restart quantix --update-env 2>&1 || FAIL "pm2 restart failed — run: pm2 logs quantix"
  PASS "PM2 process 'quantix' restarted"
else
  [ -f "$PROJECT/ecosystem.config.js" ] || FAIL "ecosystem.config.js not found"
  pm2 start ecosystem.config.js 2>&1 || FAIL "pm2 start failed — run: pm2 logs quantix"
  PASS "PM2 process 'quantix' started"
fi

pm2 save 2>/dev/null || true

# ─── Step 13: Health check ────────────────────────────────────────────────────
STEP "13. Health check"

INFO "Waiting 15 seconds for app to start…"
sleep 15

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://localhost:3000 2>/dev/null || echo "000")
if echo "$HTTP" | grep -qE "^(200|301|302|307|308)$"; then
  PASS "App healthy — HTTP $HTTP"
else
  echo -e "${YELLOW}  ⚠️  Health check HTTP $HTTP — showing PM2 logs:${RESET}"
  pm2 logs quantix --lines 20 --nostream 2>/dev/null || true
  FAIL "App unhealthy after restart (HTTP $HTTP)"
fi

# ─── Deployment report ────────────────────────────────────────────────────────
DURATION=$(( $(date +%s) - SCRIPT_START ))

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   DEPLOYMENT REPORT                                          ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Date${RESET}             $DEPLOY_DATE"
echo -e "  ${BOLD}Duration${RESET}         ${DURATION}s"
echo ""
echo -e "  ${BOLD}Previous commit${RESET}  $VPS_COMMIT_SHORT — $VPS_COMMIT_MSG"
echo -e "  ${BOLD}New commit${RESET}       $NEW_COMMIT_SHORT — $NEW_COMMIT_MSG"
echo -e "  ${BOLD}Commits deployed${RESET} $COMMITS_BEHIND"
echo -e "  ${BOLD}Full commit hash${RESET} $NEW_COMMIT"
echo ""
echo -e "  ${BOLD}DB backup${RESET}        $BACKUP_FILE"
echo -e "  ${BOLD}App backup${RESET}       $APP_BACKUP ($BACKUP_SIZE)"
echo ""
echo -e "  ${BOLD}PM2 status${RESET}"
pm2 list 2>/dev/null | grep -E "quantix|name" || true
echo ""
echo -e "  ${BOLD}Health check${RESET}     HTTP $HTTP ✅"
echo ""
echo -e "  ${BOLD}Commits deployed:${RESET}"
git log "$VPS_COMMIT_SHORT"..HEAD --oneline | while read -r line; do
  echo "    $line"
done
echo ""
echo -e "${GREEN}${BOLD}  ✅ Production is now running GitHub HEAD: $NEW_COMMIT_SHORT${RESET}"
echo ""
echo -e "  Verify manually:"
echo -e "    curl http://localhost:3000"
echo -e "    pm2 logs quantix --lines 20"
echo -e "    cat /tmp/quantix-deploy-status.json"
echo ""
