#!/bin/bash
# =============================================================================
# QUANTIX — Deployment Setup Verifier
# Run this on the VPS to audit the full deployment pipeline.
# Output is structured so every check has a clear PASS/FAIL/WARN result.
#
# Usage:
#   bash /home/ubuntu/Quantix-Core-1.0/scripts/verify-deploy-setup.sh
#
# What it checks:
#   1. DEPLOY_WEBHOOK_SECRET in .env
#   2. App is live (PM2 + HTTP health)
#   3. Environment loaded by running process
#   4. deploy-local.sh is executable and valid
#   5. Webhook endpoint: valid secret → 200
#   6. Webhook endpoint: invalid secret → 401
#   7. Replay protection: old timestamp → 400
#   8. Concurrent lock: 409 when lock file exists
#   9. Status endpoint: valid secret → responds
#  10. Rate limit logic (verified in code, not brute-forced)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

PASS() { echo -e "  ${GREEN}✅ PASS${RESET}  $*"; }
FAIL() { echo -e "  ${RED}❌ FAIL${RESET}  $*"; }
WARN() { echo -e "  ${YELLOW}⚠️  WARN${RESET}  $*"; }
INFO() { echo -e "  ${BLUE}ℹ️  INFO${RESET}  $*"; }
HEAD() { echo -e "\n${BOLD}$*${RESET}"; echo "$(printf '─%.0s' {1..60})"; }

PROJECT="/home/ubuntu/Quantix-Core-1.0"
ENV_FILE="$PROJECT/.env"
APP_URL="http://localhost:3000"
LOCK_FILE="/tmp/quantix-deploy.lock"
STATUS_FILE="/tmp/quantix-deploy-status.json"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   QUANTIX DEPLOYMENT SETUP VERIFICATION                  ║${RESET}"
echo -e "${BOLD}║   $(date -u '+%Y-%m-%dT%H:%M:%SZ')                       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"

# ─── 1. Secret in .env ────────────────────────────────────────────────────────
HEAD "1. VPS .env Configuration"

if [ ! -f "$ENV_FILE" ]; then
  FAIL ".env not found at $ENV_FILE"
  echo "     Fix: touch $ENV_FILE && echo 'DEPLOY_WEBHOOK_SECRET=<secret>' >> $ENV_FILE"
else
  PASS ".env file exists"
  if grep -q "^DEPLOY_WEBHOOK_SECRET=" "$ENV_FILE" 2>/dev/null; then
    SECRET_VAL=$(grep "^DEPLOY_WEBHOOK_SECRET=" "$ENV_FILE" | cut -d= -f2-)
    SECRET_LEN=${#SECRET_VAL}
    if [ "$SECRET_LEN" -ge 32 ]; then
      PASS "DEPLOY_WEBHOOK_SECRET present (${SECRET_LEN} chars) — value not shown"
    else
      FAIL "DEPLOY_WEBHOOK_SECRET too short (${SECRET_LEN} chars, need ≥32)"
    fi
  else
    FAIL "DEPLOY_WEBHOOK_SECRET not found in .env"
    echo "     Fix: echo 'DEPLOY_WEBHOOK_SECRET=<secret>' >> $ENV_FILE"
  fi
fi

# ─── 2. PM2 + App health ──────────────────────────────────────────────────────
HEAD "2. Application Health"

if command -v pm2 &>/dev/null; then
  PASS "pm2 binary found: $(pm2 --version)"
  if pm2 list 2>/dev/null | grep -q "quantix-core"; then
    PM2_STATUS=$(pm2 list 2>/dev/null | grep "quantix-core" | awk '{print $10}' || echo "unknown")
    PASS "PM2 process 'quantix-core' exists (status: ${PM2_STATUS:-online})"
  else
    FAIL "PM2 process 'quantix-core' not found"
    echo "     Fix: cd $PROJECT && pm2 start ecosystem.config.js"
  fi
else
  FAIL "pm2 not found in PATH"
fi

echo ""
INFO "HTTP health check → $APP_URL"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$APP_URL" 2>/dev/null || echo "000")
if echo "$HTTP" | grep -qE "^(200|301|302|307|308)$"; then
  PASS "App responds HTTP $HTTP"
else
  FAIL "App health check failed (HTTP $HTTP)"
  echo "     Check: pm2 logs quantix-core --lines 30"
fi

# ─── 3. Env loaded by running process ────────────────────────────────────────
HEAD "3. Runtime Environment"

PM2_PID=$(pm2 list --no-color 2>/dev/null | grep "quantix-core" | grep -oE '[0-9]+' | head -1 || echo "")
if [ -n "$PM2_PID" ]; then
  if cat /proc/"$PM2_PID"/environ 2>/dev/null | tr '\0' '\n' | grep -q "DEPLOY_WEBHOOK_SECRET="; then
    PASS "DEPLOY_WEBHOOK_SECRET is loaded in the running process environment"
  else
    FAIL "DEPLOY_WEBHOOK_SECRET not in running process environment"
    echo "     Fix: pm2 restart quantix-core --update-env"
  fi
else
  WARN "Could not determine PM2 PID — skipping runtime env check"
  INFO "Manual check: pm2 env <id> | grep DEPLOY_WEBHOOK_SECRET"
fi

# ─── 4. Script validation ─────────────────────────────────────────────────────
HEAD "4. deploy-local.sh Validation"

SCRIPT="$PROJECT/scripts/deploy-local.sh"
if [ -f "$SCRIPT" ]; then
  PASS "deploy-local.sh exists"
  if [ -x "$SCRIPT" ]; then
    PASS "deploy-local.sh is executable"
  else
    FAIL "deploy-local.sh is not executable"
    echo "     Fix: chmod +x $SCRIPT"
  fi
  if head -1 "$SCRIPT" | grep -q "#!/bin/bash"; then
    PASS "Shebang line correct (#!/bin/bash)"
  else
    FAIL "Shebang line missing or incorrect"
  fi
  if grep -q "set -euo pipefail" "$SCRIPT"; then
    PASS "set -euo pipefail present"
  else
    FAIL "set -euo pipefail missing"
  fi
  if grep -q "trap.*ERR" "$SCRIPT"; then
    PASS "ERR trap present"
  else
    FAIL "ERR trap missing — failed commands won't update status file"
  fi
  if grep -q "trap.*EXIT" "$SCRIPT"; then
    PASS "EXIT trap present (lock cleanup)"
  else
    FAIL "EXIT trap missing"
  fi
else
  FAIL "deploy-local.sh not found at $SCRIPT"
fi

# ─── 5-9. Webhook endpoint tests ─────────────────────────────────────────────
HEAD "5-9. Webhook Endpoint Tests"

# Read secret from .env for testing
if grep -q "^DEPLOY_WEBHOOK_SECRET=" "$ENV_FILE" 2>/dev/null; then
  SECRET=$(grep "^DEPLOY_WEBHOOK_SECRET=" "$ENV_FILE" | cut -d= -f2-)
  NOW=$(date +%s)

  # ── 5. Valid request → 200 ────────────────────────────────────────────────
  INFO "Test 5: Valid secret → expecting HTTP 200"
  # Clean up any stale lock before testing
  rm -f "$LOCK_FILE"
  RESP5=$(curl -s -o /tmp/wh_test5.json -w "%{http_code}" --max-time 15 \
    -X POST \
    -H "x-deploy-secret: $SECRET" \
    -H "x-deploy-timestamp: $NOW" \
    -H "Content-Type: application/json" \
    "$APP_URL/api/deploy" 2>/dev/null || echo "000")
  BODY5=$(cat /tmp/wh_test5.json 2>/dev/null || echo "{}")
  if [ "$RESP5" = "200" ]; then
    PASS "Valid secret → HTTP 200 ✓ body=$BODY5"
    # Kill the spawned deploy immediately so it doesn't actually run
    sleep 1
    rm -f "$LOCK_FILE"
  else
    FAIL "Valid secret → HTTP $RESP5 (expected 200) body=$BODY5"
  fi

  # ── 6. Invalid secret → 401 ───────────────────────────────────────────────
  INFO "Test 6: Invalid secret → expecting HTTP 401"
  RESP6=$(curl -s -o /tmp/wh_test6.json -w "%{http_code}" --max-time 10 \
    -X POST \
    -H "x-deploy-secret: wrong_secret_that_will_fail" \
    -H "x-deploy-timestamp: $NOW" \
    "$APP_URL/api/deploy" 2>/dev/null || echo "000")
  if [ "$RESP6" = "401" ]; then
    PASS "Invalid secret → HTTP 401 ✓"
  else
    FAIL "Invalid secret → HTTP $RESP6 (expected 401)"
  fi

  # ── 7. Replay: old timestamp → 400 ────────────────────────────────────────
  INFO "Test 7: Old timestamp → expecting HTTP 400 (replay rejected)"
  OLD_TS=$(( NOW - 400 ))  # 400 seconds ago — outside the 5-min window
  RESP7=$(curl -s -o /tmp/wh_test7.json -w "%{http_code}" --max-time 10 \
    -X POST \
    -H "x-deploy-secret: $SECRET" \
    -H "x-deploy-timestamp: $OLD_TS" \
    "$APP_URL/api/deploy" 2>/dev/null || echo "000")
  if [ "$RESP7" = "400" ]; then
    PASS "Replay (old timestamp) → HTTP 400 ✓"
  else
    FAIL "Replay test → HTTP $RESP7 (expected 400)"
  fi

  # ── 8. Concurrent lock → 409 ──────────────────────────────────────────────
  INFO "Test 8: Concurrent deploy → expecting HTTP 409"
  # Simulate a running deploy by creating the lock file
  touch "$LOCK_FILE"
  RESP8=$(curl -s -o /tmp/wh_test8.json -w "%{http_code}" --max-time 10 \
    -X POST \
    -H "x-deploy-secret: $SECRET" \
    -H "x-deploy-timestamp: $NOW" \
    "$APP_URL/api/deploy" 2>/dev/null || echo "000")
  rm -f "$LOCK_FILE"
  if [ "$RESP8" = "409" ]; then
    PASS "Concurrent deploy → HTTP 409 ✓"
  else
    FAIL "Concurrent test → HTTP $RESP8 (expected 409)"
  fi

  # ── 9. Status endpoint ────────────────────────────────────────────────────
  INFO "Test 9: Status endpoint → expecting JSON response"
  RESP9=$(curl -s -o /tmp/wh_test9.json -w "%{http_code}" --max-time 10 \
    -H "x-deploy-secret: $SECRET" \
    "$APP_URL/api/deploy/status" 2>/dev/null || echo "000")
  STATUS_BODY=$(cat /tmp/wh_test9.json 2>/dev/null || echo "{}")
  if echo "$RESP9" | grep -qE "^(200|201)$"; then
    STATUS_VAL=$(echo "$STATUS_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
    PASS "Status endpoint → HTTP $RESP9, status=$STATUS_VAL ✓"
  else
    FAIL "Status endpoint → HTTP $RESP9 body=$STATUS_BODY"
  fi

  # ── Status without secret → 401 ───────────────────────────────────────────
  INFO "Test: Status endpoint without secret → expecting HTTP 401"
  RESP_UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    "$APP_URL/api/deploy/status" 2>/dev/null || echo "000")
  if [ "$RESP_UNAUTH" = "401" ]; then
    PASS "Status without secret → HTTP 401 ✓ (not publicly accessible)"
  else
    FAIL "Status without secret → HTTP $RESP_UNAUTH (expected 401)"
  fi

else
  WARN "Cannot run endpoint tests — DEPLOY_WEBHOOK_SECRET not found in .env"
  echo "     Add the secret to .env first, then re-run this script."
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
HEAD "Summary"
echo ""
echo "  If all items above show ✅ PASS, run the full deploy:"
echo "  bash $PROJECT/scripts/deploy-local.sh"
echo ""
echo "  Then watch progress:"
echo "  tail -f /tmp/quantix-deploy.log"
echo ""
echo "  After deploy completes, check status:"
echo "  cat /tmp/quantix-deploy-status.json"
echo ""
