#!/usr/bin/env bash
# =============================================================================
# QUANTIX TENANT RESET — v2.0
# Self-contained. Run directly on the VPS as root.
#
#   bash quantix-tenant-reset.sh
#
# What it does (in order, with safeguards):
#   1. Pre-check: row counts for every affected table
#   2. Pre-check: business-wise customer/order/revenue summary
#   3. Backup:    SQLite file copy  → /home/ubuntu/data/backups/pre_reset_<ts>.db
#   4. Backup:    JSON report       → /home/ubuntu/data/backups/pre_reset_report_<ts>.json
#   5. Reset:     DELETE all customer transactional data (single transaction)
#   6. Post-check: verify transactional tables are empty
#   7. Post-check: verify config tables intact
#   8. Post-check: orphan / FK validation
#   9. Final:     summary JSON + human-readable report
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
DB="${QUANTIX_DB:-/home/ubuntu/data/custom.db}"
BACKUP_DIR="/home/ubuntu/data/backups"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DB="${BACKUP_DIR}/pre_reset_${TS}.db"
BACKUP_JSON="${BACKUP_DIR}/pre_reset_report_${TS}.json"
FAIL=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[FAIL]${NC}  $*"; FAIL=1; }

q() { sqlite3 "$DB" "$@"; }         # run SQL
qf() { sqlite3 "$DB" -json "$@"; }  # run SQL, JSON output

echo ""
echo "============================================================"
echo " QUANTIX TENANT RESET"
echo " $(date)"
echo " DB: $DB"
echo "============================================================"

# ── Guard: DB must exist ──────────────────────────────────────────────────────
if [[ ! -f "$DB" ]]; then
  echo -e "${RED}ERROR: Database not found at $DB${NC}"
  echo "Set QUANTIX_DB=/path/to/custom.db if it is in a different location."
  exit 1
fi

# =============================================================================
# SECTION 1 — PRE-CHECK ROW COUNTS
# =============================================================================
echo ""
info "SECTION 1: Pre-check row counts"

declare -A PRE
TRANSACTIONAL_TABLES=(
  "Order" "OrderItem" "OrderStatusHistory"
  "Delivery" "LiveTrackingSession"
  "Payment" "Refund"
  "Customer" "CustomerNote" "CustomerSubscription"
  "Address" "CartItem" "Favorite" "Review"
  "Notification" "NotificationDevice"
  "SupportTicket" "OTPCode"
  "PartnerLocationHistory"
)
CONFIG_TABLES=(
  "Business" "Store" "Product" "Category" "Inventory"
  "DomainMapping" "PaymentGateway" "TaxConfig" "PromoCode"
  "User" "BusinessUser" "RefreshToken"
)

printf "\n%-30s %10s\n" "TABLE" "ROWS"
printf "%-30s %10s\n" "-----" "----"

for tbl in "${TRANSACTIONAL_TABLES[@]}"; do
  # Wrap in quotes for reserved words like Order
  cnt=$(q "SELECT COUNT(*) FROM \"${tbl}\";" 2>/dev/null || echo "0")
  PRE[$tbl]=$cnt
  printf "%-30s %10s\n" "$tbl" "$cnt"
done

# Special counts
BU_CUST=$(q "SELECT COUNT(*) FROM BusinessUser WHERE role='CUSTOMER';")
PRE["BusinessUser_CUSTOMER"]=$BU_CUST
USER_CUST=$(q "SELECT COUNT(*) FROM User
  WHERE (platformRole IS NULL OR platformRole='')
  AND NOT EXISTS (SELECT 1 FROM BusinessUser bu WHERE bu.userId=User.id AND bu.role!='CUSTOMER')
  AND EXISTS (SELECT 1 FROM BusinessUser bu WHERE bu.userId=User.id);")
PRE["User_customerOnly"]=$USER_CUST
printf "%-30s %10s\n" "BusinessUser (role=CUSTOMER)" "$BU_CUST"
printf "%-30s %10s\n" "User (customer-only)" "$USER_CUST"

# =============================================================================
# SECTION 2 — BUSINESS-WISE SUMMARY
# =============================================================================
echo ""
info "SECTION 2: Business-wise summary"

SUMMARY_ROWS=$(q "
SELECT
  b.name || '|' || COALESCE(b.slug,'') || '|' ||
  COUNT(DISTINCT c.id) || '|' ||
  COUNT(DISTINCT o.id) || '|' ||
  ROUND(COALESCE(SUM(o.totalAmount),0),2)
FROM Business b
LEFT JOIN Customer c ON c.businessId = b.id
LEFT JOIN \"Order\" o ON o.businessId = b.id
GROUP BY b.id, b.name, b.slug
ORDER BY b.name;
")

printf "\n%-25s %-20s %12s %12s %15s\n" "BUSINESS" "SLUG" "CUSTOMERS" "ORDERS" "REVENUE (₹)"
printf "%-25s %-20s %12s %12s %15s\n" "--------" "----" "---------" "------" "-----------"

SUMMARY_JSON="["
FIRST=1
while IFS='|' read -r bname bslug cust_cnt ord_cnt rev; do
  printf "%-25s %-20s %12s %12s %15s\n" "$bname" "$bslug" "$cust_cnt" "$ord_cnt" "$rev"
  [[ $FIRST -eq 0 ]] && SUMMARY_JSON+=","
  SUMMARY_JSON+="{\"business\":\"$bname\",\"slug\":\"$bslug\",\"customers\":$cust_cnt,\"orders\":$ord_cnt,\"revenue\":$rev}"
  FIRST=0
done <<< "$SUMMARY_ROWS"
SUMMARY_JSON+="]"

TOTAL_CUSTOMERS=$(q "SELECT COUNT(*) FROM Customer;")
TOTAL_ORDERS=$(q "SELECT COUNT(*) FROM \"Order\";")
TOTAL_REVENUE=$(q "SELECT ROUND(COALESCE(SUM(totalAmount),0),2) FROM \"Order\";")
printf "%-25s %-20s %12s %12s %15s\n" "TOTAL" "" "$TOTAL_CUSTOMERS" "$TOTAL_ORDERS" "$TOTAL_REVENUE"

# =============================================================================
# SECTION 3 — BACKUP
# =============================================================================
echo ""
info "SECTION 3: Creating backup"

mkdir -p "$BACKUP_DIR"

info "Copying database → $BACKUP_DB"
cp "$DB" "$BACKUP_DB"
BACKUP_SIZE=$(du -sh "$BACKUP_DB" | cut -f1)
ok "Backup created: $BACKUP_DB ($BACKUP_SIZE)"

# =============================================================================
# SECTION 4 — JSON REPORT
# =============================================================================
info "Creating JSON report → $BACKUP_JSON"

# Build pre_counts JSON
PRE_JSON="{"
FIRST=1
for key in "${!PRE[@]}"; do
  [[ $FIRST -eq 0 ]] && PRE_JSON+=","
  PRE_JSON+="\"$key\":${PRE[$key]}"
  FIRST=0
done
PRE_JSON+="}"

cat > "$BACKUP_JSON" <<EOF
{
  "report_type": "quantix_tenant_reset_pre_check",
  "generated_at": "$(date -Iseconds)",
  "database": "$DB",
  "backup_file": "$BACKUP_DB",
  "pre_counts": $PRE_JSON,
  "business_summary": $SUMMARY_JSON,
  "totals": {
    "customers": $TOTAL_CUSTOMERS,
    "orders": $TOTAL_ORDERS,
    "revenue": $TOTAL_REVENUE
  }
}
EOF
ok "JSON report: $BACKUP_JSON"

# Verify backup is valid SQLite before proceeding
BACKUP_CHECK=$(sqlite3 "$BACKUP_DB" "SELECT COUNT(*) FROM \"Order\";" 2>/dev/null || echo "INVALID")
if [[ "$BACKUP_CHECK" != "${PRE[Order]}" ]]; then
  error "Backup verification failed — order count mismatch. Aborting."
  exit 1
fi
ok "Backup verified (Order count matches: $BACKUP_CHECK)"

# =============================================================================
# SECTION 5 — TRANSACTIONAL RESET
# =============================================================================
echo ""
info "SECTION 5: Executing transactional reset"
warn "This will permanently delete all customer data. Backup is at: $BACKUP_DB"
echo ""

q "
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

BEGIN TRANSACTION;

-- ── Order chain (most dependent first) ──────────────────────────────────────
DELETE FROM LiveTrackingSession;
DELETE FROM PartnerLocationHistory WHERE orderId IS NOT NULL;
DELETE FROM Refund;
DELETE FROM Payment;
DELETE FROM OrderStatusHistory;
DELETE FROM OrderItem;
DELETE FROM Delivery;
DELETE FROM [Order];

-- ── Customer chain ───────────────────────────────────────────────────────────
DELETE FROM SupportTicket WHERE customerId IS NOT NULL;
DELETE FROM CustomerNote;
DELETE FROM CustomerSubscription;
DELETE FROM Review;
DELETE FROM Favorite;
DELETE FROM CartItem;
DELETE FROM Address;
DELETE FROM Customer;

-- ── Auth & notifications ─────────────────────────────────────────────────────
DELETE FROM OTPCode;
DELETE FROM Notification;

-- NotificationDevice: only for customer-only users
DELETE FROM NotificationDevice
WHERE userId IN (
  SELECT id FROM User
  WHERE (platformRole IS NULL OR platformRole = '')
  AND NOT EXISTS (
    SELECT 1 FROM BusinessUser bu
    WHERE bu.userId = User.id AND bu.role != 'CUSTOMER'
  )
);

-- RefreshToken: only for customer-only users
DELETE FROM RefreshToken
WHERE userId IN (
  SELECT id FROM User
  WHERE (platformRole IS NULL OR platformRole = '')
  AND NOT EXISTS (
    SELECT 1 FROM BusinessUser bu
    WHERE bu.userId = User.id AND bu.role != 'CUSTOMER'
  )
);

-- BusinessUser customer links
DELETE FROM BusinessUser WHERE role = 'CUSTOMER';

-- Pure customer User records (no BU links left, no platform role)
DELETE FROM User
WHERE (platformRole IS NULL OR platformRole = '')
AND NOT EXISTS (SELECT 1 FROM BusinessUser bu WHERE bu.userId = User.id);

-- ── Reset derived/cached counters ────────────────────────────────────────────
UPDATE PromoCode SET usedCount = 0;
UPDATE Inventory SET reservedQty = 0 WHERE reservedQty > 0;

-- ── Clear order-triggered inventory logs ─────────────────────────────────────
DELETE FROM InventoryLog
WHERE action IN ('RESERVED', 'RELEASED', 'SOLD', 'RETURN', 'ORDER');

COMMIT;
"

ok "Transaction committed"

# =============================================================================
# SECTION 6 — POST-CHECK: transactional tables must be empty
# =============================================================================
echo ""
info "SECTION 6: Post-check — transactional tables"

declare -A POST_TRANS
POST_TRANS_FAIL=0
printf "\n%-30s %12s %12s %8s\n" "TABLE" "BEFORE" "AFTER" "STATUS"
printf "%-30s %12s %12s %8s\n" "-----" "------" "-----" "------"

for tbl in "${TRANSACTIONAL_TABLES[@]}"; do
  cnt=$(q "SELECT COUNT(*) FROM \"${tbl}\";" 2>/dev/null || echo "?")
  POST_TRANS[$tbl]=$cnt
  if [[ "$cnt" == "0" ]]; then
    status="${GREEN}EMPTY${NC}"
  else
    status="${RED}NOT EMPTY${NC}"
    POST_TRANS_FAIL=1
    FAIL=1
  fi
  printf "%-30s %12s %12s " "$tbl" "${PRE[$tbl]:-?}" "$cnt"
  echo -e "$status"
done

# BusinessUser customer count should be 0
BU_CUST_POST=$(q "SELECT COUNT(*) FROM BusinessUser WHERE role='CUSTOMER';")
printf "%-30s %12s %12s " "BusinessUser(CUSTOMER)" "$BU_CUST" "$BU_CUST_POST"
[[ "$BU_CUST_POST" == "0" ]] && echo -e "${GREEN}EMPTY${NC}" || { echo -e "${RED}NOT EMPTY${NC}"; FAIL=1; }

if [[ $POST_TRANS_FAIL -ne 0 ]]; then
  error "Some transactional tables are not empty — investigate before proceeding"
fi

# =============================================================================
# SECTION 7 — POST-CHECK: config tables must be intact
# =============================================================================
echo ""
info "SECTION 7: Post-check — config tables intact"

printf "\n%-25s %12s %8s\n" "TABLE" "ROWS" "STATUS"
printf "%-25s %12s %8s\n" "-----" "----" "------"

CONFIG_CHECKS=(
  "Business:>0"
  "Store:>0"
  "Product:>=0"
  "Category:>=0"
  "Inventory:>=0"
  "DomainMapping:>0"
)

for entry in "${CONFIG_CHECKS[@]}"; do
  tbl="${entry%%:*}"
  op="${entry##*:}"
  cnt=$(q "SELECT COUNT(*) FROM \"${tbl}\";" 2>/dev/null || echo "0")
  # Evaluate condition
  passes=$(awk "BEGIN {print ($cnt $op) ? 1 : 0}")
  printf "%-25s %12s " "$tbl" "$cnt"
  if [[ "$passes" == "1" ]]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}MISSING DATA${NC}"
    FAIL=1
  fi
done

# Admin users must remain
ADMIN_USERS=$(q "SELECT COUNT(*) FROM User
  WHERE platformRole IS NOT NULL AND platformRole != ''
  OR EXISTS (
    SELECT 1 FROM BusinessUser bu WHERE bu.userId = User.id
    AND bu.role NOT IN ('CUSTOMER','DELIVERY_STAFF')
  );")
printf "%-25s %12s " "User (admin/staff)" "$ADMIN_USERS"
[[ "$ADMIN_USERS" -gt 0 ]] && echo -e "${GREEN}OK${NC}" || { echo -e "${RED}NO ADMIN USERS${NC}"; FAIL=1; }

# =============================================================================
# SECTION 8 — ORPHAN / FK VALIDATION
# =============================================================================
echo ""
info "SECTION 8: Orphan / FK validation"

printf "\n%-40s %10s %8s\n" "CHECK" "COUNT" "STATUS"
printf "%-40s %10s %8s\n" "-----" "-----" "------"

run_check() {
  local label="$1"
  local sql="$2"
  local cnt
  cnt=$(q "$sql" 2>/dev/null || echo "?")
  printf "%-40s %10s " "$label" "$cnt"
  if [[ "$cnt" == "0" ]]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}ORPHANS FOUND${NC}"
    FAIL=1
  fi
}

run_check "Orders without valid business" \
  "SELECT COUNT(*) FROM [Order] o WHERE NOT EXISTS (SELECT 1 FROM Business b WHERE b.id=o.businessId);"

run_check "Orders with missing customer ref" \
  "SELECT COUNT(*) FROM [Order] o WHERE o.customerId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Customer c WHERE c.id=o.customerId);"

run_check "Addresses without customer" \
  "SELECT COUNT(*) FROM Address a WHERE NOT EXISTS (SELECT 1 FROM Customer c WHERE c.id=a.customerId);"

run_check "CartItems without customer" \
  "SELECT COUNT(*) FROM CartItem ci WHERE NOT EXISTS (SELECT 1 FROM Customer c WHERE c.id=ci.customerId);"

run_check "Favorites without customer" \
  "SELECT COUNT(*) FROM Favorite f WHERE NOT EXISTS (SELECT 1 FROM Customer c WHERE c.id=f.customerId);"

run_check "RefreshTokens without user" \
  "SELECT COUNT(*) FROM RefreshToken rt WHERE NOT EXISTS (SELECT 1 FROM User u WHERE u.id=rt.userId);"

run_check "Payments without order" \
  "SELECT COUNT(*) FROM Payment p WHERE NOT EXISTS (SELECT 1 FROM [Order] o WHERE o.id=p.orderId);"

run_check "Notifications without business" \
  "SELECT COUNT(*) FROM Notification n WHERE n.businessId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Business b WHERE b.id=n.businessId);"

# =============================================================================
# SECTION 9 — FINAL SUMMARY
# =============================================================================
echo ""
info "SECTION 9: Final summary"

REMAIN_BUSINESSES=$(q "SELECT COUNT(*) FROM Business;")
REMAIN_PRODUCTS=$(q "SELECT COUNT(*) FROM Product;")
REMAIN_CATEGORIES=$(q "SELECT COUNT(*) FROM Category;")
REMAIN_STORES=$(q "SELECT COUNT(*) FROM Store;")
REMAIN_INVENTORY=$(q "SELECT COUNT(*) FROM Inventory;")
REMAIN_DOMAINS=$(q "SELECT COUNT(*) FROM DomainMapping;")

# Build rows-deleted per table
echo ""
printf "%-30s %12s %12s %12s\n" "TABLE" "BEFORE" "AFTER" "DELETED"
printf "%-30s %12s %12s %12s\n" "-----" "------" "-----" "-------"

DELETED_JSON="{"
FIRST=1
TOTAL_DELETED=0

for tbl in "${TRANSACTIONAL_TABLES[@]}"; do
  before=${PRE[$tbl]:-0}
  after=${POST_TRANS[$tbl]:-0}
  deleted=$((before - after))
  TOTAL_DELETED=$((TOTAL_DELETED + deleted))
  printf "%-30s %12s %12s %12s\n" "$tbl" "$before" "$after" "$deleted"
  [[ $FIRST -eq 0 ]] && DELETED_JSON+=","
  DELETED_JSON+="\"$tbl\":$deleted"
  FIRST=0
done

# Add BU and Users
before_bu=$BU_CUST
after_bu=$BU_CUST_POST
del_bu=$((before_bu - after_bu))
printf "%-30s %12s %12s %12s\n" "BusinessUser(CUSTOMER)" "$before_bu" "$after_bu" "$del_bu"
DELETED_JSON+=",\"BusinessUser_CUSTOMER\":$del_bu"

before_u=${PRE[User_customerOnly]:-0}
after_u=$(q "SELECT COUNT(*) FROM User WHERE (platformRole IS NULL OR platformRole='') AND NOT EXISTS (SELECT 1 FROM BusinessUser bu WHERE bu.userId=User.id);")
del_u=$((before_u - after_u))
DELETED_JSON+=",\"User_customerOnly\":$del_u"
DELETED_JSON+="}"

echo ""
printf "%-30s %12s\n" "TOTAL ROWS DELETED" "$TOTAL_DELETED"

echo ""
echo "── Config remaining ──────────────────────────────────────"
printf "%-25s %s\n" "Businesses:" "$REMAIN_BUSINESSES"
printf "%-25s %s\n" "Stores:" "$REMAIN_STORES"
printf "%-25s %s\n" "Products:" "$REMAIN_PRODUCTS"
printf "%-25s %s\n" "Categories:" "$REMAIN_CATEGORIES"
printf "%-25s %s\n" "Inventory rows:" "$REMAIN_INVENTORY"
printf "%-25s %s\n" "Domain mappings:" "$REMAIN_DOMAINS"
printf "%-25s %s\n" "Admin/staff users:" "$ADMIN_USERS"

# Write final JSON — exact format requested
VALIDATION_STATUS="PASS"
[[ $FAIL -ne 0 ]] && VALIDATION_STATUS="FAIL"

FINAL_JSON="${BACKUP_DIR}/reset_result_${TS}.json"
cat > "$FINAL_JSON" <<EOF
{
  "backup_file": "$BACKUP_DB",
  "rows_deleted": $DELETED_JSON,
  "remaining_businesses": $REMAIN_BUSINESSES,
  "remaining_stores": $REMAIN_STORES,
  "remaining_products": $REMAIN_PRODUCTS,
  "remaining_categories": $REMAIN_CATEGORIES,
  "validation": "$VALIDATION_STATUS",
  "_meta": {
    "report_type": "quantix_tenant_reset_result",
    "completed_at": "$(date -Iseconds)",
    "pre_report": "$BACKUP_JSON",
    "inventory_rows": $REMAIN_INVENTORY,
    "domain_mappings": $REMAIN_DOMAINS,
    "admin_staff_users": $ADMIN_USERS
  }
}
EOF
ok "Result JSON: $FINAL_JSON"

echo ""
echo "============================================================"
if [[ $FAIL -eq 0 ]]; then
  echo -e " ${GREEN}RESET COMPLETE — ALL VALIDATIONS PASSED${NC}"
else
  echo -e " ${RED}RESET COMPLETE — VALIDATION FAILURES DETECTED${NC}"
  echo -e " ${RED}Review the FAIL lines above before proceeding.${NC}"
  echo -e " ${YELLOW}Backup is safe at: $BACKUP_DB${NC}"
fi
echo " Backup:      $BACKUP_DB"
echo " Pre-report:  $BACKUP_JSON"
echo " Post-result: $FINAL_JSON"
echo "============================================================"
echo ""

[[ $FAIL -ne 0 ]] && exit 1
exit 0
