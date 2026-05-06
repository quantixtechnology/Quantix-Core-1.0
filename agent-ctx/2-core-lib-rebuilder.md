# Task 2 — Core Library Files Rebuild

## Agent: core-lib-rebuilder
## Task: Rebuild core library files to match new Prisma schema (MANAGED platform model)

### Summary
Rebuilt all 10 core library files in `/home/z/my-project/src/lib/` to match the new Prisma schema with 27+ enums, 30+ models, and the MANAGED platform model where only Quantix Super Admin creates businesses.

### Files Rebuilt

1. **types.ts** — 27 enum types matching Prisma schema exactly, all request types, filter types, BusinessContext with isPlatformAdmin
2. **permissions.ts** — 14 permission modules, 6-role mapping for MANAGED model
3. **constants.ts** — All 11 business types, lead sources/statuses, subscription statuses, plan tiers, hosting providers, paper sizes, pricing plans
4. **utils.ts** — Updated generateOTP to 6-digit default, kept all existing utilities
5. **seed.ts** — Comprehensive: Platform, Super Admin, 2 Sales Team, 3 Plans, 11 businesses, subscriptions, domains, deployments, leads, stores, categories, products, tax configs, delivery zones/partners, customers, subscription plans, orders, POS sessions
6. **auth.ts** — QUANTIX_SUPER_ADMIN handling with isPlatformAdmin flag
7. **api-client.ts** — Added platformApi, updated types
8. **validations.ts** — Added lead, domain mapping, deployment, business subscription schemas
9. **middleware.ts** — Added withPlatformAccess, isPlatformAdmin check
10. **password-utils.ts** — Verified, unchanged

### Key Architecture Decisions
- QUANTIX_SUPER_ADMIN has no business context (platform-level access)
- QUANTIX_SALES_TEAM can create leads and track onboarding
- CLIENT_OWNER cannot create businesses, deploy, or change infrastructure
- DELIVERY_STAFF has OTP verification and route navigation permissions
- 14 permission modules covering PLATFORM, SALES, DEPLOYMENT, DOMAIN (platform-only) plus all business modules
