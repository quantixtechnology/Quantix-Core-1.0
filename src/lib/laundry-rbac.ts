import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { getLaundryAuthContext } from "@/lib/laundry-auth"
import { isPlatformRole } from "@/lib/permissions"
import { allScreenKeys, isValidScreenKey, permKeyToScreenLevel, actionToLevel, screenLabel, Level } from "@/lib/laundry-rbac-registry"
import { SYSTEM_ROLES } from "@/lib/laundry-rbac-catalog"
import { ROLES } from "@/lib/constants"

export { Level }

export const INTERNAL_HEADER = "x-laundry-internal"
export const INTERNAL_TOKEN = process.env.LAUNDRY_INTERNAL_TOKEN || randomBytes(24).toString("hex")
export function isInternalCall(request: Request): boolean {
  if (request.headers.get(INTERNAL_HEADER) === INTERNAL_TOKEN) return true
  return process.env.NODE_ENV !== "production" && process.env.LAUNDRY_RBAC_TEST_BYPASS === "1"
}

const LEGACY_ROLE_MAP: Record<string, string> = {
  LAUNDRY_OWNER: "BUSINESS_OWNER",
  LAUNDRY_STORE_MANAGER: "STORE_MANAGER",
  LAUNDRY_COUNTER_STAFF: "COUNTER_EXECUTIVE",
  LAUNDRY_CASHIER: "COUNTER_EXECUTIVE",
  PROCESSING_MANAGER: "PROCESSING_MANAGER",
  PROCESSING_STAFF: "PROCESSING_STAFF",
  QC_EXECUTIVE: "PROCESSING_STAFF",
  DELIVERY_EXECUTIVE: "DELIVERY_EXECUTIVE",
  LAUNDRY_ACCOUNTANT: "ACCOUNTANT",
}

export function isOwnerRole(businessRole: string | null | undefined): boolean {
  return businessRole === "LAUNDRY_OWNER" || (!!businessRole && isPlatformRole(businessRole))
}

export interface ResolvedPermissions { isOwner: boolean; permissions: Set<string>; levels: Map<string, number>; roleCode: string; roleName: string; source: "owner" | "assigned" | "legacy" }

function allScreensAtLevel(level: Level): Map<string, number> {
  const m = new Map<string, number>()
  for (const sk of allScreenKeys()) m.set(sk, level)
  return m
}

export async function resolveUserPermissions(platformBusinessId: string, userId: string, businessRole: string | null): Promise<ResolvedPermissions> {
  const assign = await prisma.laundryAccessAssignment.findFirst({
    where: { businessId: platformBusinessId, userId, active: true },
    include: { role: { include: { permissions: true } } },
  })
  if (assign && assign.role.isActive) {
    if (assign.role.isOwner) return { isOwner: true, permissions: new Set(allScreenKeys()), levels: allScreensAtLevel(Level.EDIT), roleCode: assign.role.code, roleName: assign.role.name, source: "assigned" }
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
  if (isOwnerRole(businessRole)) {
    const code = businessRole === "LAUNDRY_OWNER" ? "BUSINESS_OWNER" : (businessRole || "BUSINESS_OWNER")
    const name = businessRole === "LAUNDRY_OWNER" ? "Business Owner" : (ROLES[businessRole as keyof typeof ROLES]?.label || businessRole || "Business Owner")
    return { isOwner: true, permissions: new Set(allScreenKeys()), levels: allScreensAtLevel(Level.EDIT), roleCode: code, roleName: name, source: "owner" }
  }
  const code = LEGACY_ROLE_MAP[businessRole || ""] || "VIEWER"
  const def = SYSTEM_ROLES.find((r) => r.code === code)
  const levels = new Map<string, number>()
  if (def) for (const sl of def.screens()) levels.set(sl.screenKey, sl.level)
  return { isOwner: !!def?.isOwner, permissions: new Set(levels.keys()), levels, roleCode: code, roleName: def?.name || "Viewer", source: "legacy" }
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
