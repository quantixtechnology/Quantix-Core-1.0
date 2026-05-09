# Task 3 - Fix Broken API Routes

## Summary
Fixed two broken API routes that had invalid imports from `@/lib/core` (which resolves to `core.ts`, not `core/index.ts`).

## Root Cause
Both broken routes imported from `@/lib/core` which resolves to `/src/lib/core.ts` (a small barrel file exporting only permissions, db, and password utils). The full module exports (`createOrder`, `sendNotification`, `enableDefaultModules`) live in `/src/lib/core/index.ts` which is shadowed by the `core.ts` file.

## Files Modified

### 1. `/src/app/api/core/storefront/orders/route.ts`
- **Problem**: Line 12 imported `createOrder` and `sendNotification` from `@/lib/core` — neither exists in `core.ts`
- **Fix**: 
  - Replaced `import { createOrder, sendNotification } from '@/lib/core'` with `import { db } from '@/lib/db'`
  - Replaced `createOrder()` call with direct `db.order.create()` including:
    - Subtotal/tax calculation from resolved items
    - Order number generation (ORD-YYYYMMDD-NNN pattern)
    - Order items creation via nested `items.create`
    - Order status history creation
  - Replaced `sendNotification()` call with `db.notification.create()`
  - Replaced dynamic `await import('@/lib/db')` calls with top-level `db` import
  - Removed all `(order as Record<string, unknown>)` type casts (now using properly typed Prisma result)

### 2. `/src/app/api/core/seed/route.ts`
- **Problem**: Line 9 imported `enableDefaultModules` from `@/lib/core` — doesn't exist in `core.ts`
- **Fix**:
  - Removed `import { enableDefaultModules } from '@/lib/core'`
  - Replaced `enableDefaultModules(business.id, 'GROCERY')` with inline implementation using `db.businessModule.upsert()` in a loop
  - Merged the previously separate catalog module creation into the same loop

## Additional Fixes (blocking compilation)

### 3. `/src/components/dashboard/delivery-zones-view.tsx` (NEW)
- Created stub component — page.tsx imported it but it didn't exist, blocking entire app compilation

### 4. `/src/components/dashboard/loyalty-view.tsx` (NEW)
- Created stub component — page.tsx imported it but it didn't exist

### 5. `/src/components/dashboard/staff-view.tsx` (NEW)
- Created stub component — page.tsx imported it but it didn't exist

### 6. `/src/components/dashboard/tax-view.tsx` (NEW)
- Created stub component — page.tsx imported it but it didn't exist

### 7. `/src/components/dashboard/reviews-view.tsx` (NEW)
- Created stub component — page.tsx imported it but it didn't exist

### 8. `/src/components/dashboard/release-management-view.tsx`
- Fixed `Rollback` import from lucide-react (doesn't exist) → replaced with `RotateCcw`

## Routes Verified
- `/api/core/storefront/products` — Returns proper JSON (404 for invalid businessId) ✓
- `/api/core/storefront/categories` — Returns proper JSON (404 for invalid businessId) ✓
- `/api/core/storefront/orders` — Compiles successfully (POST requires auth) ✓
- `/api/core/storefront/orders/[orderId]/track` — Uses `@/lib/core/order` (direct path), no broken imports ✓
- `/api/core/seed` — Compiles successfully (has pre-existing data validation issue with billingCycle) ✓

## Lint Result
`bun run lint` — passes cleanly with 0 errors
