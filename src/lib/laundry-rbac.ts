import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { getLaundryAuthContext } from "@/lib/laundry-auth"
import { isPlatformRole } from "@/lib/permissions"
import { allScreenKeys, isValidScreenKey, permKeyToScreenLevel, actionToLevel, screenLabel, Level } from "@/lib/laundry-rbac-registry"
import { SYSTEM_ROLES, fullAccessScreenKeys } from "@/lib/laundry-rbac-catalog"
import { ROLES } from "@/lib/constants"

export { Level }

export const INTERNAL_HEADER = "x-laundry-internal"
export const INTERNAL_TOKEN = process.env.LAUNDRY_INTERNAL_TOKEN || randomBytes(24).toString("hex")
export function isInternalCall(request: Request): boolean {
  if (request.headers.get(INTERNAL_HEADER) === INTERNAL_TOKEN) return true
  return process.env.NODE_ENV !== "production" && process.env.LAUNDRY_RBAC_TEST_BYPASS === "1"
}

/**
 * BusinessUser roles that mean "this person owns this business".
 *
 * There are two, because two creation paths exist and both are legitimate:
 *   CLIENT_OWNER  — written by Super Admin Business Creation → Provisioning
 *                   (business-provisioning.ts) and by createBusiness().
 *   LAUNDRY_OWNER — written by the laundry-native business route and whenever
 *                   an owner role is assigned in Roles & Permissions.
 *
 * Only LAUNDRY_OWNER used to count. An owner created by the Super Admin wizard
 * therefore matched nothing here, fell through to resolveUnassignedPermissions()
 * and got NO ACCESS AT ALL — which is why the Staff page showed "—" against the
 * Business Owner and every screen was denied. The Business Owner system role
 * existed and was correct; nobody resolved to it.
 *
 * Both are BUSINESS-scoped (see ROLES in constants.ts). Neither grants anything
 * platform-wide: platform authority comes from User.platformRole, which these
 * users do not have.
 */
export const OWNER_BUSINESS_ROLES = ["CLIENT_OWNER", "LAUNDRY_OWNER"] as const

export function isOwnerRole(businessRole: string | null | undefined): boolean {
  if (!businessRole) return false
  // Platform staff (support mode) also resolve as owner within the tenant.
  return (OWNER_BUSINESS_ROLES as readonly string[]).includes(businessRole) || isPlatformRole(businessRole)
}

/** True for the tenant's own owner — NOT for platform staff in support mode. */
export function isBusinessOwnerRole(businessRole: string | null | undefined): boolean {
  return !!businessRole && (OWNER_BUSINESS_ROLES as readonly string[]).includes(businessRole)
}

/**
 * System roles that hold EVERY screen at the top level.
 *
 * A full-access role is granted by its CODE rather than by a stored permission
 * list, for two reasons. It cannot drift — a tenant seeded before a module
 * existed would otherwise be missing that module's rows forever, which is what
 * "Permission denied on a screen I already granted" actually means. And it does
 * not need a per-screen grant every time a screen is added.
 *
 * This is NOT ownership. A full-access holder resolves with isOwner false, so
 * the Business Owner protections (cannot be deactivated, demoted or deleted)
 * keep applying to the owner alone and a full-access employee stays an ordinary
 * manageable member of staff. The owner-only screens stay owner-only, and the
 * handful of endpoints reserved to the owner or to platform staff by an
 * explicit role check — Navigation Manager, "apply standard schedule",
 * licensing, staff deletion — are unaffected: those are not permission checks.
 */
export const FULL_ACCESS_ROLE_CODES: ReadonlySet<string> = new Set(["ACCOUNTANT"])

export const isFullAccessRoleCode = (code: string | null | undefined): boolean =>
  !!code && FULL_ACCESS_ROLE_CODES.has(code.trim().toUpperCase())

export interface ResolvedPermissions { isOwner: boolean; permissions: Set<string>; levels: Map<string, number>; roleCode: string; roleName: string; source: "owner" | "assigned" | "legacy" }

function allScreensAtLevel(level: Level): Map<string, number> {
  const m = new Map<string, number>()
  for (const sk of allScreenKeys()) m.set(sk, level)
  return m
}

/**
 * Resolution for a tenant user with no active LaundryAccessAssignment.
 *
 * Legacy isolation: BusinessUser.role must NEVER grant access. The tenant is
 * not defaulted to a legacy role nor to the VIEWER system role — they get no
 * screens at all. Roles are assigned exclusively through Roles & Permissions.
 */
export function resolveUnassignedPermissions(): ResolvedPermissions {
  return { isOwner: false, permissions: new Set(), levels: new Map(), roleCode: "UNASSIGNED", roleName: "No Access", source: "legacy" }
}

export async function resolveUserPermissions(platformBusinessId: string, userId: string, businessRole: string | null): Promise<ResolvedPermissions> {
  // Platform identity always has highest priority — no LaundryAccessAssignment
  // may reduce a Platform Super Admin's permissions.
  if (isOwnerRole(businessRole)) {
    // The tenant's owner resolves to the EXISTING Business Owner system role —
    // the same BUSINESS_OWNER shown in Roles & Permissions. No role is created,
    // duplicated, or copied permission-by-permission; the owner simply holds
    // every screen at EDIT, which is what that role already means.
    // Platform staff in support mode keep their own platform label.
    const owner = isBusinessOwnerRole(businessRole)
    const code = owner ? "BUSINESS_OWNER" : (businessRole || "BUSINESS_OWNER")
    const name = owner
      ? "Business Owner"
      : (ROLES[businessRole as keyof typeof ROLES]?.label || businessRole || "Business Owner")
    return { isOwner: true, permissions: new Set(allScreenKeys()), levels: allScreensAtLevel(Level.EDIT), roleCode: code, roleName: name, source: "owner" }
  }

  // ONE assignment decides access. When a user somehow holds more than one
  // active assignment, findFirst returned an arbitrary row — so the same person
  // could resolve to Processing Staff on one request and Store Manager on the
  // next, which is the "second hidden permission list" that makes access look
  // random. The most recently assigned role wins, deterministically: that is
  // the one an administrator last chose for them.
  const assign = await prisma.laundryAccessAssignment.findFirst({
    where: { businessId: platformBusinessId, userId, active: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { role: { include: { permissions: true } } },
  })
  if (assign && assign.role.isActive) {
    if (assign.role.isOwner) return { isOwner: true, permissions: new Set(allScreenKeys()), levels: allScreensAtLevel(Level.EDIT), roleCode: assign.role.code, roleName: assign.role.name, source: "assigned" }
    // A full-access role holds every screen at EDIT — the top level, so every
    // action (view, create, process, approve, assign, delete, override) passes.
    // Resolved from the code, so it is immune to a stored permission list that
    // predates a module. isOwner stays FALSE: this is reach, not ownership.
    if (isFullAccessRoleCode(assign.role.code)) {
      // Everything EXCEPT the owner-only reservations (Hardware Manager is
      // administration of the terminal itself and stays with the owner) — the
      // same list the seeded role uses, so the matrix and the guard agree.
      const keys = fullAccessScreenKeys()
      const levels = new Map<string, number>(keys.map((k) => [k, Level.EDIT as number]))
      return { isOwner: false, permissions: new Set(keys), levels, roleCode: assign.role.code, roleName: assign.role.name, source: "assigned" }
    }
    const levels = new Map<string, number>()
    for (const p of assign.role.permissions) {
      if (p.effect === "DENY") continue
      const mapped = permKeyToScreenLevel(p.permKey)
      const screenKey = mapped?.screenKey || p.permKey
      const lvl = mapped ? mapped.level : (p.level || 1)
      const existing = levels.get(screenKey) || 0
      if (lvl > existing) levels.set(screenKey, lvl)
    }
    return { isOwner: false, permissions: new Set(levels.keys()), levels, roleCode: assign.role.code, roleName: assign.role.name, source: "assigned" }
  }
  return resolveUnassignedPermissions()
}

export function hasPerm(perms: Set<string>, key: string): boolean { return perms.has(key) }

export function screenLevel(levels: Map<string, number>, screenKey: string): number {
  return levels.get(screenKey) ?? 0
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getLaundryAuthContext>>>
export interface GuardOk { ok: true; internal?: boolean; ctx: Ctx; resolved: ResolvedPermissions; platformBusinessId: string }
export interface GuardFail { ok: false; res: NextResponse }

export async function requireLaundryLevel(request: Request, businessIdInput: string | null | undefined, screenKey: string, requiredLevel: Level): Promise<GuardOk | GuardFail> {
  if (!businessIdInput) return { ok: false, res: NextResponse.json({ error: "Missing businessId" }, { status: 400 }) }
  const biz = await resolveLaundryBusiness(businessIdInput)
  if (!biz?.platformBusinessId) return { ok: false, res: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  if (isInternalCall(request)) {
    const ctx = { userId: "system", userName: "system", userEmail: "", laundryBusinessId: biz.id, platformBusinessId: biz.platformBusinessId, role: "LAUNDRY_OWNER", isSupportMode: false } as Ctx
    return { ok: true, internal: true, ctx, resolved: { isOwner: true, permissions: new Set(allScreenKeys()), levels: allScreensAtLevel(Level.EDIT), roleCode: "INTERNAL", roleName: "Internal", source: "owner" }, platformBusinessId: biz.platformBusinessId }
  }
  const ctx = await getLaundryAuthContext(biz.id, request)
  if (!ctx) return { ok: false, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  const resolved = await resolveUserPermissions(biz.platformBusinessId, ctx.userId, ctx.role)
  if (!resolved.isOwner && (resolved.levels.get(screenKey) ?? 0) < requiredLevel) {
    return { ok: false, res: NextResponse.json({ error: "Permission denied", code: "FORBIDDEN", required: screenKey, level: requiredLevel }, { status: 403 }) }
  }
  return { ok: true, ctx, resolved, platformBusinessId: biz.platformBusinessId }
}

/**
 * VIEW/CREATE/EDIT on ANY ONE of several screens.
 *
 * For the handful of endpoints that genuinely serve two screens. Roles &
 * Permissions and Staff both have to read the role list — one to edit roles,
 * the other to fill the "assign a role" dropdown — so requiring a single
 * screen key put one of them permanently out of step with the sidebar:
 * laundry.staff alone meant a Store Manager could read roles they cannot see
 * a menu item for, while laundry.roles alone would have broken their Staff
 * screen.
 *
 * It is the same check as requireLaundryLevel, evaluated against a small set
 * instead of one key — no second mechanism, and never a way to reach a screen
 * that neither key grants.
 */
export async function requireLaundryAnyLevel(request: Request, businessIdInput: string | null | undefined, screenKeys: string[], requiredLevel: Level): Promise<GuardOk | GuardFail> {
  let last: GuardOk | GuardFail | null = null
  for (const key of screenKeys) {
    const g = await requireLaundryLevel(request, businessIdInput, key, requiredLevel)
    if (g.ok) return g
    last = g
    // 401/404/400 are about the caller or the tenant, not the screen — trying
    // another key cannot change them.
    if (g.res.status !== 403) return g
  }
  return last as GuardFail
}

/**
 * Authenticated MEMBER of this laundry business — no screen permission required.
 *
 * For the handful of reads the workspace shell itself needs before anyone has
 * navigated anywhere: the tenant's own name, logo and brand colour. Those are
 * not settings administration, and gating them on laundry.settings.view meant
 * only owners and Super Admin could see their own logo while a Store Manager
 * got a 403 and a blank sidebar.
 *
 * This is NOT a relaxation of RBAC. It runs exactly the same tenant resolution
 * and authentication as requireLaundryLevel — an unauthenticated caller, or a
 * user who does not belong to this business, is still rejected. The only thing
 * omitted is the per-screen level check, because there is no screen involved.
 *
 * Use it only for data every member of the workspace is entitled to see. Any
 * read that is genuinely part of a settings screen keeps requireLaundryLevel.
 */
export async function requireLaundryMember(request: Request, businessIdInput: string | null | undefined): Promise<GuardOk | GuardFail> {
  if (!businessIdInput) return { ok: false, res: NextResponse.json({ error: "Missing businessId" }, { status: 400 }) }
  const biz = await resolveLaundryBusiness(businessIdInput)
  if (!biz?.platformBusinessId) return { ok: false, res: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  if (isInternalCall(request)) {
    const ctx = { userId: "system", userName: "system", userEmail: "", laundryBusinessId: biz.id, platformBusinessId: biz.platformBusinessId, role: "LAUNDRY_OWNER", isSupportMode: false } as Ctx
    return { ok: true, internal: true, ctx, resolved: { isOwner: true, permissions: new Set(allScreenKeys()), levels: allScreensAtLevel(Level.EDIT), roleCode: "INTERNAL", roleName: "Internal", source: "owner" }, platformBusinessId: biz.platformBusinessId }
  }
  // The same authentication every other laundry endpoint uses. It resolves the
  // caller against THIS business, so one tenant cannot read another's brand.
  const ctx = await getLaundryAuthContext(biz.id, request)
  if (!ctx) return { ok: false, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  const resolved = await resolveUserPermissions(biz.platformBusinessId, ctx.userId, ctx.role)
  return { ok: true, ctx, resolved, platformBusinessId: biz.platformBusinessId }
}

/** @deprecated Use requireLaundryLevel(screenKey, Level.*) instead. Only exists for backward compatibility during refactor — remove after all callers migrate. */
export async function requireLaundryPermission(
  request: Request, businessIdInput: string | null | undefined, key: string): Promise<GuardOk | GuardFail> {
  const mapped = permKeyToScreenLevel(key)
  if (mapped) return requireLaundryLevel(request, businessIdInput, mapped.screenKey, mapped.level)
  const parts = key.split(".")
  if (parts.length >= 2) {
    const screenKey = parts.length >= 3 ? parts.slice(0, -1).join(".") : parts.join(".")
    const action = parts[parts.length - 1]
    return requireLaundryLevel(request, businessIdInput, screenKey, actionToLevel(action))
  }
  return requireLaundryLevel(request, businessIdInput, key, Level.VIEW)
}

export async function rbacAudit(businessId: string, action: string, opts: { roleId?: string | null; targetUserId?: string | null; actorName?: string | null; detail?: unknown } = {}) {
  await prisma.laundryAccessAudit.create({ data: { businessId, action, roleId: opts.roleId ?? null, targetUserId: opts.targetUserId ?? null, actorName: opts.actorName ?? null, detail: opts.detail ? JSON.stringify(opts.detail) : "{}" } }).catch(() => {})
}

export async function ensureSystemRolesSeeded(platformBusinessId: string): Promise<void> {
  const count = await prisma.laundryAccessRole.count({ where: { businessId: platformBusinessId } })
  if (count === 0) await seedSystemRoles(platformBusinessId)
}

export async function seedSystemRoles(platformBusinessId: string) {
  const created: string[] = []
  for (const def of SYSTEM_ROLES) {
    const existing = await prisma.laundryAccessRole.findFirst({ where: { businessId: platformBusinessId, code: def.code }, select: { id: true } })
    if (existing) continue
    const role = await prisma.laundryAccessRole.create({ data: { businessId: platformBusinessId, code: def.code, name: def.name, description: def.description, isSystem: true, isOwner: !!def.isOwner, isActive: true } })
    if (!def.isOwner) {
      const screenLevelPairs = [...new Map(def.screens().map((sl) => [sl.screenKey, sl.level]))]
      if (screenLevelPairs.length) await prisma.laundryAccessPermission.createMany({ data: screenLevelPairs.map(([screenKey, level]) => ({ roleId: role.id, permKey: screenKey, level, effect: "ALLOW" })) })
    }
    created.push(def.code)
  }
  return created
}

export interface SystemRoleRepair { code: string; added: string[]; raised: string[] }

/**
 * Bring a tenant's SYSTEM roles back in line with the catalog that defines them.
 *
 * seedSystemRoles() only ever CREATES: a role that already exists is skipped
 * entirely. So a tenant seeded months ago keeps the definitions of that day
 * forever, and every screen added to a system role since then is missing from
 * their copy. That is not theoretical — in production Processing Staff and
 * Processing Manager were both missing Sorting and Transit, and Counter
 * Executive was missing New Order, while the Roles screen faithfully reported
 * the smaller number. The role said 8 screens because the role WAS 8 screens.
 *
 * Deliberately ADDITIVE. It adds a missing screen and raises a level that sits
 * below the definition; it never removes a screen and never lowers a level, so
 * anything an administrator granted on top of the definition survives, and this
 * can never take access away from someone mid-shift. Custom roles are not
 * touched at all — they have no definition to be reconciled against — and the
 * owner role holds no permission rows by design.
 *
 * Removing keys that are no longer registered at all (processing.drying,
 * processing.packing, crm.templates …) is syncLaundryPermissions()' job, and
 * stays there.
 */
export async function reconcileSystemRoles(platformBusinessId: string): Promise<SystemRoleRepair[]> {
  const repairs: SystemRoleRepair[] = []
  for (const def of SYSTEM_ROLES) {
    if (def.isOwner) continue
    const role = await prisma.laundryAccessRole.findFirst({
      where: { businessId: platformBusinessId, code: def.code, isSystem: true },
      select: { id: true, permissions: { select: { id: true, permKey: true, level: true, effect: true } } },
    })
    if (!role) continue

    // The strongest level already held for each screen, however it was stored.
    const held = new Map<string, { id: string; level: number }>()
    for (const p of role.permissions) {
      if (p.effect === "DENY") continue
      const mapped = permKeyToScreenLevel(p.permKey)
      const key = mapped?.screenKey || p.permKey
      const lvl = mapped ? mapped.level : (p.level || 1)
      const cur = held.get(key)
      if (!cur || lvl > cur.level) held.set(key, { id: p.id, level: lvl })
    }

    const wanted = new Map(def.screens().map((sl) => [sl.screenKey, sl.level]))
    const added: string[] = []
    const raised: string[] = []
    for (const [screenKey, level] of wanted) {
      const cur = held.get(screenKey)
      if (!cur) { added.push(screenKey); continue }
      if (cur.level < level) raised.push(screenKey)
    }
    if (added.length) {
      await prisma.laundryAccessPermission.createMany({
        data: added.map((screenKey) => ({ roleId: role.id, permKey: screenKey, level: wanted.get(screenKey)!, effect: "ALLOW" })),
      })
    }
    for (const screenKey of raised) {
      await prisma.laundryAccessPermission.update({ where: { id: held.get(screenKey)!.id }, data: { permKey: screenKey, level: wanted.get(screenKey)! } })
    }
    if (added.length || raised.length) repairs.push({ code: def.code, added, raised })
  }
  return repairs
}
