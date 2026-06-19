#!/usr/bin/env bash
# ============================================================
# QUANTIX TENANT RESET — production runner
# Usage: bash tenant-reset.sh [--dry-run]
#
# Connects to root@quantixtechnology.in, backs up the database,
# then executes the SQL reset script.
# Set DRY_RUN=1 or pass --dry-run to run pre-checks only.
# ============================================================
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

REMOTE="root@quantixtechnology.in"
REMOTE_DB="/home/ubuntu/data/custom.db"
BACKUP_DIR="/home/ubuntu/data/backups"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pre_reset_${TS}.db"

echo "======================================================"
echo " QUANTIX TENANT RESET"
echo " $(date)"
echo " DRY_RUN=${DRY_RUN}"
echo "======================================================"

# ── 1. Ensure backup directory exists ─────────────────────
ssh "$REMOTE" "mkdir -p ${BACKUP_DIR}"

# ── 2. Create backup ──────────────────────────────────────
echo ""
echo ">>> Creating backup: ${BACKUP_FILE}"
ssh "$REMOTE" "cp ${REMOTE_DB} ${BACKUP_FILE} && echo 'Backup OK: '$(stat -c%s ${BACKUP_FILE})' bytes'"

# ── 3. Run pre-check counts ───────────────────────────────
echo ""
echo ">>> PRE-CHECK: Row counts"
ssh "$REMOTE" sqlite3 "$REMOTE_DB" "
.mode column
.headers on
SELECT 'Order'                AS table_name, COUNT(*) AS rows FROM [Order]
UNION ALL SELECT 'OrderItem',               COUNT(*) FROM OrderItem
UNION ALL SELECT 'OrderStatusHistory',      COUNT(*) FROM OrderStatusHistory
UNION ALL SELECT 'Delivery',                COUNT(*) FROM Delivery
UNION ALL SELECT 'LiveTrackingSession',     COUNT(*) FROM LiveTrackingSession
UNION ALL SELECT 'Payment',                 COUNT(*) FROM Payment
UNION ALL SELECT 'Refund',                  COUNT(*) FROM Refund
UNION ALL SELECT 'Customer',                COUNT(*) FROM Customer
UNION ALL SELECT 'CustomerNote',            COUNT(*) FROM CustomerNote
UNION ALL SELECT 'CustomerSubscription',    COUNT(*) FROM CustomerSubscription
UNION ALL SELECT 'Address',                 COUNT(*) FROM Address
UNION ALL SELECT 'CartItem',                COUNT(*) FROM CartItem
UNION ALL SELECT 'Favorite',                COUNT(*) FROM Favorite
UNION ALL SELECT 'Review',                  COUNT(*) FROM Review
UNION ALL SELECT 'Notification',            COUNT(*) FROM Notification
UNION ALL SELECT 'NotificationDevice',      COUNT(*) FROM NotificationDevice
UNION ALL SELECT 'SupportTicket',           COUNT(*) FROM SupportTicket
UNION ALL SELECT 'OTPCode',                 COUNT(*) FROM OTPCode
UNION ALL SELECT 'PartnerLocationHistory',  COUNT(*) FROM PartnerLocationHistory
UNION ALL SELECT 'BU_role_CUSTOMER',        COUNT(*) FROM BusinessUser WHERE role='CUSTOMER'
UNION ALL SELECT 'User_customerOnly',       COUNT(*) FROM User
    WHERE (platformRole IS NULL OR platformRole='')
    AND NOT EXISTS (SELECT 1 FROM BusinessUser bu WHERE bu.userId=User.id AND bu.role!='CUSTOMER')
    AND EXISTS (SELECT 1 FROM BusinessUser bu WHERE bu.userId=User.id)
ORDER BY table_name;
"

# ── 4. Orders by business ─────────────────────────────────
echo ""
echo ">>> ORDER COUNTS BY BUSINESS"
ssh "$REMOTE" sqlite3 "$REMOTE_DB" "
.mode column
.headers on
SELECT b.name AS business, COUNT(o.id) AS orders, ROUND(COALESCE(SUM(o.totalAmount),0),2) AS revenue
FROM Business b
LEFT JOIN [Order] o ON o.businessId = b.id
GROUP BY b.id ORDER BY b.name;
"

# ── 5. Customers by business ──────────────────────────────
echo ""
echo ">>> CUSTOMER COUNTS BY BUSINESS"
ssh "$REMOTE" sqlite3 "$REMOTE_DB" "
.mode column
.headers on
SELECT b.name AS business, COUNT(c.id) AS customers
FROM Business b
LEFT JOIN Customer c ON c.businessId = b.id
GROUP BY b.id ORDER BY b.name;
"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo ">>> DRY_RUN mode — skipping deletions."
  echo ">>> Backup preserved at: ${BACKUP_FILE}"
  exit 0
fi

# ── 6. Execute deletions ──────────────────────────────────
echo ""
echo ">>> EXECUTING RESET (inside SQLite transaction)"
ssh "$REMOTE" sqlite3 "$REMOTE_DB" "
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

BEGIN TRANSACTION;

-- Order child tables (most specific first)
DELETE FROM LiveTrackingSession;
DELETE FROM PartnerLocationHistory WHERE orderId IS NOT NULL;
DELETE FROM Refund;
DELETE FROM Payment;
DELETE FROM OrderStatusHistory;
DELETE FROM OrderItem;
DELETE FROM Delivery;
DELETE FROM [Order];

-- Customer child tables
DELETE FROM SupportTicket;
DELETE FROM CustomerNote;
DELETE FROM CustomerSubscription;
DELETE FROM Review;
DELETE FROM Favorite;
DELETE FROM CartItem;
DELETE FROM Address;
DELETE FROM Customer;

-- Auth / session data
DELETE FROM OTPCode;
DELETE FROM Notification;
DELETE FROM NotificationDevice
  WHERE userId IN (
    SELECT id FROM User
    WHERE (platformRole IS NULL OR platformRole = '')
    AND NOT EXISTS (
      SELECT 1 FROM BusinessUser bu WHERE bu.userId = User.id AND bu.role != 'CUSTOMER'
    )
  );

-- Tokens for customer-only users (users with CUSTOMER role only, no platform role)
DELETE FROM RefreshToken
  WHERE userId IN (
    SELECT id FROM User
    WHERE (platformRole IS NULL OR platformRole = '')
    AND NOT EXISTS (
      SELECT 1 FROM BusinessUser bu WHERE bu.userId = User.id AND bu.role != 'CUSTOMER'
    )
  );

-- Customer BusinessUser links
DELETE FROM BusinessUser WHERE role = 'CUSTOMER';

-- Pure customer User records (no remaining BusinessUser links, no platformRole)
DELETE FROM User
  WHERE (platformRole IS NULL OR platformRole = '')
  AND NOT EXISTS (SELECT 1 FROM BusinessUser bu WHERE bu.userId = User.id);

-- Reset promo code usage counters (orders are gone so usedCount is stale)
UPDATE PromoCode SET usedCount = 0;

-- Reset inventory reserved quantities (reserved against now-deleted orders)
UPDATE Inventory SET reservedQty = 0 WHERE reservedQty > 0;

-- Clear order-triggered inventory movement logs
DELETE FROM InventoryLog WHERE action IN ('RESERVED','RELEASED','SOLD','RETURN');

COMMIT;
"

echo ""
echo ">>> TRANSACTION COMMITTED"

# ── 7. Post-check ─────────────────────────────────────────
echo ""
echo ">>> POST-CHECK: Verify clean tables"
ssh "$REMOTE" sqlite3 "$REMOTE_DB" "
.mode column
.headers on
SELECT 'Order' AS table_name, COUNT(*) AS rows FROM [Order]
UNION ALL SELECT 'OrderItem',            COUNT(*) FROM OrderItem
UNION ALL SELECT 'Customer',             COUNT(*) FROM Customer
UNION ALL SELECT 'Address',              COUNT(*) FROM Address
UNION ALL SELECT 'CartItem',             COUNT(*) FROM CartItem
UNION ALL SELECT 'Favorite',             COUNT(*) FROM Favorite
UNION ALL SELECT 'Review',               COUNT(*) FROM Review
UNION ALL SELECT 'Notification',         COUNT(*) FROM Notification
UNION ALL SELECT 'Payment',              COUNT(*) FROM Payment
ORDER BY table_name;
"

echo ""
echo ">>> POST-CHECK: Verify config intact"
ssh "$REMOTE" sqlite3 "$REMOTE_DB" "
.mode column
.headers on
SELECT 'Business' AS table_name, COUNT(*) AS rows FROM Business
UNION ALL SELECT 'Store',      COUNT(*) FROM Store
UNION ALL SELECT 'Product',    COUNT(*) FROM Product
UNION ALL SELECT 'Category',   COUNT(*) FROM Category
UNION ALL SELECT 'Inventory',  COUNT(*) FROM Inventory
UNION ALL SELECT 'DomainMapping', COUNT(*) FROM DomainMapping
UNION ALL SELECT 'PaymentGateway', COUNT(*) FROM PaymentGateway
UNION ALL SELECT 'User_admin', COUNT(*) FROM User
  WHERE platformRole IS NOT NULL AND platformRole != ''
     OR EXISTS (
       SELECT 1 FROM BusinessUser bu WHERE bu.userId = User.id
       AND bu.role NOT IN ('CUSTOMER','DELIVERY_STAFF')
     )
ORDER BY table_name;
"

# ── 8. Orphan check ───────────────────────────────────────
echo ""
echo ">>> ORPHAN CHECK"
ssh "$REMOTE" sqlite3 "$REMOTE_DB" "
.mode column
.headers on
-- Any orders left with missing customers
SELECT 'orphan_orders_no_customer' AS check_name,
       COUNT(*) AS count
FROM [Order] o
WHERE o.customerId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM Customer c WHERE c.id = o.customerId)

UNION ALL
-- Any addresses left with missing customers
SELECT 'orphan_addresses_no_customer', COUNT(*)
FROM Address a
WHERE NOT EXISTS (SELECT 1 FROM Customer c WHERE c.id = a.customerId)

UNION ALL
-- RefreshToken for deleted users
SELECT 'orphan_tokens_no_user', COUNT(*)
FROM RefreshToken rt
WHERE NOT EXISTS (SELECT 1 FROM User u WHERE u.id = rt.userId);
"

echo ""
echo "======================================================"
echo " RESET COMPLETE"
echo " Backup: ${BACKUP_FILE}"
echo "======================================================"
