# Worklog — Quantix Core Platform

## Task 1: Fix Seed Route

**File:** `/home/z/my-project/src/app/api/core/seed/route.ts`

### Issues Fixed

1. **Business status `'TRIAL'` → `'ACTIVE'`** — The `BusinessStatus` enum only has: ONBOARDING, ACTIVE, SUSPENDED, CHURNED. Changed from `'TRIAL'` to `'ACTIVE'`.

2. **Removed `trialStartsAt` and `trialEndsAt` from Business creation** — The `Business` model does not have these fields. Replaced with `activatedAt` and `onboardedAt` timestamps.

3. **BusinessSubscription status `'TRIAL'` → `'ACTIVE'`** — The `SubscriptionStatus` enum only has: ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED. Changed from `'TRIAL'` to `'ACTIVE'`.

4. **Removed `trialStart` and `trialEnd` from BusinessSubscription creation** — The `BusinessSubscription` model does not have these fields. Added `paymentVerified`, `paymentVerifiedAt`, `paymentVerifiedBy` fields instead.

5. **PlatformPlan `tier` field → `billingCycle`** — The schema uses `billingCycle` (PlanBillingCycle enum: MONTHLY, YEARLY), not `tier`. Restructured from 3 plans (Starter/Professional/Enterprise with tier) to 2 plans matching the schema (Quantix Monthly/Quantix Yearly with billingCycle).

6. **Set business ID to `"biz_1"`** — Changed the Business upsert to use `where: { id: 'biz_1' }` and `create: { id: 'biz_1', ... }` so frontend components using `BUSINESS_ID = "biz_1"` can find the data.

7. **PlatformPlan upsert `where` clause** — Changed from `where: { id: planId }` (using tier-derived IDs) to `where: { billingCycle: plan.billingCycle }` (using the `@unique` field). Also dynamically resolved the monthly plan ID for the BusinessSubscription foreign key.

8. **Removed `sortOrder` from PlatformPlan** — Not a field in the schema.

9. **Fixed `billingCycle` in BusinessSubscription** — Changed from `'monthly'` (string) to `'MONTHLY'` (enum value).

### Verification

```bash
curl -X POST http://localhost:3000/api/core/seed
```

Response confirmed success:
```json
{
  "success": true,
  "data": {
    "platformConfigs": 12,
    "platformPlans": 2,
    "superAdmin": { "id": "cmoy2z4aj000ovhs0jyn8gpoi", "email": "admin@quantixtechnology.in" },
    "salesTeamMember": { "id": "cmoy2z4an000rvhs09emzmdos", "name": "Priya Sharma" },
    "business": { "id": "biz_1", "name": "FreshMart Grocery" },
    "subscription": { "id": "cmoy2zieb001bvhs0999rseuk", "status": "ACTIVE" },
    "modules": ["grocery", "catalog"],
    "store": { "id": "store_freshmart_main", "name": "FreshMart Main Store" },
    "storeTimings": 7,
    "taxConfigs": 5,
    "deliveryZone": { "id": "zone_biz_1_main", "name": "Andheri West - 5km" },
    "deliveryPartner": { "id": "dp_biz_1_ravi", "name": "Ravi Kumar" },
    "customers": 5,
    "categories": 12,
    "products": 30,
    "orders": 5
  },
  "message": "Platform seeded successfully"
}
```

---

## Task 2: Create Platform Stats API Route

**File:** `/home/z/my-project/src/app/api/core/platform/stats/route.ts`

### Implementation

Created a GET endpoint that returns platform dashboard statistics using Prisma queries:
- `totalBusinesses` — Count of all businesses
- `activeBusinesses` — Count of businesses with status ACTIVE
- `totalCustomers` — Count of all customers
- `totalOrders` — Count of all orders
- `totalRevenue` — Sum of totalAmount for orders with COMPLETED payment status
- `totalLeads` — Count of all leads
- `activeLeads` — Count of leads not in LOST or CHURNED stage
- `recentOrders` — Count of orders created in the last 30 days

All queries run in parallel using `Promise.all` for optimal performance.

### Verification

```bash
curl http://localhost:3000/api/core/platform/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "totalBusinesses": 1,
    "activeBusinesses": 1,
    "totalCustomers": 5,
    "totalOrders": 5,
    "totalRevenue": 1371,
    "totalLeads": 0,
    "activeLeads": 0,
    "recentOrders": 5
  }
}
```

### Lint Check

`bun run lint` passed with no errors.

---

## Task 3: Fix API Client Paths & Frontend Bugs

**Files Modified:**
- `/home/z/my-project/src/lib/api-client.ts`
- `/home/z/my-project/src/hooks/use-api.ts`
- `/home/z/my-project/src/components/business/customers/customers-view.tsx`
- `/home/z/my-project/src/app/api/core/orders/route.ts`
- `/home/z/my-project/src/app/api/core/businesses/[businessId]/dashboard/route.ts` (new)

### Root Cause Analysis

Both the Orders and Customers pages showed "Failed to load" errors because:
1. **API Client paths were wrong** — The API client used paths like `/customers`, `/orders`, `/products` etc., which resolved to `/api/customers`, `/api/orders`, etc. But the actual Next.js API routes are at `/api/core/...`. This caused all API calls to return 404.
2. **Customer API path required businessId** — The actual route is `/api/core/businesses/[businessId]/customers`, but the client was calling `/api/customers`.
3. **NaN% bug** — When totalCustomers was 0, `(activeThisMonth / totalCustomers) * 100` resulted in NaN.
4. **Hardcoded date** — Active this month calculation used hardcoded year 2025.
5. **Filters visible during error state** — The filter bar was shown even when data failed to load, creating visual clutter.
6. **Orders status filter** — Comma-separated status values (e.g., "PENDING,CONFIRMED") were passed as a single string instead of being split into an array.
7. **Missing dashboard route** — `/api/core/businesses/[businessId]/dashboard` returned 404.

### Changes Made

1. **Fixed all API client paths** in `api-client.ts`:
   - `/customers` → `/core/businesses/${businessId}/customers` (dynamic businessId from context)
   - `/orders` → `/core/orders`
   - `/products` → `/core/storefront/products`
   - `/businesses` → `/core/businesses`
   - `/stores` → `/core/stores`
   - `/leads` → `/core/leads`
   - `/subscriptions/plans` → `/core/subscriptions/plans`
   - `/delivery/partners` → `/core/delivery/partners`
   - `/delivery/zones` → `/core/delivery/zones`
   - `/invoices` → `/core/invoices`
   - `/platform/stats` → `/core/platform/stats`
   - `/auth/register` → `/core/auth/register`
   - `/auth/forgot-password` → `/core/auth/forgot-password`

2. **Fixed categories hook** in `use-api.ts`: Changed `/api/core/products?fields=category` to `/api/core/storefront/products?fields=category`.

3. **Fixed NaN% bug** in `customers-view.tsx`:
   - Changed `${((activeThisMonth / totalCustomers) * 100).toFixed(0)}%` to `${totalCustomers > 0 ? ((activeThisMonth / totalCustomers) * 100).toFixed(0) : 0}%`

4. **Fixed active this month calculation** — Replaced hardcoded `getMonth() === 0 && getFullYear() === 2025` with dynamic `d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()`.

5. **Fixed error state display** — Moved the error state check before the stats cards and filter bar, so when data fails to load, only the error message is shown (not the filters).

6. **Fixed orders API status filter** — Parse comma-separated status values into arrays: `statusParam ? statusParam.split(',') : undefined`.

7. **Created business dashboard API route** at `/api/core/businesses/[businessId]/dashboard/route.ts` — Returns comprehensive dashboard stats including orders, revenue, customers, products, stores, and recent orders.

### Verification

All API endpoints now return 200:
- `GET /api/core/orders?businessId=biz_1&limit=5` → 200 ✓
- `GET /api/core/businesses/biz_1/customers?limit=5` → 200 ✓
- `GET /api/core/platform/stats` → 200 ✓
- `GET /api/core/businesses/biz_1/dashboard` → 200 ✓
- `GET /api/core/orders?businessId=biz_1&status=PENDING,CONFIRMED` → 200 ✓

`bun run lint` passed with no errors.
