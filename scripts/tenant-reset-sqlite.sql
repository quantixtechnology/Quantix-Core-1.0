-- Tenant reset SQL script (SQLite)
-- Usage: sqlite3 prisma/db/custom.db ".read scripts/tenant-reset-sqlite.sql"
-- Replace :BUSINESS_ID in a supported way (e.g. edit file or use shell substitution)

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Order-related children
DELETE FROM OrderItem WHERE orderId IN (SELECT id FROM "Order" WHERE businessId = ':BUSINESS_ID');
DELETE FROM OrderStatusHistory WHERE orderId IN (SELECT id FROM "Order" WHERE businessId = ':BUSINESS_ID');
DELETE FROM PartnerLocationHistory WHERE orderId IN (SELECT id FROM "Order" WHERE businessId = ':BUSINESS_ID');
DELETE FROM LiveTrackingSession WHERE orderId IN (SELECT id FROM "Order" WHERE businessId = ':BUSINESS_ID');

-- Delivery/refunds/payments/invoices
DELETE FROM Delivery WHERE orderId IN (SELECT id FROM "Order" WHERE businessId = ':BUSINESS_ID');
DELETE FROM Refund WHERE businessId = ':BUSINESS_ID';
DELETE FROM Payment WHERE businessId = ':BUSINESS_ID';
DELETE FROM Invoice WHERE businessId = ':BUSINESS_ID';

-- Subscription & billing (best-effort)
DELETE FROM BillingInvoiceItem WHERE invoiceId IN (SELECT id FROM BillingInvoice WHERE accountId IN (SELECT id FROM BillingAccount WHERE businessId = ':BUSINESS_ID'));
DELETE FROM BillingInvoice WHERE accountId IN (SELECT id FROM BillingAccount WHERE businessId = ':BUSINESS_ID');
DELETE FROM BillingPayment WHERE accountId IN (SELECT id FROM BillingAccount WHERE businessId = ':BUSINESS_ID');
DELETE FROM BillingLedger WHERE accountId IN (SELECT id FROM BillingAccount WHERE businessId = ':BUSINESS_ID');
DELETE FROM BillingAudit WHERE accountId IN (SELECT id FROM BillingAccount WHERE businessId = ':BUSINESS_ID');
DELETE FROM BillingService WHERE accountId IN (SELECT id FROM BillingAccount WHERE businessId = ':BUSINESS_ID');
DELETE FROM BillingAccount WHERE businessId = ':BUSINESS_ID';

-- Orders (parent)
DELETE FROM OrderItem WHERE orderId IN (SELECT id FROM "Order" WHERE businessId = ':BUSINESS_ID');
DELETE FROM "Order" WHERE businessId = ':BUSINESS_ID';

-- Customer & related
DELETE FROM Address WHERE customerId IN (SELECT id FROM Customer WHERE businessId = ':BUSINESS_ID');
DELETE FROM CustomerNote WHERE customerId IN (SELECT id FROM Customer WHERE businessId = ':BUSINESS_ID');
DELETE FROM SupportTicket WHERE businessId = ':BUSINESS_ID';
DELETE FROM CustomerSubscription WHERE businessId = ':BUSINESS_ID';
DELETE FROM Customer WHERE businessId = ':BUSINESS_ID';

-- Inventory / products / categories
DELETE FROM InventoryLog WHERE inventoryId IN (SELECT id FROM Inventory WHERE businessId = ':BUSINESS_ID');
DELETE FROM Inventory WHERE businessId = ':BUSINESS_ID';
DELETE FROM ProductVariant WHERE productId IN (SELECT id FROM Product WHERE businessId = ':BUSINESS_ID');
DELETE FROM Product WHERE businessId = ':BUSINESS_ID';
DELETE FROM Category WHERE businessId = ':BUSINESS_ID';

-- POS, stores
DELETE FROM OrderStatusHistory WHERE orderId IN (SELECT id FROM "Order" WHERE businessId = ':BUSINESS_ID');
DELETE FROM POSSession WHERE businessId = ':BUSINESS_ID';
DELETE FROM StoreTiming WHERE storeId IN (SELECT id FROM Store WHERE businessId = ':BUSINESS_ID');
DELETE FROM "Store" WHERE businessId = ':BUSINESS_ID';

-- Business-level artifacts
DELETE FROM BusinessModule WHERE businessId = ':BUSINESS_ID';
DELETE FROM BusinessRole WHERE businessId = ':BUSINESS_ID';
DELETE FROM BusinessUser WHERE businessId = ':BUSINESS_ID';
DELETE FROM BusinessSubscription WHERE businessId = ':BUSINESS_ID';
DELETE FROM BusinessBranding WHERE businessId = ':BUSINESS_ID';
DELETE FROM AppConfig WHERE businessId = ':BUSINESS_ID';
DELETE FROM FeatureFlag WHERE businessId = ':BUSINESS_ID';
DELETE FROM WorkflowRule WHERE businessId = ':BUSINESS_ID';
DELETE FROM DeliveryPartner WHERE businessId = ':BUSINESS_ID';
DELETE FROM DeliveryZone WHERE businessId = ':BUSINESS_ID';

-- Notifications, promos, reviews, cart & favorites
DELETE FROM Notification WHERE businessId = ':BUSINESS_ID';
DELETE FROM NotificationDevice WHERE businessId = ':BUSINESS_ID';
DELETE FROM PromoCode WHERE businessId = ':BUSINESS_ID';
DELETE FROM Review WHERE businessId = ':BUSINESS_ID';
DELETE FROM CartItem WHERE businessId = ':BUSINESS_ID';
DELETE FROM Favorite WHERE businessId = ':BUSINESS_ID';

-- Misc
DELETE FROM Banner WHERE businessId = ':BUSINESS_ID';
DELETE FROM PartnerAudit WHERE businessId = ':BUSINESS_ID';
DELETE FROM Charge WHERE businessId = ':BUSINESS_ID';
DELETE FROM BillingDocument WHERE businessId = ':BUSINESS_ID';

-- Finally delete the business
DELETE FROM Business WHERE id = ':BUSINESS_ID';

COMMIT;
PRAGMA foreign_keys = ON;

-- Print counts remaining for key tables
.echo "Remaining counts (global):"
SELECT 'Users: ' || (SELECT COUNT(*) FROM "User");
SELECT 'Leads: ' || (SELECT COUNT(*) FROM Lead);
SELECT 'SalesTeamMember: ' || (SELECT COUNT(*) FROM SalesTeamMember);
SELECT 'Business: ' || (SELECT COUNT(*) FROM Business);
SELECT 'Customer: ' || (SELECT COUNT(*) FROM Customer);
SELECT 'Order: ' || (SELECT COUNT(*) FROM "Order");
