// Store Admin session resolution + server-side Store isolation guard.
// Reuses the platform token store (RefreshToken) — the SAME session architecture
// as the Customer App and Executive PWA. No parallel auth. A Store Admin is a
// User with an ACTIVE laundry RBAC assignment that (a) carries a store-operational
// role and (b) is scoped to exactly one Store (assignment.storeId). Store
// isolation is derived from that binding and enforced on the server — never the
// client.
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { bearerToken } from "@/lib/laundry-executive-auth"

export { bearerToken }

// Only these operational store roles may use the Store Admin PWA. Owners /
// managers / config roles use the desktop Admin Dashboard.
export const STORE_ADMIN_ROLES = new Set(["STORE_MANAGER", "COUNTER_EXECUTIVE", "STORE_SUPERVISOR"])

export interface StoreAdminSession {
  userId: string
  platformBusinessId: string // BusinessUser / RBAC-assignment scope
  businessId: string // LaundryBusiness.id — the order/store scope
  storeId: string // LOCKED: the one store this admin may ever see
  roleCode: string
  roleName: string
}

// Resolve a bearer token → the store-scoped session, or null if the token, the
// user, the assignment, the role, or the store fails any check.
export async function resolveStoreAdmin(token: string | null): Promise<StoreAdminSession | null> {
  if (!token) return null
  const rt = await prisma.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { userId: true } })
  if (!rt?.userId) return null

  const assign = await prisma.laundryAccessAssignment.findFirst({
    where: { userId: rt.userId, active: true, storeId: { not: null } },
    include: { role: { select: { code: true, name: true, isActive: true } } },
  })
  if (!assign?.storeId || !assign.role.isActive || !STORE_ADMIN_ROLES.has(assign.role.code)) return null

  const user = await prisma.user.findUnique({ where: { id: rt.userId }, select: { isActive: true } })
  if (!user?.isActive) return null

  const biz = await resolveLaundryBusiness(assign.businessId)
  if (!biz) return null
  // The bound store must still exist, be active, and belong to this business.
  const store = await prisma.laundryStore.findFirst({ where: { id: assign.storeId, laundryBusinessId: biz.id, isActive: true }, select: { id: true } })
  if (!store) return null

  return { userId: rt.userId, platformBusinessId: assign.businessId, businessId: biz.id, storeId: assign.storeId, roleCode: assign.role.code, roleName: assign.role.name }
}

// Server guard for every Store Admin API. Returns the session or a 401 response.
// Callers MUST scope all reads/writes by session.storeId + session.businessId —
// this is the single point where Store isolation is enforced.
export async function requireStoreAdmin(request: Request): Promise<{ ok: true; session: StoreAdminSession } | { ok: false; res: NextResponse }> {
  const session = await resolveStoreAdmin(bearerToken(request))
  if (!session) return { ok: false, res: NextResponse.json({ error: "Not authenticated as store staff" }, { status: 401 }) }
  return { ok: true, session }
}
