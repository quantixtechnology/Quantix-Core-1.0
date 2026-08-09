// Store Admin session resolution + server-side Store isolation guard.
// Reuses the platform token store (RefreshToken) — the SAME session architecture
// as the Customer App and Executive PWA. No parallel auth.
//   • Store staff  → a User with an ACTIVE laundry RBAC assignment carrying a
//     store-operational role, scoped to exactly ONE store (assignment.storeId).
//     Isolation is derived from that binding and enforced on the server.
//   • Super Admin  → a platform Super Admin / Platform Admin gets UNRESTRICTED
//     access to ANY business + store, any time (chosen per-request). This mirrors
//     their unrestricted desktop access; the laundry APIs already authorise them
//     via getLaundryAuthContext support-mode.
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { bearerToken } from "@/lib/laundry-executive-auth"
import { resolveStoreTenant } from "@/lib/laundry-executive-tenant"

export { bearerToken }

// Only these operational store roles may use the Store Admin PWA as store staff.
export const STORE_ADMIN_ROLES = new Set(["STORE_MANAGER", "COUNTER_EXECUTIVE", "STORE_SUPERVISOR"])

/**
 * Who may cross tenant boundaries in the Store Admin PWA.
 *
 * This used to be `isPlatformRole()`, which is true for THIRTEEN roles —
 * sales, HR, finance, support, deployment, a read-only auditor. Any of them
 * signing into the store app was handed every business and every store in the
 * platform, which is a tenant-isolation breach, not a convenience.
 *
 * Cross-tenant access belongs to the platform administrators alone. Every
 * other platform role falls through to the store-staff path below: they get a
 * store only if they hold a real store assignment, and 401 otherwise.
 */
export const CROSS_TENANT_ROLES = new Set(["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"])

export const isCrossTenantRole = (role: string | null | undefined): boolean =>
  !!role && CROSS_TENANT_ROLES.has(role)

/**
 * How wide a session may reach. Every isolation decision reads this one field
 * instead of inferring from which of businessId / storeId happens to be set.
 *
 *   STORE     one store. The assignment names it; nothing can widen it.
 *   BUSINESS  every store of ONE business — a manager assigned business-wide,
 *             or a platform admin on a tenant host (see requireStoreAdmin).
 *   PLATFORM  every business. Only a platform administrator, and only when the
 *             host does not already identify a tenant.
 */
export type StoreAdminScope = "STORE" | "BUSINESS" | "PLATFORM"

export interface StoreAdminSession {
  userId: string
  isSuperAdmin: boolean
  scope: StoreAdminScope
  platformBusinessId?: string
  businessId?: string
  /** Set only at STORE scope. */
  storeId?: string
  roleCode?: string
  roleName?: string
}

export async function resolveStoreAdmin(token: string | null): Promise<StoreAdminSession | null> {
  if (!token) return null
  const rt = await prisma.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { userId: true } })
  if (!rt?.userId) return null

  const user = await prisma.user.findUnique({ where: { id: rt.userId }, select: { isActive: true, platformRole: true } })
  if (!user?.isActive) return null

  // Platform administrators only — unrestricted, no store binding required.
  // requireStoreAdmin narrows this to BUSINESS when the host names a tenant.
  if (isCrossTenantRole(user.platformRole)) {
    return { userId: rt.userId, isSuperAdmin: true, scope: "PLATFORM" }
  }

  // Store staff. An assignment either names a store or covers the business:
  //   storeId set  → that store only.
  //   storeId null → every store of the business, chosen per session.
  // The store-scoped assignment is preferred when a user somehow holds both,
  // because the narrower grant is the safer reading.
  const assignments = await prisma.laundryAccessAssignment.findMany({
    where: { userId: rt.userId, active: true },
    include: { role: { select: { code: true, name: true, isActive: true } } },
  })
  const usable = assignments.filter((a) => a.role.isActive && STORE_ADMIN_ROLES.has(a.role.code))
  const assign = usable.find((a) => a.storeId) ?? usable[0]
  if (!assign) return null

  const biz = await resolveLaundryBusiness(assign.businessId)
  if (!biz) return null

  const base = {
    userId: rt.userId, isSuperAdmin: false,
    platformBusinessId: assign.businessId, businessId: biz.id,
    roleCode: assign.role.code, roleName: assign.role.name,
  }

  if (!assign.storeId) {
    // Business-wide: only worth a session if the business actually has a store.
    const any = await prisma.laundryStore.findFirst({ where: { laundryBusinessId: biz.id, isActive: true }, select: { id: true } })
    if (!any) return null
    return { ...base, scope: "BUSINESS" }
  }

  const store = await prisma.laundryStore.findFirst({ where: { id: assign.storeId, laundryBusinessId: biz.id, isActive: true }, select: { id: true } })
  if (!store) return null
  return { ...base, scope: "STORE", storeId: assign.storeId }
}

/**
 * Server guard for every Store Admin API.
 *
 * Also narrows a platform administrator to the tenant in the URL. The app is
 * served per tenant — store.<slug>.<base> — so on that host even a Super Admin
 * is working inside one business and must not be offered any other. Platform
 * scope survives only on a host that names no tenant.
 */
export async function requireStoreAdmin(request: Request): Promise<{ ok: true; session: StoreAdminSession } | { ok: false; res: NextResponse }> {
  const session = await resolveStoreAdmin(bearerToken(request))
  if (!session) return { ok: false, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }

  if (session.scope === "PLATFORM") {
    const tenant = await resolveStoreTenant(request).catch(() => null)
    if (tenant) {
      return {
        ok: true,
        session: {
          ...session, scope: "BUSINESS",
          businessId: tenant.laundryBusinessId, platformBusinessId: tenant.platformBusinessId,
        },
      }
    }
  }
  return { ok: true, session }
}

/**
 * The effective { businessId, storeId } for one request.
 *
 * This is the isolation boundary, and it never trusts the client further than
 * the session allows:
 *
 *   STORE     the bound store. Query parameters are ignored entirely.
 *   BUSINESS  a store chosen per request, but it must belong to the session's
 *             business — the businessId in the URL is never read, so naming
 *             another tenant cannot widen anything.
 *   PLATFORM  any business + store the caller names, both verified to exist
 *             and to belong together.
 *
 * Returns null when no valid store has been chosen yet.
 */
export async function resolveStoreScope(session: StoreAdminSession, request: Request): Promise<{ businessId: string; storeId: string } | null> {
  if (session.scope === "STORE") {
    return session.businessId && session.storeId ? { businessId: session.businessId, storeId: session.storeId } : null
  }

  const sp = new URL(request.url).searchParams
  const storeId = sp.get("storeId")
  if (!storeId) return null

  if (session.scope === "BUSINESS") {
    if (!session.businessId) return null
    // Membership check against the SESSION's business, not a supplied one.
    const store = await prisma.laundryStore.findFirst({
      where: { id: storeId, laundryBusinessId: session.businessId }, select: { id: true },
    })
    return store ? { businessId: session.businessId, storeId } : null
  }

  const bizInput = sp.get("businessId")
  if (!bizInput) return null
  const biz = await resolveLaundryBusiness(bizInput)
  if (!biz) return null
  const store = await prisma.laundryStore.findFirst({ where: { id: storeId, laundryBusinessId: biz.id }, select: { id: true } })
  if (!store) return null
  return { businessId: biz.id, storeId }
}
