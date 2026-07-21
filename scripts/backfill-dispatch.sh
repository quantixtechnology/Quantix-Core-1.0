#!/usr/bin/env bash
# Idempotent dispatch backfill — run once after every deploy.
# Reads business IDs from the database and POSTs the backfill endpoint.
set -euo pipefail

echo "[backfill-dispatch] Starting dispatch history backfill..."

# Get all laundry business IDs from the database
BUSINESS_IDS=$(npx prisma db execute --stdin <<< "SELECT b.id FROM \"Business\" b JOIN \"LaundryBusiness\" lb ON lb.\"businessId\" = b.id;" 2>/dev/null | tail -n +2 || echo "")

if [ -z "$BUSINESS_IDS" ]; then
  echo "[backfill-dispatch] No businesses found or DB not accessible"
  echo "[backfill-dispatch] Attempting direct API call for each business..."

  # Fallback: try to get businesses via API
  BASE_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
  COOKIE_JAR=$(mktemp)

  # Login as super admin
  LOGIN_RESP=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL:-admin@quantix.com}\",\"password\":\"${ADMIN_PASSWORD:-admin}\"}" 2>/dev/null || echo "{}")

  BIZ_RESP=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/laundry/businesses" 2>/dev/null || echo "{\"data\":[]}")
  echo "[backfill-dispatch] Business response: $BIZ_RESP"

  rm -f "$COOKIE_JAR"
  echo "[backfill-dispatch] Manual backfill required — run POST /api/laundry/dispatch/backfill for each business"
  exit 0
fi

for BID in $BUSINESS_IDS; do
  echo "[backfill-dispatch] Backfilling business $BID..."
  curl -s -X POST "$BASE_URL/api/laundry/dispatch/backfill" \
    -H "Content-Type: application/json" \
    -H "Cookie: $AUTH_COOKIE" \
    -d "{\"businessId\":\"$BID\"}" || echo "[backfill-dispatch] Failed for $BID"
done

echo "[backfill-dispatch] Done"
