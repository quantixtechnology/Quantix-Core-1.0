# Task 2-b — Core Business, Store, and Order Library Files

## Agent: Core Lib Builder
## Task: Create core business, store, and order lib files (server-side only)

### Files Created

1. **`/src/lib/core/types.ts`** — Core-specific types
   - Re-exports all relevant types from `@/lib/types` (enums, request types, filter types)
   - New types: `BusinessListFilters`, `BusinessStats`, `StoreTimingInput`, `DefaultStoreTiming`, `OrderItemInput`, `CreateOrderParams`, `OrderTotals`, `OrderStatusTransitions`, `BusinessTypeModuleDefaults`

2. **`/src/lib/core/business.ts`** — Business management (7 functions)
   - `createBusiness()` — Auto-creates subscription (trial), enables default modules per business type, creates main store, optional domain mapping
   - `updateBusiness()` — Partial update with slug uniqueness check, JSON field handling
   - `getBusiness()` — Full business with subscription, modules, domain, and counts
   - `listBusinesses()` — Pagination + filters (type/status/salesRep/search/isOnline)
   - `updateBusinessStatus()` — State machine validation (ONBOARDING→TRIAL→ACTIVE→SUSPENDED→CHURNED), syncs subscription status
   - `toggleOnline()` — Online/offline toggle with suspended-business guard
   - `getBusinessStats()` — Aggregated stats using Prisma aggregate queries

3. **`/src/lib/core/store.ts`** — Store management (6 functions)
   - `createStore()` — Auto-creates 7-day store timings, handles main-store uniqueness
   - `updateStore()` — Partial update with slug and main-store management
   - `getStore()` — Store with timings, business info, and counts
   - `listStores()` — All stores for a business, main store first
   - `updateStoreTimings()` — Upsert with operatingHours JSON sync
   - `getDefaultStoreTimings()` — Returns default 9am-9pm timings

4. **`/src/lib/core/order.ts`** — Order engine (8 exported functions + state machine)
   - **6 state machine flows**: Regular Delivery, Pickup & Delivery, POS, Pickup, Dine-In, Subscription
   - `createOrder()` — Polymorphic items (itemType/itemId), auto order number, GST calculation, delivery record, OTPs
   - `updateOrderStatus()` — State machine validation, history recording, delivery sync
   - `cancelOrder()` — Reason tracking, delivery cancellation, activity logging
   - `getOrder()` — Full order with items, delivery, payments, history, store, customer, promo
   - `listOrders()` — Rich filtering with pagination
   - `calculateOrderTotals()` — GST (CGST+SGST intra-state), discounts, rounding
   - `generateOrderNumber()` — ORD-YYYYMMDD-NNN format
   - `isValidStatusTransition()` — Public state machine validator

### Key Design Decisions
- All write operations use Prisma `$transaction` for data consistency
- Business module defaults are mapped per business type (e.g., GROCERY gets grocery+catalog+delivery+pos modules)
- Business status changes automatically sync the subscription status
- Order state machine enforces valid transitions per order type
- GST defaults to intra-state (CGST + SGST, each half the GST rate)
- Order items are fully denormalized snapshots (source of truth for billing)
- Activity logging on all state changes

### Lint Status
- Zero errors after fix to platform.ts (module variable naming conflict)
