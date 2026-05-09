# Task 1: Add Business-Specific Dashboard Demo Data

## Agent: Data Agent

## Summary
Added comprehensive dashboard demo data to `/src/lib/demo-data.ts` for all 4 business types (standard_grocery, standard_laundry, pro_laundry, pro_carwash).

## Changes Made

### New Interfaces
- `DemoDashboardStats` — 10-field dashboard statistics
- `DemoRecentActivityItem` — activity feed items with type/message/time
- `DemoBusinessOrder` — full order model with items, payment, delivery, workflow
- `DemoBusinessOrderItem` — order line item with name/variant/quantity/price

### New Data Structures
1. **Dashboard Stats** — per business: todayRevenue, todayOrders, pendingOrders, totalCustomers, avgOrderValue, totalProducts, lowStockProducts, activeStores, totalDeliveryPartners, deliveryPartnersOnline
2. **Daily Sales** — 7 days (Mon-Sun) with revenue/orders per day
3. **Hourly Sales** — 18 hours (6AM-11PM) with revenue per hour and business-specific peak patterns
4. **Recent Activity** — 5 items per business with context-appropriate messages
5. **Top Products** — 5 products per business with sold count and revenue
6. **Business Orders** — 6 sample orders per business with full detail

### New Export Functions
- `getDemoDashboardStats(demoBusinessId)` → DemoDashboardStats
- `getDemoDailySales(demoBusinessId)` → { date, revenue, orders }[]
- `getDemoHourlySales(demoBusinessId)` → { hour, revenue }[]
- `getDemoRecentActivity(demoBusinessId)` → DemoRecentActivityItem[]
- `getDemoTopProducts(demoBusinessId)` → { name, sold, revenue }[]
- `getDemoBusinessOrders(demoBusinessId)` → DemoBusinessOrder[]

### Default Behavior
- All functions default to grocery data for `super_admin` / unknown IDs

## Verification
- Lint passes cleanly
- Dev server compiles successfully
