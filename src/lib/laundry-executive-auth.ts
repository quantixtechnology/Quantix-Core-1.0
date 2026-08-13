// Delivery Executive session resolution ONLY. Reuses the platform token store
// (RefreshToken table) — the SAME session architecture as the customer app. No
// parallel auth framework: an executive's login mints a platform access token
// for their linked User; this module resolves that token → the active
// LaundryDeliveryExecutive it belongs to. The PWA gate is "an ACTIVE executive".
import { prisma } from "@/lib/prisma"
import { sessionMatchesHostTenant } from "@/lib/pwa-tenant-boundary"

export interface ExecSession { executiveId: string; userId: string; businessId: string; storeId: string | null }

/**
 * Resolve the executive session for THIS request.
 *
 * Takes the Request, not a bare token, so the host is always available: the
 * token alone says which business the executive belongs to, and comparing that
 * with the host is the entire point. Passing a token used to be enough, which
 * is how a Laundry executive's session was accepted on another tenant's
 * delivery host.
 */
export async function resolveExecutive(request: Request): Promise<ExecSession | null> {
  const token = bearerToken(request)
  if (!token) return null
  const rt = await prisma.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { userId: true } })
  if (!rt?.userId) return null
  const exec = await prisma.laundryDeliveryExecutive.findFirst({ where: { userId: rt.userId, isActive: true }, select: { id: true, businessId: true, storeId: true } })
  if (!exec) return null

  // The executive's businessId is a LaundryBusiness id; the host resolves to a
  // PLATFORM Business id, so compare on the platform axis.
  const biz = await prisma.laundryBusiness.findUnique({ where: { id: exec.businessId }, select: { platformBusinessId: true } })
  if (!(await sessionMatchesHostTenant(request, biz?.platformBusinessId ?? null))) return null

  return { executiveId: exec.id, userId: rt.userId, businessId: exec.businessId, storeId: exec.storeId }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null
}
