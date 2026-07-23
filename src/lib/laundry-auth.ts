import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPlatformRole } from "@/lib/permissions"

export type LaundryAuthContext = {
  userId: string
  userName: string
  userEmail: string
  laundryBusinessId: string
  platformBusinessId: string | null
  role: string
  isSupportMode: boolean
  supportAdminName?: string
}

// The caller's identity, resolved from either a NextAuth session cookie
// (platform staff) or the Laundry OS Bearer access token (tenant users).
type Identity = { userId: string; role: string; email: string; name: string }

/**
 * Resolve the caller's identity for Laundry OS.
 *
 * Laundry OS tenant users authenticate with the custom access token issued by
 * /api/core/auth/login (stored in localStorage, sent by api-client as
 * `Authorization: Bearer …` and persisted in the refreshToken table) — NOT a
 * NextAuth session cookie. Platform staff in support mode DO use a NextAuth
 * cookie. This resolves both so API guards recognise tenant users too.
 */
async function resolveIdentity(request?: Request): Promise<Identity | null> {
  // 1. NextAuth session cookie (platform staff / support mode). Never let a
  //    session-read failure (no cookie, malformed cookie, missing context) throw
  //    — that would surface as a 500 for perfectly valid Bearer-token callers
  //    (e.g. the Store Admin / Executive PWAs). Fall through to the Bearer path.
  const session = await getServerSession(authOptions).catch(() => null)
  if (session?.user?.id) {
    return { userId: session.user.id, role: session.user.role, email: session.user.email || "", name: session.user.name || "" }
  }
  // 2. Bearer access token (Laundry OS tenant users). Requires the request so
  //    we can read the Authorization header.
  const authHeader = request?.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "").trim()
  if (token) {
    const rt = await prisma.refreshToken.findUnique({
      where: { token },
      select: { expiresAt: true, user: { select: { id: true, email: true, name: true, isActive: true, platformRole: true } } },
    })
    if (rt && rt.expiresAt >= new Date() && rt.user.isActive) {
      // Platform staff carry a platformRole; tenant users don't (their effective
      // role comes from the BusinessUser row resolved below), so default to the
      // laundry-owner marker only for the BusinessUser lookup path.
      return { userId: rt.user.id, role: rt.user.platformRole || "", email: rt.user.email || "", name: rt.user.name || "" }
    }
  }
  return null
}

/**
 * Get the effective Laundry OS auth context for the current caller.
 *
 * Two modes:
 *   1. Direct login — user has an active BusinessUser for this laundry business
 *      (identity from either a NextAuth cookie or the Bearer access token)
 *   2. Support mode — platform admin accessing via support session
 *
 * Returns null if the caller is not authorized for Laundry OS.
 */
export async function getLaundryAuthContext(laundryBusinessId: string, request?: Request): Promise<LaundryAuthContext | null> {
  const identity = await resolveIdentity(request)
  if (!identity) return null

  const { userId, role, email: userEmail, name: userName } = identity

  const laundryBusiness = await prisma.laundryBusiness.findUnique({
    where: { id: laundryBusinessId },
    select: { platformBusinessId: true },
  })
  if (!laundryBusiness) return null

  // Mode 1: Direct login — user has an active BusinessUser for this tenant.
  // (Checked first and independent of the session role string, so tenant users
  // authenticating by Bearer token — whose identity role may be empty — resolve.)
  const businessUser = await prisma.businessUser.findFirst({
    where: {
      userId,
      businessId: laundryBusiness.platformBusinessId || undefined,
      isActive: true,
    },
    select: { role: true },
  })
  if (businessUser) {
    return {
      userId,
      userName,
      userEmail,
      laundryBusinessId,
      platformBusinessId: laundryBusiness.platformBusinessId,
      role: businessUser.role,
      isSupportMode: false,
    }
  }

  // Mode 2: Support mode — platform admin with no BusinessUser for this tenant.
  if (isPlatformRole(role)) {
    return {
      userId,
      userName,
      userEmail,
      laundryBusinessId,
      platformBusinessId: laundryBusiness.platformBusinessId,
      role,
      isSupportMode: true,
      supportAdminName: userName,
    }
  }

  return null
}
