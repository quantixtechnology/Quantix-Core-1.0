#!/usr/bin/env bash
# =============================================================================
# migrate-db-out-of-repo.sh
#
# ONE-TIME VPS MIGRATION — run this ONCE via the Hostinger web terminal
# BEFORE triggering a GitHub Actions deploy that uses the new DB path.
#
# What it does:
#   1. Verifies the source DB exists and has real data.
#   2. Creates /root/quantix-data/ with restricted permissions.
#   3. Creates a timestamped backup.
#   4. Copies the DB to the new location.
#   5. Verifies the copy is intact (row counts match).
#   6. Updates /root/Quantix-Core-1.0/.env with the new DATABASE_URL.
#   7. Restarts PM2 and confirms the app is healthy.
#   8. Prints a rollback command in case anything goes wrong.
#
# ROLLBACK (if the app fails after this script):
#   export DATABASE_URL="file:/root/Quantix-Core-1.0/prisma/db/custom.db"
#   grep -v "^DATABASE_URL=" /root/Quantix-Core-1.0/.env > /tmp/env_tmp
#   { echo "DATABASE_URL=file:/root/Quantix-Core-1.0/prisma/db/custom.db"; cat /tmp/env_tmp; } > /root/Quantix-Core-1.0/.env
#   pm2 restart quantix --update-env
# =============================================================================

set -euo pipefail

PROJECT="/root/Quantix-Core-1.0"
OLD_DB="$PROJECT/prisma/db/custom.db"
NEW_DIR="/root/quantix-data"
NEW_DB="$NEW_DIR/custom.db"
BACKUP_DIR="/root/backups"

echo "============================================================"
echo " QUANTIX DB MIGRATION — $(date)"
echo "============================================================"

# ── Pre-flight: verify source ────────────────────────────────────────────────
echo ""
echo "── Verifying source database ────────────────────────────────"
if [ ! -f "$OLD_DB" ]; then
  echo "❌ Source DB not found at $OLD_DB"
  echo "   If it was already moved to $NEW_DB, this migration is already done."
  exit 1
fi

SOURCE_SIZE=$(du -sh "$OLD_DB" | cut -f1)
echo "   Source : $OLD_DB ($SOURCE_SIZE)"

# Count businesses and customers to confirm this is real production data
BIZ_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM Business;" 2>/dev/null || echo "0")
CUST_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM Customer;" 2>/dev/null || echo "0")
USER_COUNT=$(sqlite3 "$OLD_DB" "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
echo "   Businesses : $BIZ_COUNT"
echo "   Customers  : $CUST_COUNT"
echo "   Users      : $USER_COUNT"

if [ "$BIZ_COUNT" -lt 1 ]; then
  echo "❌ Source DB has 0 businesses — this looks like seed/empty data."
  echo "   Aborting to protect against migrating the wrong file."
  exit 1
fi

echo "✅ Source DB verified ($BIZ_COUNT businesses, $CUST_COUNT customers)"

# ── Backup ───────────────────────────────────────────────────────────────────
echo ""
echo "── Creating backup ──────────────────────────────────────────"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/custom.db.$TIMESTAMP.pre-migration.bak"
cp "$OLD_DB" "$BACKUP_FILE"
echo "✅ Backup written → $BACKUP_FILE"

# Keep only the 20 most recent backups
ls -t "$BACKUP_DIR"/custom.db.*.bak 2>/dev/null | tail -n +21 | xargs rm -f || true

# ── Create destination ───────────────────────────────────────────────────────
echo ""
echo "── Creating /root/quantix-data/ ─────────────────────────────"
mkdir -p "$NEW_DIR"
chmod 700 "$NEW_DIR"   # only root can read — protects customer data
echo "   Directory : $NEW_DIR (chmod 700)"

# ── Copy DB to new location ──────────────────────────────────────────────────
echo ""
echo "── Copying database ─────────────────────────────────────────"
cp "$OLD_DB" "$NEW_DB"
chmod 600 "$NEW_DB"
NEW_SIZE=$(du -sh "$NEW_DB" | cut -f1)
echo "   Copied : $NEW_DB ($NEW_SIZE)"

# ── Verify copy integrity ────────────────────────────────────────────────────
echo ""
echo "── Verifying copy ───────────────────────────────────────────"
NEW_BIZ=$(sqlite3  "$NEW_DB" "SELECT COUNT(*) FROM Business;" 2>/dev/null || echo "ERR")
NEW_CUST=$(sqlite3 "$NEW_DB" "SELECT COUNT(*) FROM Customer;" 2>/dev/null || echo "ERR")
NEW_USER=$(sqlite3 "$NEW_DB" "SELECT COUNT(*) FROM User;"    2>/dev/null || echo "ERR")

echo "   Businesses : $NEW_BIZ (source: $BIZ_COUNT)"
echo "   Customers  : $NEW_CUST (source: $CUST_COUNT)"
echo "   Users      : $NEW_USER (source: $USER_COUNT)"

if [ "$NEW_BIZ" != "$BIZ_COUNT" ] || [ "$NEW_CUST" != "$CUST_COUNT" ] || [ "$NEW_USER" != "$USER_COUNT" ]; then
  echo "❌ Row count mismatch — copy may be corrupt. Aborting."
  echo "   Rollback: the original is still at $OLD_DB"
  exit 1
fi
echo "✅ Copy verified — all row counts match"

# ── Update project .env ──────────────────────────────────────────────────────
echo ""
echo "── Updating $PROJECT/.env ───────────────────────────────────"
touch "$PROJECT/.env"
OLD_URL=$(grep "^DATABASE_URL=" "$PROJECT/.env" 2>/dev/null || echo "(not set)")
echo "   Old : $OLD_URL"
grep -v "^DATABASE_URL=" "$PROJECT/.env" > /tmp/env_migration_tmp || true
{ echo "DATABASE_URL=file:$NEW_DB"; cat /tmp/env_migration_tmp; } > "$PROJECT/.env"
rm -f /tmp/env_migration_tmp
echo "   New : DATABASE_URL=file:$NEW_DB"
echo "✅ .env updated"

# ── Restart PM2 ─────────────────────────────────────────────────────────────
echo ""
echo "── Restarting PM2 ───────────────────────────────────────────"
if pm2 list 2>/dev/null | grep -q "quantix"; then
  pm2 restart quantix --update-env
  echo "✅ PM2 restarted"
else
  echo "⚠️  PM2 process 'quantix' not found — start it manually with:"
  echo "   cd $PROJECT && pm2 start ecosystem.config.js && pm2 save"
fi
pm2 save 2>/dev/null || true

# ── Health check ─────────────────────────────────────────────────────────────
echo ""
echo "── Health check ─────────────────────────────────────────────"
sleep 8
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3000 2>/dev/null || echo "000")
if echo "$HTTP" | grep -qE "^(200|301|302|307|308)$"; then
  echo "✅ App healthy (HTTP $HTTP)"
else
  echo "⚠️  App returned HTTP $HTTP — check PM2 logs:"
  pm2 logs quantix --lines 30 --nostream 2>/dev/null || true
  echo ""
  echo "ROLLBACK COMMAND (run if needed):"
  echo "  grep -v '^DATABASE_URL=' $PROJECT/.env > /tmp/env_rb"
  echo "  { echo 'DATABASE_URL=file:$OLD_DB'; cat /tmp/env_rb; } > $PROJECT/.env"
  echo "  pm2 restart quantix --update-env"
  exit 1
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " MIGRATION COMPLETE — $(date)"
echo "============================================================"
echo ""
echo " Old location : $OLD_DB"
echo " New location : $NEW_DB"
echo " Backup       : $BACKUP_FILE"
echo ""
echo " The old file at $OLD_DB is still present."
echo " After confirming GitHub Actions deploys work correctly,"
echo " you may remove it with:"
echo "   rm $OLD_DB"
echo "   rmdir $PROJECT/prisma/db/ 2>/dev/null || true"
echo ""
echo " Rollback (if needed later):"
echo "   grep -v '^DATABASE_URL=' $PROJECT/.env > /tmp/env_rb"
echo "   { echo 'DATABASE_URL=file:$OLD_DB'; cat /tmp/env_rb; } > $PROJECT/.env"
echo "   pm2 restart quantix --update-env"
