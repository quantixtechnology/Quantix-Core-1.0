# Task 2-c: Business Plan Fix — Work Record

## Summary
Fixed three issues with the business creation flow: missing planId in frontend POST body, middleware request parameter mismatch, and broken Prisma plan lookup.

## Changes Made

### 1. `src/components/admin/businesses/businesses-view.tsx`
- Added `PlanApiData` interface
- Added `plans` state + `fetchPlans()` — fetches from `/api/core/platform/plans` on mount
- `handleCreateBusiness` now parses `formPlan` → tier + billingCycle → looks up planId from fetched plans
- Includes `planId` and `billingCycle` in POST body
- Plan selector dynamically renders from fetched plans (with fallback)
- "Plan" label → "Plan *" (required field)

### 2. `src/app/api/core/businesses/route.ts`
- Changed `await request.json()` → `await req.json()` in POST handler
- Uses the authenticated request from withPlatformAccess middleware

### 3. `src/lib/core/business.ts`
- Fixed `db.platformPlan.findUnique({ where: { billingCycle: 'MONTHLY' } })` → `{ where: { tier_billingCycle: { tier: 'STANDARD', billingCycle: 'MONTHLY' } } }`
- Original query was invalid (billingCycle alone is not unique); PlatformPlan has `@@unique([tier, billingCycle])`

## Verification
- Lint: passes with zero errors
- Plans API: returns all 4 plans with correct IDs and prices
