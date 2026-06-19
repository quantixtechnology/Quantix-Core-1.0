#!/bin/bash
# scripts/verify-deploy.sh
# Verify deployment webhook configuration

# Set strict mode
set -euo pipefail

check() {
  if [ $? -eq 0 ]; then
    echo "✅ PASS: $1"
  else
    echo "❌ FAIL: $1"
    if [ -n "${2:-}" ]; then
      echo "   $2"
    fi
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

FAIL_COUNT=0
ENV_FILE=".env"

echo "Running Deployment Webhook Verification..."
echo ""

# 1. Verify DEPLOY_WEBHOOK_SECRET exists
set +e
grep -q "^DEPLOY_WEBHOOK_SECRET=" "$ENV_FILE" 2>/dev/null
check "DEPLOY_WEBHOOK_SECRET exists in .env" "Run ./scripts/setup-deploy-secret.sh to generate it."
set -e

# 2. Verify deploy script path exists
set +e
[ -f "scripts/deploy-local.sh" ]
check "deploy-local.sh exists at scripts/deploy-local.sh" "Ensure you are running from the project root."
set -e

# 3. Verify PM2 process quantix-core is running
set +e
# Checking if PM2 process exists and is online
pm2 jlist 2>/dev/null | grep -q '"name":"quantix-core".*"status":"online"' || pm2 pid quantix-core 2>/dev/null | grep -q '^[0-9]'
check "PM2 process 'quantix-core' is running" "Run pm2 start ecosystem.config.js"
set -e

# 4. Verify deploy endpoint configuration (just checking if route file exists)
set +e
[ -f "src/app/api/deploy/route.ts" ]
check "Deploy endpoint /api/deploy is configured" "Missing src/app/api/deploy/route.ts file."
set -e

echo ""
echo "========================================"
if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ All verification checks passed."
  exit 0
else
  echo "❌ $FAIL_COUNT checks failed."
  exit 1
fi
