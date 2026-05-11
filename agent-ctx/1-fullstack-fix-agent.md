# Task 1 — Full-stack fix agent

## Task
Fix critical issues in the Quantix Core Platform

## Work Completed

### 1. Simplified listBusinesses query (src/lib/core/business.ts)
- Removed `businessSubscription`, `domain`, `salesRep` includes from list query
- Reduced `_count` to only `{ stores: true }`
- Prevents memory crash when listing >5 businesses

### 2. Fixed login rate limiting (src/app/api/core/auth/login/route.ts)
- Changed maxRequests from 5 to 20 per 15-minute window

### 3. Fixed FreshMart business status (src/app/api/core/seed/route.ts)
- Changed from findUnique+create to upsert pattern
- Update clause sets status=ACTIVE, isOnline=true, activatedAt, onboardedAt

### 4. Fixed dev script (package.json)
- Removed `2>&1 | tee dev.log` pipe

### 5. Fixed storefront products API (src/app/api/core/storefront/products/route.ts)
- Added `type` and `barcode` fields to product creation
- Fixed default variant to use body.price/mrp/stock instead of hardcoded 0s
- Added automatic inventory record creation after product creation

## Files Modified
- `src/lib/core/business.ts`
- `src/app/api/core/auth/login/route.ts`
- `src/app/api/core/seed/route.ts`
- `package.json`
- `src/app/api/core/storefront/products/route.ts`

## Status: Complete
