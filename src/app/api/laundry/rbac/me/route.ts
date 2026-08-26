// GET /api/laundry/rbac/me[?businessId=] — the caller's effective permissions
// for a laundry workspace.
//
// `businessId` is a HINT, not an identity. It arrives from localStorage and can
// be missing, stale, or name a business the caller no longer belongs to. This
// endpoint used to 400 on a missing id and 404 on an unrecognised one, both
// BEFORE authenticating — so a stale cached id locked the Business Owner out of
// their own workspace with "Unable to load this workspace".
//
// The authenticated user's membership is the authority. resolveCallerWorkspace()
// honours the supplied id when it holds up and otherwise resolves the caller's
// own workspace from the database. The resolved ids are returned so the client
// can correct a stale cache instead of asking a human to.
import { NextResponse } from "next/server"
import { resolveCallerWorkspace } from "@/lib/laundry-auth"
import { resolveUserPermissions, ensureSystemRolesSeeded } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("businessId")
  const ws = await resolveCallerWorkspace(requested, request)

  // Unauthenticated and "authenticated but has no laundry workspace at all" are
  // different answers, and the client treats them differently: 401 means log in
  // again, 404 means this account genuinely has no workspace.
  if (!ws) {
    const { resolveIdentity } = await import("@/lib/laundry-auth")
    const identity = await resolveIdentity(request)
    if (!identity) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    return NextResponse.json({ error: "No laundry workspace is available for this account." }, { status: 404 })
  }

  const { ctx, laundryBusinessId, platformBusinessId, source } = ws
  await ensureSystemRolesSeeded(platformBusinessId)
  const r = await resolveUserPermissions(platformBusinessId, ctx.userId, ctx.role)
  const levelsObj: Record<string, number> = {}
  for (const [k, v] of r.levels) levelsObj[k] = v

  return NextResponse.json({
    success: true,
    data: {
      roleCode: r.roleCode,
      roleName: r.roleName,
      isOwner: r.isOwner,
      source: r.source,
      levels: levelsObj,
      // The workspace this session is ACTUALLY operating on. When it differs
      // from what the client asked for, the client should adopt it.
      businessId: laundryBusinessId,
      platformBusinessId,
      resolvedFrom: source,
    },
  })
}
