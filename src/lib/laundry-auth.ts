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
export async function resolveIdentity(request?: Request): Promise<Identity | null> {
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

// ────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE WORKSPACE RESOLUTION
//
// A workspace request carries a businessId from the browser. That value is a
// CONVENIENCE, never an identity: it lives in localStorage, it survives a
// re-provision, and it can name a business the caller no longer belongs to (or
// one that never existed). Treating it as the identity is what locked the Owner
// out — a stale id produced a 404 and the workspace refused to open, even
// though the database knew perfectly well which business that user owns.
//
// The authoritative relationship is:
//     User → BusinessUser(isActive) → Business → LaundryBusiness
// and it is resolved here, from the authenticated identity, whenever the
// supplied id does not work out.
// ────────────────────────────────────────────────────────────────────────────

/** Business roles that mark the tenant's owner. Mirrors laundry-rbac's list. */
const OWNER_ROLES = new Set(["CLIENT_OWNER", "LAUNDRY_OWNER"])

export type WorkspaceResolution = {
  ctx: LaundryAuthContext
  laundryBusinessId: string
  platformBusinessId: string
  /** Where the answer came from — "requested" honours the caller's id. */
  source: "requested" | "membership"
}

/**
 * Every laundry workspace the authenticated user actually belongs to, most
 * authoritative first: an owner membership outranks staff, then most recent.
 * Read-only.
 */
export async function callerLaundryWorkspaces(userId: string): Promise<
  { laundryBusinessId: string; platformBusinessId: string; role: string }[]
> {
  const memberships = await prisma.businessUser.findMany({
    where: { userId, isActive: true },
    select: { businessId: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  if (!memberships.length) return []

  const laundry = await prisma.laundryBusiness.findMany({
    where: { platformBusinessId: { in: memberships.map((m) => m.businessId) } },
    select: { id: true, platformBusinessId: true },
  })
  const byPlatform = new Map(laundry.map((l) => [l.platformBusinessId as string, l.id]))

  const rows = memberships
    .filter((m) => byPlatform.has(m.businessId))
    .map((m) => ({
      laundryBusinessId: byPlatform.get(m.businessId) as string,
      platformBusinessId: m.businessId,
      role: String(m.role),
    }))

  // Owner memberships first — if this person owns a workspace, that is the one
  // they mean, whatever a stale cache says.
  return rows.sort((a, b) => Number(OWNER_ROLES.has(b.role)) - Number(OWNER_ROLES.has(a.role)))
}

/**
 * Resolve the workspace for this request.
 *
 * Honours `requestedBusinessId` when it names a real laundry business the
 * caller may use. Otherwise — missing, stale, invalid, or belonging to another
 * tenant — falls back to the caller's OWN membership, so a bad id can never be
 * the reason a legitimate user is refused their workspace.
 *
 * Returns null only when the caller is genuinely unauthenticated or genuinely
 * has no laundry workspace.
 */
export async function resolveCallerWorkspace(
  requestedBusinessId: string | null | undefined,
  request?: Request,
): Promise<WorkspaceResolution | null> {
  const identity = await resolveIdentity(request)
  if (!identity) return null

  // 1. Honour what the caller asked for, when it holds up.
  if (requestedBusinessId) {
    const biz = await prisma.laundryBusiness.findFirst({
      where: { OR: [{ id: requestedBusinessId }, { platformBusinessId: requestedBusinessId }] },
      select: { id: true, platformBusinessId: true },
    })
    if (biz?.platformBusinessId) {
      const ctx = await getLaundryAuthContext(biz.id, request)
      if (ctx) {
        return { ctx, laundryBusinessId: biz.id, platformBusinessId: biz.platformBusinessId, source: "requested" }
      }
    }
  }

  // 2. Fall back to the database relationship. This is the line that keeps the
  //    Owner out of the lockout: their membership is permanent, the cached id
  //    is not.
  for (const ws of await callerLaundryWorkspaces(identity.userId)) {
    const ctx = await getLaundryAuthContext(ws.laundryBusinessId, request)
    if (ctx) {
      return { ctx, laundryBusinessId: ws.laundryBusinessId, platformBusinessId: ws.platformBusinessId, source: "membership" }
    }
  }

  return null
}
