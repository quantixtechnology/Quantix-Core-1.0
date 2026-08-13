// ============================================================================
// Laundry Customer App — session resolution ONLY.
//
// Authentication is the platform EMAIL OTP service (createStorefrontSession →
// access/refresh tokens in the RefreshToken table). This module does NOT
// implement OTP or a parallel auth framework — it simply resolves the platform
// access token on /api/laundry/app requests into the signed-in customer.
// (The former mobile-OTP tables/APIs/SMS were removed in the email migration.)
// ============================================================================
import { db } from "@/lib/db"
import { resolveHostTenant } from "@/lib/pwa-tenant-boundary"

export interface AppSession { customerId: string; businessId: string; userId: string; tokenId: string }

// Resolve a platform access token → the laundry customer it belongs to.
export async function resolveSession(request: Request): Promise<AppSession | null> {
  const token = bearerToken(request)
  if (!token) return null
  const rt = await db.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { id: true, userId: true } })
  if (!rt?.userId) return null
  // The customer app runs on ONE tenant's host, so the profile is looked up
  // WITHIN that tenant. Previously it took the user's most recently used
  // customer row regardless of host, which both accepted a session on another
  // business's PWA and could load the wrong profile for someone who shops with
  // two tenants.
  const hostTenant = await resolveHostTenant(request)
  const customer = await db.customer.findFirst({
    where: {
      userId: rt.userId,
      status: { not: "MERGED" },
      ...(hostTenant ? { businessId: hostTenant.platformBusinessId } : {}),
    },
    orderBy: { lastLoginAt: "desc" },
    select: { id: true, businessId: true },
  })
  // No profile for THIS tenant → the account does not belong to this business.
  if (!customer) return null
  return { customerId: customer.id, businessId: customer.businessId, userId: rt.userId, tokenId: rt.id }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null
}
