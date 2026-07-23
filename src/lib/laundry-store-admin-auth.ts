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
import { isPlatformRole } from "@/lib/permissions"

export { bearerToken }

// Only these operational store roles may use the Store Admin PWA as store staff.
export const STORE_ADMIN_ROLES = new Set(["STORE_MANAGER", "COUNTER_EXECUTIVE", "STORE_SUPERVISOR"])

export interface StoreAdminSession {
  userId: string
  isSuperAdmin: boolean
  // Store-staff sessions carry a fixed store; Super Admin sessions do not (they
  // pick the store per-request via resolveStoreScope).
  platformBusinessId?: string
  businessId?: string
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

  // Super Admin / Platform Admin — unrestricted, no store binding required.
  if (user.platformRole && isPlatformRole(user.platformRole)) {
    return { userId: rt.userId, isSuperAdmin: true }
  }

  // Store staff — must hold an active store-operational role bound to a store.
  const assign = await prisma.laundryAccessAssignment.findFirst({
    where: { userId: rt.userId, active: true, storeId: { not: null } },
    include: { role: { select: { code: true, name: true, isActive: true } } },
  })
  if (!assign?.storeId || !assign.role.isActive || !STORE_ADMIN_ROLES.has(assign.role.code)) return null

  const biz = await resolveLaundryBusiness(assign.businessId)
  if (!biz) return null
  const store = await prisma.laundryStore.findFirst({ where: { id: assign.storeId, laundryBusinessId: biz.id, isActive: true }, select: { id: true } })
  if (!store) return null

  return { userId: rt.userId, isSuperAdmin: false, platformBusinessId: assign.businessId, businessId: biz.id, storeId: assign.storeId, roleCode: assign.role.code, roleName: assign.role.name }
}

// Server guard for every Store Admin API. Returns the session or a 401 response.
export async function requireStoreAdmin(request: Request): Promise<{ ok: true; session: StoreAdminSession } | { ok: false; res: NextResponse }> {
  const session = await resolveStoreAdmin(bearerToken(request))
  if (!session) return { ok: false, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  return { ok: true, session }
}

// The effective { businessId, storeId } for a request. Store staff are LOCKED to
// their bound store — any query params are ignored (isolation). A Super Admin
// targets whichever business + store they pass (unrestricted). Returns null when
// a Super Admin hasn't yet chosen a valid store.
export async function resolveStoreScope(session: StoreAdminSession, request: Request): Promise<{ businessId: string; storeId: string } | null> {
  if (!session.isSuperAdmin) {
    return session.businessId && session.storeId ? { businessId: session.businessId, storeId: session.storeId } : null
  }
  const sp = new URL(request.url).searchParams
  const bizInput = sp.get("businessId"); const storeId = sp.get("storeId")
  if (!bizInput || !storeId) return null
  const biz = await resolveLaundryBusiness(bizInput)
  if (!biz) return null
  const store = await prisma.laundryStore.findFirst({ where: { id: storeId, laundryBusinessId: biz.id }, select: { id: true } })
  if (!store) return null
  return { businessId: biz.id, storeId }
}
