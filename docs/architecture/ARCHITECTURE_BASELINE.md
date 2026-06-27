# Quantix Core — Architecture Baseline

> **Status:** STABLE — Reference document. Read this before any future implementation.
> **Baseline date:** 2026-06-28
> **Production commit:** `79b6ffe` (full: `79b6ffe4f2a4d62b898892a81eaf2a106a8f82e1`)
> **Scope:** This is a *descriptive* baseline of the system as deployed. It does not change behavior. The deployment, routing, CI, webhook, nginx, PM2, and infrastructure layers documented here are considered **stable and frozen** — do not modify them unless explicitly requested.

---

## 0. Platform Stack (verified)

| Layer | Value |
|---|---|
| Framework | Next.js **16.1.1** (App Router, Turbopack) |
| UI runtime | React **19** |
| ORM | Prisma **6.11.1** (SQLite, `DATABASE_URL` file-based) |
| Auth | NextAuth **4.24.11** (`src/app/api/auth/[...nextauth]/route.ts`) |
| Node | **22.x** (production: 22.22.3) |
| Build output | `output: "standalone"` (`next.config.js`) |
| Process manager | PM2 (`quantix-core`, `quantix-website`) |
| Reverse proxy | nginx |
| Data models | **158** Prisma models (`prisma/schema.prisma`) |

Build-relevant config flags (`next.config.js`): `typescript.ignoreBuildErrors: true`, `reactStrictMode: false`, `outputFileTracingRoot` pinned to repo root, `outputFileTracingExcludes` set to avoid stale standalone snapshots.

---

## 1. Current Production Commit

- **Commit:** `79b6ffe` — `ci(routes): add dynamic-route conflict guard enforced in CI`
- **Authored:** 2026-06-28
- **Branch:** `main` (local `main` = `origin/main` = production, verified in sync)
- **Deployment model:** production tracks `main`. Every push to `main` triggers an automated deploy (see §2).
- **Verified at baseline:** `GET /api/deploy/status` → `{ status: "success", commit: "79b6ffe", http: "200" }`; production `git log -1` = `79b6ffe`.

---

## 2. Deployment Flow

Deployment is **webhook-based**, not SSH-based. (Rationale in `.github/workflows/deploy.yml`: the VPS firewall drops inbound TCP from GitHub runner IPs, so the runner calls *out* over HTTPS instead.)

```
 push to main  ─►  GitHub Actions (deploy.yml)
                        │  validate secrets
                        │  POST https://app.quantixtechnology.in/api/deploy   (x-deploy-secret)
                        ▼
              Next.js app on VPS (POST /api/deploy/route.ts)
                        │  auth (timingSafeEqual) · rate-limit · replay window
                        │  atomic lock file  /tmp/quantix-deploy.lock
                        │  spawn DETACHED:  scripts/deploy-local.sh
                        ▼
              scripts/deploy-local.sh  (survives the PM2 restart mid-build)
                        │  git pull (fast-forward to origin/main)
                        │  wipe .next  ·  npm run build  (~3–5 min)
                        │  copy standalone assets  ·  pm2 restart quantix-core
                        │  health check  ·  writes /tmp/quantix-deploy-status.json
                        ▼
              GitHub Actions polls GET /api/deploy/status until
              status ∈ { success, failed }
```

**Key files (FROZEN — do not modify without explicit request):**
- `.github/workflows/deploy.yml` — trigger + monitor job
- `src/app/api/deploy/route.ts` — webhook receiver (auth, lock, spawn)
- `src/app/api/deploy/status/route.ts` — status endpoint polled by CI
- `scripts/deploy-local.sh` — the actual on-VPS deploy
- nginx config, PM2 process config

**Status file contract** (`/tmp/quantix-deploy-status.json`): `{ status, step, message, startedAt, updatedAt, commit, http, durationSeconds }`. Lock: `/tmp/quantix-deploy.lock`. Log: `/tmp/quantix-deploy.log`.

**Known operational hazard (documented, mitigated):** PM2 setting `HOSTNAME=0.0.0.0` poisons the Turbopack build-worker IPC (`TypeError: generate is not a function`). `deploy-local.sh` runs the build inside a clean `env -i` environment to avoid this. Do not reintroduce a polluted build env.

---

## 3. Route Architecture

App Router under `src/app`. Two surfaces:

**Page routes (UI):** `admin/` (super-admin console, `[[...slug]]` catch-all), `business/`, `commerce/` (Commerce OS console), `laundry/` (+ `laundry/processing/`), `mobile/`, plus print pages (`annexure-print/[id]`, `offer-letter-print/[id]`), `reset-password`, `delete-account`.

**API routes (`src/app/api`):**

| Group | Responsibility |
|---|---|
| `core/` | Multi-tenant backbone: businesses, stores, users, orders, payments, subscriptions, POS, delivery, leads, storefront, tenant, platform |
| `admin/` | Super-admin: businesses, billing, account-billing, products, provisioners, rbac, revenue-ops, hrms, quantix-website (CMS), workspaces, websites, commission, sales-team |
| `laundry/` | Laundry OS: businesses, stores, orders, departments, processing-centers, roles, stage-permissions, workflow-stages, workflow-configurations, assignments |
| `v1/` | Public/mobile API surface (products, orders, addresses, storefront, profile, website) |
| `products/` | Product instantiation (commerce/laundry init, catalogs, runtime) |
| `auth/` | NextAuth (`[...nextauth]`) |
| `payment/`, `webhooks/` | Gateways (Razorpay) and inbound webhooks |
| `deploy/` | Deployment webhook + status (see §2 — FROZEN) |
| `website/`, `business/`, `customer/`, `public/`, `assets/`, `uploads/`, `ssl/` | Supporting surfaces |

**Route inventory (audited at baseline):** 87 dynamic route segments across 87 distinct parent directories. **Every parent has exactly one dynamic child → zero sibling-slug conflicts** (verified by `npm run check:routes`).

---

## 4. Dynamic Route Naming Conventions

Quantix routing standard: **a dynamic segment is named for its entity**, not generic `[id]`.

| Entity | Segment |
|---|---|
| Business | `[businessId]` |
| Store | `[storeId]` |
| Customer | `[customerId]` |
| Order | `[orderId]` |
| Product | `[productId]` |
| Plan | `[planId]` |
| Workspace | `[workspaceId]` |
| User | `[userId]` |
| Employee | `[employeeId]` |
| Lead | `[leadId]` |

**Hard rule (enforced by CI):** sibling dynamic segments under the same parent **must use the same slug name**. Next.js fails the entire route tree at runtime otherwise (`'businessId' !== 'id'`), returning framework-level 500 on *every* endpoint — this previously broke production deployment.

`[id]` is permitted only where no meaningful entity name exists. Legitimately-generic segments in use: `[slug]`, `[code]`, `[type]`, `[role]`, `[...path]`, `[...nextauth]`, `[size]`.

**Standards deviations (tracked, NOT yet renamed — see §11):** 36 routes still use `[id]`. These are *not* conflicts (each is an only-child) and are safe to deploy. Renames are deferred to per-route owner approval.

---

## 5. CI Validation Rules

Enforcement lives in **CI**, deliberately decoupled from the production build (production build command in `package.json` is unchanged so production builds stay clean).

- **Guard script:** `scripts/check-route-conflicts.js` — pure filesystem inspection of `src/app`; exits 1 on any sibling-slug conflict. Imports/executes no application code.
- **npm script:** `npm run check:routes`.
- **CI workflow:** `.github/workflows/route-guard.yml` — on every `push` and `pull_request`, runs (Node 22 → `npm ci` → `npx prisma generate` →) `npm run check:routes` then `npm run build`. A conflict fails the check and blocks merge.
- **Separation of concerns:** `route-guard.yml` is standalone. It does **not** modify `deploy.yml` or the deployment mechanism; a CI failure cannot break the deploy pipeline.

**Invariant going forward:** no new dynamic route may introduce a sibling slug-name mismatch. The guard makes such a mistake a loud, local CI failure instead of a silent production outage.

---

## 6. Protected Platform Domains

These domains are **load-bearing platform infrastructure**. Do not modify their logic during feature work without explicit, scoped approval. (Routing-only param renames are not behavior changes, but still require owner sign-off here.)

| Domain | Primary source | Notes |
|---|---|---|
| **Runtime Registry** | `src/app/api/admin/products/runtime`, `src/app/api/debug/runtime-*` | Resolves product runtime layout/version per tenant |
| **Product Registry** | `src/app/api/admin/products`, `src/lib/products/*` (`commerce-init.ts`, `laundry-init.ts`, catalogs) | Catalog of installable products + their default plans/settings |
| **Provisioning Engine** | `src/lib/products/*-provisioner.ts`, `src/app/api/admin/provisioners/registry`, `.../businesses/[businessId]/provision`, `.../businesses/[businessId]/mobile/provision` | Instantiates a product into a tenant (owner user auto-creation, modules, stores) |
| **Authentication** | `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]`, `src/lib/laundry-auth.ts`, `src/lib/storefront-auth.ts` | NextAuth + per-surface auth (admin, laundry, storefront) |
| **RBAC** | `src/lib/rbac/*`, `src/lib/core/rbac.ts`, `src/app/api/admin/rbac`, `src/components/admin/rbac` | Roles/permissions; `RolePermission`, `PermissionChangeLog` models |

Also frozen as infrastructure: **Deployment Pipeline, GitHub Actions, nginx, PM2, Database Schema** (§2, §5).

---

## 7. Business Domains

The platform is a multi-tenant SaaS ERP. **Quantix Super Admin** (the `admin/` surface) provisions and manages tenant businesses; each business runs one or more **products** (Commerce OS, Laundry OS) under real tenant isolation.

| Domain | Surface | Backbone |
|---|---|---|
| Platform / Super Admin | `app/admin`, `api/admin` | Platform config, products, provisioners, billing, RBAC, revenue-ops |
| Tenant Core | `api/core` | `src/lib/core/*` (business, store, order, payment, subscription, tenant, pos, delivery, notification, audit) |
| Commerce OS | `app/commerce`, `api/core`, `api/products/commerce` | See §10 |
| Laundry OS | `app/laundry`, `api/laundry`, `api/products/laundry` | See §9 |
| HRMS | `api/admin/hrms`, `src/lib/hrms` | Employees, offer letters, annexures, commission policy/slips, ownership |
| Marketing Website CMS | `api/admin/quantix-website`, `api/v1/website` | 15-section CMS (general, homepage, pricing, company, communication, features, testimonials, FAQ, SEO, theme, footer, navigation, announcement, lead form, media) |
| Account Billing | `api/admin/account-billing`, `api/admin/billing` | `Billing*` model family (accounts, invoices, ledger, payments) |

---

## 8. Business Lifecycle

Tenant lifecycle, owned by the platform layer (provisioning is a Protected Domain — §6):

```
Lead ─► Demo Tenant ─► Business (created) ─► Provisioned (product instantiated,
        owner user auto-created, modules + stores set up) ─► Active
        ─► Subscription / Billing ─► (Renewal · Add-ons · Ownership transfer)
        ─► Suspended / Offboarded
```

- **Creation:** `createBusiness()` auto-creates the owner `User` + `BusinessUser`; provision endpoints finalize modules/stores.
- **Key models:** `Business`, `OnboardingStep`, `BusinessModule`, `BusinessUser`, `BusinessRole`, `UserStoreAssignment`, `BusinessSubscription`, `BillingRecord`, `Addon`, `SignupOwnership` / `RenewalOwnership` / `AddonOwnership`.
- **Isolation:** all tenant data is scoped by `businessId`; routing under `api/core/businesses/[businessId]/...` consistently uses the `[businessId]` slug.

---

## 9. Laundry OS

Vertical product for laundry operations. Routes under `api/laundry`, provisioned via `src/lib/products/laundry-provisioner.ts` + `laundry-init.ts`.

- **Structure:** `LaundryBusiness` → `LaundryStore` / `LaundryProcessingCenter` → `LaundryDepartment`.
- **Workflow engine:** `LaundryWorkflowStage`, `LaundryWorkflowConfiguration`, `LaundryStagePermission`, `LaundryStageTimestamp`; orders (`LaundryOrder`, `LaundryOrderService`) move through configured stages.
- **Access:** `LaundryRole`, `LaundryUserAssignment`, dedicated `src/lib/laundry-auth.ts` (separate processing-center login at `app/laundry/processing`).
- **Provisioning/config models:** `LaundrySubscription`, `LaundryProvisioningItem`, `LaundryPlatformProvisioning`, `LaundryOperationalConfig`, `LaundryWorkflowQualityConfig`, `LaundryBrandingConfig`, `LaundryScalingLimit`, `LaundryBusinessFeature`.

---

## 10. Commerce OS

General commerce/retail product. Console at `app/commerce` (dashboard, products, inventory, orders, POS, customers, settings); provisioned via `src/lib/products/commerce-provisioner.ts` + `commerce-init.ts`; served by the tenant core (`api/core`).

- **Catalog/inventory:** `Product`, `ProductVariant`, `Inventory`, `InventoryLog`, `Category`.
- **Sales:** `Order`, `OrderItem`, `OrderStatusHistory`, `POSSession`, `Payment`, `Invoice`, `PromoCode`, `Review`.
- **Storefront:** `api/core/storefront`, `api/v1` (public products/orders/addresses/profile), `Customer`, `Address`, `CartItem`, `Favorite`.
- **Delivery:** `Delivery`, `DeliveryZone`, `DeliveryPartner`, `LiveTrackingSession`, `PartnerLocationHistory`.

---

## 11. Current Technical Debt

| # | Debt | Evidence | Risk |
|---|---|---|---|
| 1 | **`typescript.ignoreBuildErrors: true`** masks type errors at build time | `next.config.js` | Type regressions ship silently |
| 2 | **74 `tsc --noEmit` errors** (products, provisioning, businesses, website domains) | `npx tsc --noEmit` → 74 | Latent type bugs; mostly `MiddlewareConfig`/`RouteContext`/Prisma-input mismatches |
| 3 | **36 routes still use generic `[id]`** instead of entity slug | Route audit (§4) | Not a conflict today, but keeps `[id]` "in circulation" — a future sibling could collide (CI guard now catches this) |
| 4 | **8 architecture violations / 18+ misplaced models** (per Architecture Audit v2.1) | Memory: `architecture-audit-v2-1.md` | Expected for v1.0–v1.5; extraction planned v1.8.0+ |
| 5 | **`reactStrictMode: false`** | `next.config.js` | Masks effect/double-render issues |
| 6 | **158 models in one schema** | `prisma/schema.prisma` | Single large schema; domain boundaries are by convention, not module isolation |

**None of the above block deployment.** They are tracked, not emergencies.

---

## 12. Future Refactoring Candidates

Ordered roughly by value/effort. **All require explicit approval** before work begins (several touch Protected Domains).

1. **Standardize the 36 `[id]` routes** to entity slugs (§4), one owner-approved batch at a time. Routing-only; the CI guard already prevents regressions. *(User decision: handle individually.)*
2. **Burn down the 74 `tsc` errors**, then flip `ignoreBuildErrors` to `false` so the build type-checks. Sequence the fixes by domain; do not bundle with feature work.
3. **Domain module extraction (v1.8.0+):** split Commerce / Laundry / HRMS / Billing into clearer module boundaries per Architecture Audit v2.1 (Golden Rules 12–14).
4. **Prisma schema segmentation:** split the 158-model schema into per-domain files / Prisma folder, once Prisma version supports the team's chosen layout.
5. **Re-enable `reactStrictMode`** and fix surfaced issues.
6. **Consider promoting the route guard to a shared lint/CI lib** if more Quantix services adopt the App Router.

---

## Change Control

- This baseline is **descriptive**. Update it when an *approved* architecture change lands — not for routine implementation.
- The **Deployment Pipeline, Routing guard/CI, Webhook, nginx, PM2, and Database Schema are frozen.** Modify only on explicit request.
- Before any new feature: re-read §4, §5, §6 and confirm the change does not violate routing conventions or touch a Protected Domain without sign-off.
