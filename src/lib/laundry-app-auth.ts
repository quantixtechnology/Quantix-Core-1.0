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

export interface AppSession { customerId: string; businessId: string; userId: string; tokenId: string }

// Resolve a platform access token → the laundry customer it belongs to.
export async function resolveSession(token: string | null): Promise<AppSession | null> {
  if (!token) return null
  const rt = await db.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { id: true, userId: true } })
  if (!rt?.userId) return null
  // The customer app operates for a single laundry tenant; a user maps to its
  // customer profile. (Scoped-by-tenant lookup for multi-tenant deployments.)
  const customer = await db.customer.findFirst({ where: { userId: rt.userId, status: { not: "MERGED" } }, orderBy: { lastLoginAt: "desc" }, select: { id: true, businessId: true } })
  if (!customer) return null
  return { customerId: customer.id, businessId: customer.businessId, userId: rt.userId, tokenId: rt.id }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null
}
