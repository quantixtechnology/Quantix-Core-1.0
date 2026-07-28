# Laundry OS — Role-Based Access Control (RBAC)

## Permission Philosophy

RBAC is structured around **one permission per screen** with four hierarchical access levels. This replaces the legacy model of 100+ granular action permissions (e.g. `laundry.orders.view`, `laundry.orders.edit`) with a simpler, maintainable approach.

| Level | Value | Semantics |
|-------|-------|-----------|
| Hide | 0 | No access — the screen is invisible |
| View | 1 | Read-only — search, filter, print, export, lookup, scan |
| Create | 2 | View + create records + workflow progression (process, pack, dispatch, receive, deliver, QC pass/fail, pause, resume, bulk) |
| Edit | 3 | Create + destructive/exceptional actions (delete, cancel, reject, override, reverse workflow, manual release, return to queue, merge) |

Levels are hierarchical: `Edit > Create > View > Hide`. A user with `Edit` on a screen can do everything `Create` and `View` allow.

## Key Principles

1. **One key per screen.** Every Laundry OS screen has exactly one key (e.g. `laundry.orders`). Never add action-level keys.
2. **Registry is the single source of truth.** Every screen must be registered in `laundry-rbac-registry.ts` before it can be protected.
3. **Super Admin is unrestricted.** `QUANTIX_SUPER_ADMIN` and `PLATFORM_ADMIN` roles bypass all checks.
4. **Business Owner gets Edit on everything.** The `BUSINESS_OWNER` system role covers every registered screen at Edit level.

## Architecture

```
laundry-rbac-registry.ts   ← Screens, levels, backward-compat mapping (single source of truth)
laundry-rbac-catalog.ts    ← System role definitions (which screens at which level per role)
laundry-rbac.ts            ← Runtime guards (requireLaundryLevel), permission resolution, DB seeding
```

## How To

### Register a New Screen

1. Add a `{ key, label }` entry to the appropriate module in `SCREEN_MODULES` in `laundry-rbac-registry.ts`.
2. Every screen key follows the format `{module}.{screen}`, e.g. `laundry.orders`.

### Protect an API Route

```typescript
import { requireLaundryLevel, Level } from "@/lib/laundry-rbac"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryLevel(request, businessId, "laundry.orders", Level.VIEW)
  if (!guard.ok) return guard.res
  // ... handler logic
}

export async function POST(request: Request) {
  const b = await request.json()
  const guard = await requireLaundryLevel(request, b.businessId, "laundry.orders", Level.CREATE)
  if (!guard.ok) return guard.res
  // ... handler logic
}
```

Guard response:
- `400` — Missing businessId
- `401` — Not authenticated
- `403` — Permission denied (insufficient level)
- `{ ok: true, ctx, resolved, platformBusinessId }` — Success

### Protect a Page (Server Component)

```typescript
import { requireLaundryLevel, Level } from "@/lib/laundry-rbac"

const guard = await requireLaundryLevel(request, businessId, "laundry.orders", Level.VIEW)
if (!guard.ok) return new Response("Forbidden", { status: 403 })
```

### Protect a Page (Client Component)

The sidebar already gates visibility via the `perm` field on each `NavCfg` entry. For inline protection:

```typescript
const { levels, isOwner } = rbac // fetched from /api/laundry/rbac/me
const canView = isOwner || (levels["laundry.orders"] ?? 0) >= 1
const canCreate = isOwner || (levels["laundry.orders"] ?? 0) >= 2
const canEdit = isOwner || (levels["laundry.orders"] ?? 0) >= 3
```

### Protect a Button

```typescript
import { screenLevel, Level } from "@/lib/laundry-rbac"

// levels is a Map<string, number> from resolveUserPermissions
if (screenLevel(levels, "laundry.orders") >= Level.EDIT) {
  return <Button onClick={handleDelete}>Delete Order</Button>
}
```

On the client side, use the `levels` object from the `/api/laundry/rbac/me` endpoint:

```typescript
const level = levels["laundry.orders"] ?? 0
if (level >= 2) { /* show create button */ }
if (level >= 3) { /* show edit/delete button */ }
```

### Create a New Default Role

1. Add a new entry to `SYSTEM_ROLES` array in `laundry-rbac-catalog.ts`.
2. Each role has a `code`, `name`, `description`, optional `isOwner`, and a `screens()` function returning `ScreenLevel[]`.
3. Run `POST /api/laundry/rbac/seed` to create the role in existing businesses.

```typescript
{
  code: "NEW_ROLE",
  name: "New Role",
  description: "Description of what this role can do.",
  isOwner: false,
  screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    { screenKey: "laundry.orders", level: Level.CREATE },
  ],
}
```

## Migration from Legacy Permissions

The compat shim `requireLaundryPermission()` is **deprecated**. It exists only to support ~100 existing API routes during the migration from action-level keys (e.g. `laundry.orders.view`) to screen-level keys (e.g. `laundry.orders`).

All new code must use `requireLaundryLevel(screenKey, Level.*)` directly.

The `permKeyToScreenLevel()` function handles backward-compatible mapping of old `{module}.{screen}.{action}` keys to `{screenKey, level}` pairs. This is used internally by the compat shim and by `resolveUserPermissions` when reading old-format DB rows.

## System Roles

| Role | Scope |
|------|-------|
| BUSINESS_OWNER | Full access — Edit on every screen |
| STORE_MANAGER | Store operations + processing at Create, limited screens at View |
| STORE_SUPERVISOR | Orders, customers, store audit at Create |
| COUNTER_EXECUTIVE | Order creation, customer handling, payment collection |
| CRM_MANAGER | CRM at Create/Edit depending on screen |
| CRM_EXECUTIVE | CRM at View/Create depending on screen |
| PROCESSING_MANAGER | All processing screens at Create |
| PROCESSING_STAFF | Workstation operations at Create |
| DELIVERY_EXECUTIVE | Delivery screens only (transit, ready-for-delivery) |
| ACCOUNTANT | Financial reports, payment screens |
| VIEWER | Read-only on every screen |

## Deployment Checklist

- [ ] Take database backup
- [ ] Run during low-traffic maintenance window
- [ ] Apply migration: `npx prisma db push`
- [ ] Verify Super Admin access
- [ ] Verify one Business Owner account
- [ ] Verify one Store Staff account
- [ ] Verify one Processing Operator account
- [ ] Verify one Delivery Executive account
- [ ] Monitor logs for unexpected 401/403 responses
