# Task: Update Quantix Core Platform API Routes — FINAL Business Model

## Status: COMPLETED

## Summary
Updated all 9 API route files to match the FINAL business model for the Quantix Core Platform. All routes enforce the managed platform model: NO free trial, NO self-signup, NO public business creation.

## Files Created/Updated

### New Files (7)
1. **src/app/api/core/leads/route.ts** — Lead management
   - GET: List leads with filtering (stage, source, salesRepId) — Quantix team only (withPlatformAccess)
   - POST: Create lead — Quantix team only (withPlatformAccess)

2. **src/app/api/core/leads/[leadId]/route.ts** — Single lead operations
   - GET: Get lead details with converted business and demo tenant info
   - PATCH: Partial update (notes, stage, sales rep, etc.)
   - PUT: Full lead update

3. **src/app/api/core/leads/[leadId]/advance-stage/route.ts** — Advance lead through lifecycle
   - POST: Validates forward-only stage transitions (can't skip or go backwards)
   - DEMO_SHARED: requires demoTenantId, assigns tenant to lead
   - NEGOTIATION: captures negotiated prices
   - PAYMENT_PENDING: records billing cycle
   - PAYMENT_RECEIVED: verifies payment, requires billing cycle
   - ONBOARDING: creates Business record via createBusiness()
   - LOST/CHURNED: terminal exit stages from any point

4. **src/app/api/core/demo-tenants/route.ts** — Demo tenant management
   - GET: List demo tenants with filtering — Quantix team only
   - POST: Create demo tenant — Super Admin only (requiredRoles check)

5. **src/app/api/core/demo-tenants/[demoTenantId]/route.ts** — Single demo tenant
   - GET: Get demo tenant with current lead info
   - PATCH: Update demo tenant (status, credentials, etc.)
   - POST (actions): "reset" (clear assignment) and "assign" (link to lead)

6. **src/app/api/core/businesses/[businessId]/onboarding/route.ts** — Onboarding steps
   - GET: Get onboarding progress (steps, completion %, current step)
   - PATCH: Update onboarding step status (PENDING → IN_PROGRESS → COMPLETED/SKIPPED)

7. **src/app/api/core/businesses/[businessId]/subscription/override-pricing/route.ts** — Pricing override
   - POST: Override pricing — Super Admin only (requiredRoles: QUANTIX_SUPER_ADMIN)
   - DELETE: Remove pricing override — Super Admin only

### Updated Files (2)
8. **src/app/api/core/businesses/route.ts** — Removed public business creation
   - GET: Now wrapped with withPlatformAccess (Quantix team only)
   - POST: Now wrapped with withPlatformAccess, validates leadId is at PAYMENT_RECEIVED stage

9. **src/app/api/core/subscriptions/plans/route.ts** — Only 2 fixed plans
   - GET without businessId: Returns the 2 platform plans (MONTHLY ₹4,999, YEARLY ₹49,999)
   - Auto-seeds plans if they don't exist (upsert pattern)
   - GET with businessId: Backwards compatible — returns customer-facing subscription plans
   - Includes meta info about managed platform model

## Key Business Rules Enforced
- All lead/demo-tenant/business routes require `withPlatformAccess` (auth + platform admin)
- Demo tenant creation and pricing override require `QUANTIX_SUPER_ADMIN` role specifically
- Lead stage transitions are strictly forward-only (LEAD → DEMO_SHARED → ... → ACTIVE)
- Terminal stages (LOST, CHURNED) can be set from any non-terminal stage
- Business creation requires a lead at PAYMENT_RECEIVED stage
- Onboarding steps tracked with PENDING → IN_PROGRESS → COMPLETED/SKIPPED lifecycle
- Passwords masked in list views, exposed only on assign action
- Activity logging for key events (onboarding step updates, pricing overrides)

## Lint Status: PASSED (no errors)
## Dev Server: Running normally (port 3000)
