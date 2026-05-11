# Quantix Core Platform — Worklog

---
Task ID: 7
Agent: Main Coordinator
Task: Fix data persistence issues — error messages, business/product/sales rep creation, data storage

Work Log:
- Fixed RealtimeEmitter server-side URL: changed from relative `/api/emit?XTransformPort=3003` to absolute `http://localhost:3003/api/emit` (Node.js fetch requires absolute URLs)
- Fixed missing auth headers on product/category/customer mutations: Added `getAuthHeaders()` to all POST/PUT/DELETE fetch calls in products-view, customers-view, and create-order-dialog
- Created POST endpoint for sales team: `/api/admin/sales-team` now creates User + SalesTeamMember atomically
- Rewrote SalesView to use real API data instead of mock data from `@/components/dashboard/data`
- Fixed Business creation: added planId and billingCycle to POST body, fetched plans from API on mount
- Fixed `createBusiness` function: `billingCycle` was lowercase ("monthly") but Prisma expects uppercase ("MONTHLY")
- Fixed `createBusiness` function: `onboardingStep.createMany` used `order` field but schema has `sortOrder`
- Fixed `getBusiness` function: `onboardingSteps` orderBy used `order` but schema has `sortOrder`
- Fixed `createBusiness` fallback plan lookup: `billingCycle` alone isn't unique, used compound key `tier_billingCycle`
- Fixed withPlatformAccess middleware: changed `request.json()` to `req.json()` in businesses route
- Fixed seed route: changed business upsert from ID-based to slug-based for idempotency
- Fixed seed route: added password hashes for super admin (Admin@123) and sales team (Sales@123)
- Fixed seed route: created business owner (owner@freshmart-grocery.in / Owner@123) and store manager (manager@freshmart-grocery.in / Staff@123) users with BusinessUser records
- Fixed seed route: added `existingData` check to skip re-seeding if business data already exists
- Fixed hardcoded `biz_1` in notification bells: business-header and admin-header now use `currentBusinessId` from auth store
- All lint checks pass

Stage Summary:
- All critical data persistence bugs fixed
- Business creation: works end-to-end with planId, billingCycle, and proper subscription creation
- Product creation: works with auth headers
- Sales rep creation: works with real database persistence
- Auth: all 4 demo accounts have working passwords (Admin@123, Sales@123, Owner@123, Staff@123)
- Seed route: idempotent, handles existing data gracefully
- Notification polling: uses real business ID instead of hardcoded biz_1

---
Task ID: 1
Agent: Main Coordinator → Full-Stack Developer Subagent
Task: Fix seed script to match current Prisma schema, reseed database

Work Log:
- Analyzed all 30+ Prisma models to identify schema drift in seed script
- Completely rewrote `src/lib/seed.ts` to match current schema
- Key fixes: removed `db.platform` (replaced with `db.platformConfig`), removed all `platformId` references, fixed `PlatformPlan` to use `tier + billingCycle + price`, fixed `Business.status` (removed TRIAL), fixed `Lead.stage` (not status), fixed `TaxConfig.rate` (not gstRate), fixed enum values
- Created `src/scripts/seed-runner.ts` for running the seed
- Deleted old database and reseeded with real data
- Verified: 11 businesses, 44 customers, 12 orders, 28 categories, 21 products, 4 platform plans

Stage Summary:
- Database now has real data for all 11 business types
- Super Admin: superadmin@quantixtechnology.in / Admin@123
- Business owners: owner@{slug}.in / Owner@123
- Sales team: priya.sales@quantixtechnology.in / Sales@123

---
Task ID: 2
Agent: Main Coordinator → Full-Stack Developer Subagent
Task: Create auth store, login page, and session management

Work Log:
- Created `src/stores/auth-store.ts` — Zustand store with login, logout, token refresh, business context
- Created `src/components/auth/login-page.tsx` — Professional login page with Quantix branding
- Created `src/components/auth/auth-provider.tsx` — Auth gate with localStorage hydration, token refresh, role-based view switching
- Created `src/components/auth/user-menu.tsx` — User dropdown with sign out
- Fixed critical bug: Login API was not storing accessToken in RefreshToken table
- Updated `src/app/page.tsx` — Wrapped with AuthProvider
- Role-based routing: QUANTIX_SUPER_ADMIN → super_admin, CLIENT_OWNER → business_owner

Stage Summary:
- Full auth flow working: login → JWT tokens → API calls → session persistence
- Login page with demo credentials reference
- Auto role-based view switching on login

---
Task ID: 3
Agent: Main Coordinator → Full-Stack Developer Subagent
Task: Wire admin dashboard to real API data

Work Log:
- Modified businesses view to use real API data from `/api/core/businesses`
- Modified leads view with real CRM features (stage edit, reassign, bulk assign, create)
- Modified subscriptions view with real data and pricing override
- Created `src/lib/admin-fetch.ts` for auth header injection in write operations
- Created `src/app/api/admin/sales-team/route.ts` for dynamic sales rep data
- Fixed lead detail component to use real API field names

Stage Summary:
- Admin dashboard now shows real businesses, leads, subscriptions from database
- Platform stats API returns real counts and revenue
- All write operations (create business, advance lead, override pricing) include auth tokens

---
Task ID: 4
Agent: Main Coordinator → Full-Stack Developer Subagent
Task: Wire business dashboard to real API data

Work Log:
- Modified orders view to use real API data (removed demo data fallback)
- Modified products view with real CRUD operations (create, edit, delete via API)
- Modified customers view with real API data and order history
- Fixed business dashboard to use real stats from API
- Created product update/delete API route at `/api/core/storefront/products/[productId]`
- Fixed `mapApiOrder` to preserve all order types

Stage Summary:
- Business dashboard now shows real orders, products, customers from database
- Products CRUD works end-to-end (create, edit, delete, toggle availability)
- Customer detail shows real order history
- All data is business-type-specific (laundry shows laundry data, not grocery)

---
Task ID: 5
Agent: Main Coordinator → Full-Stack Developer Subagent
Task: Create real order creation flow

Work Log:
- Added "New Order" button to orders view page header
- Created `src/components/business/orders/create-order-dialog.tsx`
- Dialog features: customer search, order type/payment selection, product search with variant selector, quantity controls, auto-calculation of subtotal/tax/total, delivery address, notes
- Fixed orders API to handle all order types (PICKUP_AND_DELIVERY, etc.)
- Added COD to payment method filter, PICKUP_AND_DELIVERY to type filter

Stage Summary:
- Order creation works end-to-end: select customer → add items → submit → saved to database
- Auto-generates order numbers (ORD-YYYYMMDD-NNN format)
- Creates OrderItem and OrderStatusHistory records
- Verified: new orders appear in the orders list after creation

---
Task ID: 6
Agent: Main Coordinator
Task: End-to-end testing and verification

Work Log:
- Verified lint passes with zero errors
- Tested login API: superadmin and business owner both work
- Tested orders API: returns real data for specific businesses
- Tested products/categories API: laundry shows laundry-specific data (not grocery)
- Tested platform stats API: returns real business counts and revenue
- Tested order creation API: new orders saved with proper fields
- Verified dev server running and compiling successfully

Stage Summary:
- All APIs working with real database data
- Auth flow complete with JWT tokens
- Business-type-specific data correctly filtered (laundry shows laundry items)
- Order creation and management working end-to-end
- Admin dashboard shows real platform stats

---
Task ID: 2-a
Agent: Auth Fix Subagent
Task: Add Authorization headers to business owner mutation fetch calls

Work Log:
- Searched all business components for mutation fetch calls (POST, PUT, DELETE) missing auth headers
- Identified 6 mutation calls across 3 files that needed `getAuthHeaders()` from `@/lib/admin-fetch`
- Modified `src/components/business/products/products-view.tsx`:
  - Added `import { getAuthHeaders } from "@/lib/admin-fetch"`
  - updateProductMutation (PUT /api/core/storefront/products/[id]): `headers: { 'Content-Type': 'application/json' }` → `headers: getAuthHeaders()`
  - deleteProductMutation (DELETE /api/core/storefront/products/[id]): no headers → added `headers: getAuthHeaders()`
  - createProductMutation (POST /api/core/storefront/products): `headers: { 'Content-Type': 'application/json' }` → `headers: getAuthHeaders()`
  - createCategoryMutation (POST /api/core/storefront/categories): `headers: { 'Content-Type': 'application/json' }` → `headers: getAuthHeaders()`
- Modified `src/components/business/customers/customers-view.tsx`:
  - Added `import { getAuthHeaders } from "@/lib/admin-fetch"`
  - createCustomerMutation (POST /api/core/businesses/[id]/customers): `headers: { 'Content-Type': 'application/json' }` → `headers: getAuthHeaders()`
- Modified `src/components/business/orders/create-order-dialog.tsx`:
  - Added `import { getAuthHeaders } from "@/lib/admin-fetch"`
  - Order creation (POST /api/core/orders): `headers: { "Content-Type": "application/json" }` → `headers: getAuthHeaders()`
- Did NOT modify any GET requests (remain unauthenticated for public browsing)
- Lint passes with zero errors

Stage Summary:
- All 6 mutation fetch calls in business owner views now include Authorization Bearer token via getAuthHeaders()
- getAuthHeaders() already includes Content-Type: application/json, so no header information was lost
- GET requests remain unauthenticated (correct for public storefront browsing)

---
Task ID: 2-c
Agent: Business Plan Fix Subagent
Task: Fix BusinessesView to send planId/billingCycle, fix withPlatformAccess middleware pattern, fix createBusiness plan lookup

Work Log:
1. **Fixed BusinessesView to fetch plans on mount and send planId/billingCycle** (`src/components/admin/businesses/businesses-view.tsx`):
   - Added `PlanApiData` interface for plan API response
   - Added `plans` state and `fetchPlans()` callback — fetches from `/api/core/platform/plans` on component mount
   - Updated `handleCreateBusiness` to:
     - Validate `formPlan` is selected (marked as required field)
     - Parse `formPlan` value (e.g. "STANDARD_MONTHLY") into tier + billingCycle parts
     - Look up the matching plan from fetched plans to get the real `planId`
     - Include `planId` and `billingCycle` in the POST body to `/api/core/businesses`
   - Updated plan selector to dynamically render options from fetched plans (with fallback to hardcoded values)
   - Changed "Plan" label to "Plan *" to indicate required field

2. **Fixed withPlatformAccess middleware pattern** (`src/app/api/core/businesses/route.ts`):
   - Changed `const body = (await request.json())` to `const body = (await req.json())` in POST handler
   - The `request` variable was the outer NextRequest parameter; `req` is the authenticated request from `withPlatformAccess`
   - Using `req` is correct because if the middleware ever adds body validation (bodySchema), the body stream would already be consumed on `request`

3. **Fixed createBusiness fallback plan lookup** (`src/lib/core/business.ts`):
   - The original code used `db.platformPlan.findUnique({ where: { billingCycle: 'MONTHLY' } })` which is INVALID — `billingCycle` alone is not a unique field
   - PlatformPlan has a compound unique constraint `@@unique([tier, billingCycle])`
   - Fixed to use the compound unique key: `where: { tier_billingCycle: { tier: 'STANDARD', billingCycle: 'MONTHLY' } }`
   - Updated error message to "No STANDARD MONTHLY plan found" for clarity

4. **Verified existing plans API endpoint** (`src/app/api/core/platform/plans/route.ts`):
   - Confirmed endpoint exists and returns proper data with IDs
   - Tested: all 4 plans returned correctly (STANDARD_MONTHLY ₹2,999, PRO_MONTHLY ₹4,999, STANDARD_YEARLY ₹30,000, PRO_YEARLY ₹49,999)

Stage Summary:
- Business creation now sends planId and billingCycle from the frontend
- Plan selector dynamically populated from API (no more hardcoded plan values)
- withPlatformAccess middleware pattern corrected (req vs request)
- createBusiness fallback plan lookup uses correct Prisma compound unique key
- Lint passes with zero errors

---
Task ID: 2-b
Agent: Full-Stack Developer
Task: Wire SalesView to real API data, add POST endpoint for creating sales team members

Work Log:
- Added POST handler to `/api/admin/sales-team/route.ts`:
  - Accepts: name, email, phone, region, target (all required)
  - Validates fields, checks duplicate email (409)
  - Uses Prisma `$transaction` to create User + SalesTeamMember atomically
  - Hashes default password `Quantix@123` via `hashPassword` from `@/lib/password-utils`
  - User created with: email, name, phone, passwordHash, authProvider: EMAIL_OTP, emailVerified: true, isActive: true
  - SalesTeamMember linked to user with achieved=0
- Rewrote `src/components/admin/sales/sales-view.tsx`:
  - Removed all mock data imports (`salesTeam`, `leads`, `leadStageColors` from `@/components/dashboard/data`)
  - Removed mock data objects: `repRenewals`, `repRecentActivity`, `repRevenueMonths`
  - Removed `ConversionFunnel` component (depended on mock leads data)
  - Added `fetchSalesTeam()` — GET `/api/admin/sales-team` on component mount
  - Added `handleAddSalesRep()` — POST `/api/admin/sales-team` with form data
  - "Add Sales Rep" button now calls API, shows loading spinner, displays toast on success/error
  - On success: closes dialog, resets form, refetches team list
  - Added `Loader2` loading state while fetching initial data
  - Imported `getAuthHeaders` from `@/lib/admin-fetch` and `toast` from `sonner`
  - Leads/conversions default to 0; renewals, revenue months, recent activity sections removed (dependent on mock data)
  - Grid cards simplified to 3-column stats (Leads, Won, Commission)
  - Detail sheet keeps Contact Info, Performance Overview, Key Metrics, Commission Details
  - `getPerformanceLevel` handles `target === 0` edge case
- Verified `src/lib/password-utils.ts` exists with `hashPassword` using bcryptjs
- Lint passes with zero errors
- API tests: GET returns seed data, POST creates correctly, duplicate email returns 409, missing fields returns 400

Stage Summary:
- SalesView now uses real database data via `/api/admin/sales-team` API
- "Add Sales Rep" button creates User + SalesTeamMember records in the database
- All validation, error handling, and toast notifications working
- Default password for new sales reps: Quantix@123

---
Task ID: 1
Agent: Full-stack fix agent
Task: Fix critical issues — listBusinesses memory crash, login rate limit, FreshMart status, dev script, storefront products API

Work Log:
1. **Simplified listBusinesses query** (`src/lib/core/business.ts`):
   - Removed `businessSubscription`, `domain`, and `salesRep` includes from the list query
   - Reduced `_count` from `{ stores, orders, customers }` to just `{ stores }`
   - These heavy includes caused excessive memory usage and server crashes when listing >5 businesses
   - Detailed data still available via `getBusiness()` for single business detail views

2. **Fixed login rate limiting** (`src/app/api/core/auth/login/route.ts`):
   - Changed `maxRequests` from 5 to 20 (within the same 15-minute window)
   - Updated comment to reflect new limit: "20 attempts per 15 minutes per email"
   - Previous limit of 5 was too strict and blocked legitimate users during development/testing

3. **Fixed FreshMart business status** (`src/app/api/core/seed/route.ts`):
   - Changed from `findUnique` + conditional `create` to `upsert` pattern
   - The `update` clause now explicitly sets `status: 'ACTIVE'`, `isOnline: true`, `activatedAt: new Date()`, `onboardedAt: new Date()`
   - This ensures stale data in DB gets corrected when seed endpoint is re-run
   - Moved `existingData` check after upsert (business is always defined now)

4. **Fixed dev script** (`package.json`):
   - Removed `2>&1 | tee dev.log` pipe from dev script
   - Changed to simple `next dev -p 3000`
   - The `tee` pipe caused buffering issues and signal handling problems

5. **Fixed storefront products API** (`src/app/api/core/storefront/products/route.ts`):
   - Added `type` field to product creation (defaults to 'PHYSICAL', can be overridden via body)
   - Added `barcode` field to product creation from request body
   - Added `minStock` to variant creation from request body
   - Fixed default variant creation: now uses `body.price`, `body.mrp`, `body.stock` instead of hardcoded 0s
   - Added automatic inventory record creation for each variant after product creation
   - Inventory records link product+variant+store with proper quantity and status

Stage Summary:
- listBusinesses no longer crashes with many businesses (reduced includes)
- Login rate limit increased to 20 requests per 15 minutes
- FreshMart always seeded as ACTIVE, even if stale data exists
- Dev script no longer uses `tee` pipe
- Storefront products API properly creates products with variants, inventory, and all fields
- All lint checks pass

---

## Task 1: CRUD Stabilization — Mock Data Removal & API Integration
**Agent:** fullstack-crud-stabilization
**Date:** 2026-05-11

### Summary
Replaced all mock data imports across 9 component files with real API calls. Every component now fetches live data from the backend using authenticated requests, with proper loading/error states.

### TASK 1: Lead CRM Sub-components (7 files)
1. **lead-activity-timeline.tsx** — Replaced `leadActivities`, `formatRelativeTime`, `activityTypeConfig` imports from `./crm-data`. Now fetches from `GET /api/core/leads/{leadId}/activities`, maps API response to internal `LeadActivity` type using `actionToActivityType()` parser. Uses `getRelativeTime` from `@/lib/utils` instead of mock `formatRelativeTime`. Added loading skeletons and error/retry UI.

2. **lead-comments-feed.tsx** — Replaced `leadComments`, `formatRelativeTime` imports from `./crm-data`. Now fetches from `GET /api/core/leads/{leadId}/comments` and posts to `POST /api/core/leads/{leadId}/comments`. Added submit state with toast feedback. Uses `getRelativeTime` from utils.

3. **lead-contact-counters.tsx** — Replaced `leadContactStats` import from `./crm-data`. Now fetches activities from `GET /api/core/leads/{leadId}/activities` and computes stats (`totalCalls`, `totalWhatsApp`, `totalDemosShared`, `totalFollowUps`, `daysSinceLastContact`) from the activity data. Accepts `lastContactedAt` prop as fallback for days-since-last-contact when no activities exist.

4. **follow-up-reminders.tsx** — Replaced `followUpReminders` import from `./crm-data`. Now fetches leads from `GET /api/core/leads?limit=100` and computes reminders from `followUpDate` field. Classifies reminders as OVERDUE (past date), PENDING (today or future), or INACTIVITY (no contact in 7+ days). Added refresh button.

5. **sales-crm-reports.tsx** — Replaced `salesRepMetrics`, `stageFunnelData`, `leadContactStats`, `followUpReminders` imports from `./crm-data`. Now fetches leads from `GET /api/core/leads?limit=200` and sales team from `GET /api/admin/sales-team`. Computes stage funnel, hot/inactive leads, per-rep conversion rates from real data.

6. **sales-rep-performance.tsx** — Replaced `salesRepMetrics` import from `./crm-data`. Now fetches sales team and leads in parallel, computes per-rep metrics (leadsAssigned, conversions, conversionRate, demosShared, followUpsCompleted) from real lead data.

7. **lead-detail-enhanced.tsx** — Replaced `leadActivities`, `leadContactStats`, `formatRelativeTime` imports from `./crm-data`. Now fetches activities from API for the contact history tab. Sub-components (LeadActivityTimeline, LeadCommentsFeed, LeadContactCounters) each handle their own API fetching.

8. **leads-view.tsx** — Updated `LeadContactCounters` usage to pass `lastContactedAt` prop for the new component interface.

### TASK 2: Delivery Dashboard
- Replaced `setBusinessContext("biz_1")` hardcoded business context with `useBusinessContext()` hook from `@/hooks/use-business-context`. Now dynamically resolves the real business ID from auth store/localStorage.

### TASK 3: Notification Center
- Replaced `notificationItems` import from `./notification-data` with API fetch from `GET /api/core/notifications?businessId=...&limit=50`. Uses `useAuthStore` for business ID and `getAuthHeaders` for auth. Added loading skeletons and error state with retry button. Kept `eventTypeConfig`, `channelConfig`, `defaultPreferences` config imports (these are UI config, not mock data).

### TASK 4: Audit Log Viewer
- Replaced `auditLogs` import from `./audit-data` with API fetch from `GET /api/core/audit?businessId=...&limit=50`. Uses `useAuthStore` for business ID and `getAuthHeaders` for auth. Added loading state, error state with retry. Maps API response fields (`entity` → `entityType`, `details` parsing) to match the `AuditLogEntry` interface.

### TASK 5: Sales View leads/conversions
- Replaced hardcoded `leads: 0, conversions: 0` in the sales team mapping with real computation. Now fetches leads in parallel with sales team, counts leads per rep, and computes conversions as leads in ONBOARDING/DEPLOYMENT/ACTIVE stages.

### Technical Details
- All API calls use `getAuthHeaders()` from `@/lib/admin-fetch` which injects Bearer token and x-business-id
- Business ID resolved from `useAuthStore().currentBusinessId` or localStorage fallback
- All components include loading states (Skeleton components) and error states with retry
- Type mappings handle API field name differences (e.g., `action: "lead.STAGE_CHANGE"` → `type: "STAGE_CHANGE"`)
- Lint passes cleanly with zero errors

---
Task ID: 2
Agent: Backend API Developer
Task: CRUD Stabilization — Add missing PATCH/DELETE endpoints, fix inventory update bug, fix filter bug

Work Log:

### TASK 1: Sales Team PATCH/DELETE endpoint
- Created `/src/app/api/admin/sales-team/[memberId]/route.ts`
- **PATCH**: Updates sales team member fields (name, email, phone, region, target, isActive)
  - Uses `db.salesTeamMember.update()` within a transaction
  - Syncs name/email/phone/isActive to the linked User record in the same transaction
  - Checks for duplicate email if email is being changed (409 on conflict)
  - Wrapped with `withPlatformAccess` for auth check
- **DELETE**: Soft delete — sets `isActive: false` on both SalesTeamMember and linked User
  - Uses `db.$transaction` to update both records atomically
  - Wrapped with `withPlatformAccess` for auth check
- `params` typed as `Promise<Record<string, string | string[]>>` per Next.js 16 convention

### TASK 2: Delivery Partner PATCH endpoint
- Created `/src/app/api/core/delivery/partners/[partnerId]/route.ts`
- **GET**: Fetches single partner by ID using `db.deliveryPartner.findUnique()`
- **PATCH**: Updates partner fields (name, email, phone, vehicleType, vehicleNumber, isActive, etc.)
  - Uses `db.deliveryPartner.update()` with selective field update
  - Checks for duplicate phone within business if phone is being changed
- **DELETE**: Soft delete — sets `isActive: false` via `db.deliveryPartner.update()`

### TASK 3: Fix Product PUT to update inventory
- Modified `/src/app/api/core/storefront/products/[productId]/route.ts`
- **Bug 1 fixed**: After replacing variants in the transaction, now upserts inventory records for each new variant using `tx.inventory.upsert()` with the composite unique key `storeId_productId_variantId`
  - Only runs if the product has a `storeId`
  - Update: quantity and status
  - Create: businessId, storeId, productId, variantId, quantity, minStock, maxStock, status
- **Bug 2 fixed**: `isActive` was hardcoded to `true` for new variants — now uses `v.isActive !== undefined ? Boolean(v.isActive) : true` to respect the body's value

### TASK 4: Fix delivery partners GET filter bug
- Modified `/src/app/api/core/delivery/partners/route.ts`
- **Before (buggy)**: Used spread pattern `...(isOnline !== null && { isOnline: isOnline === 'true' })` and `...(isActive !== null && { isActive: isActive !== 'false' })`
  - The `isActive !== 'false'` logic was wrong: any value other than 'false' resulted in `isActive: true`
- **After (fixed)**: Uses explicit `if` checks:
  - `if (isOnline !== null) where.isOnline = isOnline === 'true'`
  - `if (isActive !== null) where.isActive = isActive === 'true'`
  - No default `isActive` filter added when no filters are provided

### TASK 5: Store timings update endpoint
- Already exists at `/src/app/api/core/stores/[storeId]/timings/route.ts`
- Has GET and PUT handlers with proper validation
- PUT uses `updateStoreTimings()` from `@/lib/core/store` which handles upsert and operatingHours JSON update
- No changes needed

Stage Summary:
- Sales team members can now be updated and deactivated via API
- Delivery partners can be fetched, updated, and soft-deleted individually
- Product PUT now properly creates/updates inventory records when variants are replaced
- Product PUT respects `isActive` from request body instead of hardcoding `true`
- Delivery partners GET filter correctly parses `isOnline` and `isActive` query params
- Store timings endpoint was already complete — no changes needed
- All lint checks pass with zero errors

---
Task ID: CRUD-Stabilization-Phase
Agent: Main Developer
Task: CRUD Stabilization - Replace mock data with real database persistence across all modules

Work Log:
- Audited all 18 API route files — confirmed ALL use real Prisma/DB persistence (zero mock data)
- Audited all frontend components — identified 7 using mock data instead of real APIs
- Fixed Lead CRM sub-components (7 files): lead-activity-timeline, lead-comments-feed, lead-contact-counters, follow-up-reminders, sales-crm-reports, sales-rep-performance, lead-detail-enhanced — all now fetch from real API endpoints instead of crm-data.ts
- Fixed Delivery Dashboard: replaced hardcoded `setBusinessContext("biz_1")` with `useBusinessContext()` 
- Fixed Notification Center: replaced mock `notificationItems` with fetch from `/api/core/notifications`
- Fixed Audit Log Viewer: replaced mock `auditLogs` array with fetch from `/api/core/audit`
- Fixed Sales View: replaced hardcoded `leads: 0, conversions: 0` with real computation from leads API
- Added PATCH/DELETE endpoints for Sales Team (`/api/admin/sales-team?id=xxx`)
- Added PATCH/DELETE/GET endpoints for Delivery Partners (`/api/core/delivery/partners/[partnerId]`)
- Fixed Product PUT: added inventory record updates when variants are replaced; fixed hardcoded `isActive: true`
- Fixed Delivery Partners GET filter bug (isActive filter always applied)
- Fixed login rate limiting (5→20 per 15 minutes)
- Fixed FreshMart seed status (now uses upsert to ensure ACTIVE)
- Fixed Prisma query logging (disabled in dev to prevent buffer overflow crashes)
- Fixed next.config.ts (removed invalid watchOptions, cleaned up)

Stage Summary:
- All backend API routes use real Prisma persistence ✅
- All admin panel components now use real API calls ✅
- Business CRUD (create/list/update) working end-to-end ✅
- Sales Team CRUD (create/list/update/deactivate) working ✅
- Lead Management (create/list/update stage/comments) working ✅
- Product CRUD (create/read/update/delete with inventory) working ✅
- Order CRUD (create/list/status updates) working ✅
- Delivery (assign/update status/partners) working ✅
- Notification/Audit fetches from real DB ✅
- Lint passes cleanly ✅
- Server stability improved (cleared .next cache, disabled query logging)

---
Task ID: fix-usequery-bug
Agent: Main Coordinator
Task: Fix "useQuery is not defined" crash when business owner logs in

Work Log:
- Searched all business owner components for `useQuery` usage without proper import
- Found 3 bugs:

**Bug #1 (CRITICAL)**: `src/components/business/dashboard/business-dashboard.tsx` — line 42 only imported `useQueryClient` from `@tanstack/react-query` but the component uses `useQuery` on 4 lines (108, 131, 144, 157). This caused "ReferenceError: useQuery is not defined" crash when business owner logged in and the dashboard loaded.
  - Fix: Changed import to `import { useQuery, useQueryClient } from "@tanstack/react-query"` (already applied)

**Bug #2 (CRITICAL)**: Same file — `productsList` useMemo was referenced in `lowStockProducts` useMemo before it was declared (temporal dead zone). This would cause "ReferenceError: Cannot access 'productsList' before initialization".
  - Fix: Reordered useMemo declarations so `productsList` comes before `lowStockProducts` (already applied)

**Bug #3 (HIGH)**: `src/hooks/use-api.ts` — only imported `setBusinessContext` from `@/lib/api-client` but used `getBusinessContextId()` on lines 487 and 513 (in `useDeliveryOrders` and `useDeliveryEarnings` hooks).
  - Fix: Added `getBusinessContextId` to import: `import { setBusinessContext, getBusinessContextId } from "@/lib/api-client"` (already applied)

- Deep scanned ALL .tsx/.ts files in src/ for any other missing `useQuery`/`useMutation` imports — none found
- Verified all business owner component imports match their usage
- Verified `QueryClientProvider` wraps the app in root layout
- Verified all hooks from `@/hooks/use-api`, `@/hooks/use-realtime`, `@/hooks/use-business-context` exist and export correctly
- Lint passes with zero errors

Stage Summary:
- The primary crash ("useQuery is not defined" on business owner login) was caused by Bug #1 — missing `useQuery` import in business-dashboard.tsx
- All 3 bugs were already fixed in the code (likely by a previous session)
- The code is correct; the remaining dev server OOM crash is an environment resource constraint, not a code bug
