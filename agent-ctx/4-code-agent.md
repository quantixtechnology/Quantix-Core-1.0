# Task 4 — Code Agent Work Record

## Task
Add missing context-aware data functions to `/home/z/my-project/src/lib/demo-data.ts` for the Reports View

## What Was Done

### 1. Added 4 new data array sections to demo-data.ts (before DATA ACCESS FUNCTIONS section)

- **Category Revenue Data** — per business type arrays:
  - `groceryCategoryRevenueData` (9 categories)
  - `laundryCategoryRevenueData` (3 categories)
  - `proLaundryCategoryRevenueData` (5 categories)
  - `carwashCategoryRevenueData` (5 categories)

- **Payment Summary** — per business type arrays:
  - `groceryPaymentSummary` (UPI, Cash, Card, COD)
  - `laundryPaymentSummary` (UPI, Cash, Card, Wallet)
  - `proLaundryPaymentSummary` (UPI, Card, Cash, Wallet)
  - `carwashPaymentSummary` (UPI, Card, Cash, Wallet)

- **Order Type Data** — per business type arrays:
  - `groceryOrderTypeData` (Delivery, POS, Takeaway)
  - `laundryOrderTypeData` (Pickup, Delivery, Walk-in)
  - `proLaundryOrderTypeData` (Pickup, Delivery, Subscription, Walk-in)
  - `carwashOrderTypeData` (Subscription, Pickup, Appointment, Walk-in, POS)

- **Order Status Data** — per business type arrays:
  - `groceryOrderStatusData` (6 statuses)
  - `laundryOrderStatusData` (5 statuses)
  - `proLaundryOrderStatusData` (6 statuses)
  - `carwashOrderStatusData` (6 statuses)

### 2. Added 4 new exported functions at end of demo-data.ts

- `getDemoCategoryRevenueData(demoBusinessId: string): { category: string; revenue: number; percentage: string }[]`
- `getDemoPaymentSummary(demoBusinessId: string): { method: string; count: number; amount: number; percentage: number }[]`
- `getDemoOrderTypeData(demoBusinessId: string): { name: string; value: number; color: string }[]`
- `getDemoOrderStatusData(demoBusinessId: string): { status: string; count: number; percentage: string }[]`

All follow the same switch/case pattern as existing functions (standard_grocery, standard_laundry, pro_laundry, pro_carwash).

### 3. Updated reports-view.tsx to use context-aware functions

- Imported `useAdminStore` and 7 `getDemo*` functions
- Replaced all hardcoded data arrays with `useMemo(() => getDemo*(demoBusinessId), [demoBusinessId])`
- Made chart configs dynamic via `buildOrderTypeChartConfig()` and `buildPaymentChartConfig()`
- Replaced hardcoded "UPI vs Cash vs Card" section with dynamic top-3 payment method comparison
- Updated order status Badge variant logic to handle business-specific statuses (Delivered/Completed, Completed, Ready for Delivery, Out for Delivery)

## Verification
- `bun run lint` — 0 errors
- Dev server running successfully on port 3000
- No existing code modified or broken
