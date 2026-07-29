# Laundry OS RBAC Refactor — Production Deployment Report

**Generated:** 2026-07-28 15:35 IST

---

## Release Metadata

| Field | Value |
|-------|-------|
| Git Commit SHA | `e1d3890591b3c4c7d9933db2853369c7dce724fb` |
| Release Tag | `v2.0.0-rbac` |
| Branch | `main` |
| Remote | `origin` (https://github.com/quantixtechnology/Quantix-Core-1.0.git) |
| Deployment Timestamp | Pending (manual execution) |
| Deployed By | Operator |

## Verification Gates (Completed Pre-Deployment)

| Gate | Status | Details |
|------|--------|---------|
| Unit Tests | ✅ | 134/134 passing, 10 test files |
| Production Build | ✅ | `next build` compiles successfully (426 pages, no RBAC errors) |
| TypeScript | ✅ | No new type errors introduced |
| RBAC Documentation | ✅ | `docs/RBAC.md` — philosophy, how-to guides, deployment checklist |
| CI Protection Gates | ✅ | 6 new tests: API keys (58), sidebar-registry consistency, dynamic processing keys |
| Compat Shim Deprecation | ✅ | `@deprecated` JSDoc on `requireLaundryPermission()`, points to `requireLaundryLevel()` |
| Registry Frozen | ✅ | Header comment enumerates 4 required steps for new screens |
| Legacy Migration | ✅ | All old-format DB keys (`laundry.orders.view`) normalize to screen keys |
| Default Roles | ✅ | 11 system roles verified — all screen keys valid, no duplicates |
| Super Admin Regression | ✅ | `isOwnerRole()` unchanged, bypass preserved, all screens at EDIT |
| Runtime API Verification | ✅ | 16/16 CRUD + auth + compat shim + seed tests pass against dev server |

## Database Migration

| Item | Status |
|------|--------|
| Schema Change | `level Int @default(1)` added to `LaundryAccessPermission` |
| Migration Command | `npx prisma db push` (tested locally — idempotent, no data loss) |
| Old Data | Existing rows get `level = 1` (View) via `@default(1)` |
| Rollback | Remove `level` column; existing rows retain their `permKey` values |

### Migration Steps (for operator)

```bash
# 1. Backup database
cp prisma/data.db prisma/data.db.backup-$(date +%Y%m%d)

# 2. Apply schema
npx prisma db push

# 3. Verify column exists
sqlite3 prisma/data.db "PRAGMA table_info(LaundryAccessPermission);" | grep level
```

## Deployment Steps (for operator)

```bash
# 1. Pull tagged release
git fetch origin
git checkout v2.0.0-rbac

# 2. Install dependencies (if changed)
npm ci --omit=dev

# 3. Apply database migration
npx prisma db push

# 4. Build
npm run build

# 5. Restart services
pm2 restart all

# 6. Verify health
curl -s http://localhost:3999/api/laundry/rbac/catalog | head -c 100
```

## Post-Deployment Smoke Tests (for operator)

### Super Admin
- [ ] Login, dashboard, orders, processing, customers, settings, roles & permissions, reports
- [ ] No hidden menus, no missing buttons, no 401, no 403

### Business Owner
- [ ] Sidebar, orders, customers, pricing, roles, store counter
- [ ] Can: create order, store audit, payment collection
- [ ] Cannot: delete, override, refund

### Processing Operator
- [ ] Washing, drying, ironing, QC
- [ ] Cannot: business settings, user management

### Delivery Executive
- [ ] Executive login, assigned jobs, pickup, delivery

## E2E Workflow Validation (for operator)

- [ ] Order Created → Store Audit → Payment → Packing → Dispatch
- [ ] Processing → Quality Check → Return to Store → Ready for Delivery
- [ ] Delivered → Bag Released

## Monitoring (first 4 hours post-deployment)

Watch for:
- Unexpected 401/403 responses
- `Permission denied` or `Not authenticated` errors in application logs
- Prisma errors or schema mismatch
- Sidebar rendering issues (missing items, wrong items visible)
- 500 errors from any RBAC-protected endpoint

## Rollback

```bash
git checkout <previous-tag>
npx prisma db push  # revert schema if needed
pm2 restart all
```

## Final Verdict

**Status: ✅ RELEASED (commit pushed, tagged, remote synced)**

Deployment to production is pending operator execution. All pre-deployment validation gates pass. The RBAC refactor provides:
- One permission per screen (37 screens, 5 modules)
- Four clear levels (Hide/View/Create/Edit)
- Registry-driven authorization
- Backward compatibility for existing installations
- CI protection against regressions
- Full developer documentation
