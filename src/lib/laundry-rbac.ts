// ============================================================================
// Laundry OS — RBAC resolution + enforcement.
//
// Resolves the effective permission set for a user and enforces it on APIs.
// The Business Owner always has full, unremovable access. Non-owners get the
// permissions of their assigned role (ALLOW minus DENY). Users with no explicit
// assignment fall back to a default system role mapped from their legacy
// BusinessUser role, so the platform keeps working during rollout.
//
// This module never touches the frozen engines or the platform auth — it only
// reads/enforces the Laundry RBAC matrix.
// ============================================================================
import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { getLaundryAuthContext } from "@/lib/laundry-auth"
import { isPlatformRole } from "@/lib/permissions"
import { allPermissionKeys, SYSTEM_ROLES } from "@/lib/laundry-rbac-catalog"

// Internal trusted-call bypass. In-process callers that have ALREADY performed
// their own authorization — the customer-app order delegation, server tasks and
// the test harness — set this header so they skip the staff-session RBAC check
// (they are not staff sessions). The token is process-only (random per boot,
// never sent to any client), so an external HTTP client cannot forge it.
export const INTERNAL_HEADER = "x-laundry-internal"
export const INTERNAL_TOKEN = process.env.LAUNDRY_INTERNAL_TOKEN || randomBytes(24).toString("hex")
export function isInternalCall(request: Request): boolean {
  // Trusted in-process caller (customer-app delegation, server tasks) — OR the
  // test harness, but ONLY outside production (NODE_ENV=production can never
  // trigger the test bypass, so deployed prod always enforces).
  if (request.headers.get(INTERNAL_HEADER) === INTERNAL_TOKEN) return true
  return process.env.NODE_ENV !== "production" && process.env.LAUNDRY_RBAC_TEST_BYPASS === "1"
}

// Legacy BusinessUser.role → default system role code (used when a user has no
// explicit Laundry RBAC assignment yet).
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

export interface ResolvedPermissions { isOwner: boolean; permissions: Set<string>; roleCode: string; roleName: string; source: "owner" | "assigned" | "legacy" }

// The user's effective permission set for a tenant. platformBusinessId scopes
// the RBAC data; businessRole is the legacy BusinessUser role.
export async function resolveUserPermissions(platformBusinessId: string, userId: string, businessRole: string | null): Promise<ResolvedPermissions> {
  if (isOwnerRole(businessRole)) {
    return { isOwner: true, permissions: new Set(allPermissionKeys()), roleCode: "BUSINESS_OWNER", roleName: "Business Owner", source: "owner" }
  }
  const assign = await prisma.laundryAccessAssignment.findFirst({
    where: { businessId: platformBusinessId, userId, active: true },
    include: { role: { include: { permissions: true } } },
  })
  if (assign && assign.role.isActive) {
    if (assign.role.isOwner) return { isOwner: true, permissions: new Set(allPermissionKeys()), roleCode: assign.role.code, roleName: assign.role.name, source: "assigned" }
    const allow = new Set<string>()
    const deny = new Set<string>()
    for (const p of assign.role.permissions) (p.effect === "DENY" ? deny : allow).add(p.permKey)
    for (const d of deny) allow.delete(d)
    return { isOwner: false, permissions: allow, roleCode: assign.role.code, roleName: assign.role.name, source: "assigned" }
  }
  // Legacy fallback (no explicit assignment).
  const code = LEGACY_ROLE_MAP[businessRole || ""] || "VIEWER"
  const def = SYSTEM_ROLES.find((r) => r.code === code)
  return { isOwner: !!def?.isOwner, permissions: new Set(def ? def.perms() : []), roleCode: code, roleName: def?.name || "Viewer", source: "legacy" }
}

export function hasPerm(perms: Set<string>, key: string): boolean { return perms.has(key) }

// API guard. Resolves the caller, then enforces `key`. On failure returns a
// ready-to-send Response (401/403/404); on success returns the context.
type Ctx = NonNullable<Awaited<ReturnType<typeof getLaundryAuthContext>>>
export interface GuardOk { ok: true; internal?: boolean; ctx: Ctx; resolved: ResolvedPermissions; platformBusinessId: string }
export interface GuardFail { ok: false; res: NextResponse }

// Enforce `key` for the caller. Returns a ready-to-send 400/401/403/404 on
// failure, or the resolved context on success. Trusted internal calls (see
// isInternalCall) bypass the staff-session check with full access.
export async function requireLaundryPermission(request: Request, businessIdInput: string | null | undefined, key: string): Promise<GuardOk | GuardFail> {
  if (!businessIdInput) return { ok: false, res: NextResponse.json({ error: "Missing businessId" }, { status: 400 }) }
  const biz = await resolveLaundryBusiness(businessIdInput)
  if (!biz?.platformBusinessId) return { ok: false, res: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  if (isInternalCall(request)) {
    const ctx = { userId: "system", userName: "system", userEmail: "", laundryBusinessId: biz.id, platformBusinessId: biz.platformBusinessId, role: "LAUNDRY_OWNER", isSupportMode: false } as Ctx
    return { ok: true, internal: true, ctx, resolved: { isOwner: true, permissions: new Set(allPermissionKeys()), roleCode: "INTERNAL", roleName: "Internal", source: "owner" }, platformBusinessId: biz.platformBusinessId }
  }
  const ctx = await getLaundryAuthContext(biz.id, request)
  if (!ctx) return { ok: false, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  const resolved = await resolveUserPermissions(biz.platformBusinessId, ctx.userId, ctx.role)
  if (!resolved.isOwner && !resolved.permissions.has(key)) {
    return { ok: false, res: NextResponse.json({ error: "Permission denied", code: "FORBIDDEN", required: key }, { status: 403 }) }
  }
  return { ok: true, ctx, resolved, platformBusinessId: biz.platformBusinessId }
}

// Append-only RBAC audit entry.
export async function rbacAudit(businessId: string, action: string, opts: { roleId?: string | null; targetUserId?: string | null; actorName?: string | null; detail?: unknown } = {}) {
  await prisma.laundryAccessAudit.create({ data: { businessId, action, roleId: opts.roleId ?? null, targetUserId: opts.targetUserId ?? null, actorName: opts.actorName ?? null, detail: opts.detail ? JSON.stringify(opts.detail) : "{}" } }).catch(() => {})
}

// Ensure every Laundry business has its 10 default system roles without any
// manual step. Cheap count-gate so the common (already-seeded) path is a single
// query; seeds only when the tenant has none yet. Safe to call on every load.
export async function ensureSystemRolesSeeded(platformBusinessId: string): Promise<void> {
  const count = await prisma.laundryAccessRole.count({ where: { businessId: platformBusinessId } })
  if (count === 0) await seedSystemRoles(platformBusinessId)
}

// Idempotently create the 10 default system roles (+ their permissions) for a
// tenant. Safe to call repeatedly — existing roles are left untouched.
export async function seedSystemRoles(platformBusinessId: string) {
  const created: string[] = []
  for (const def of SYSTEM_ROLES) {
    const existing = await prisma.laundryAccessRole.findFirst({ where: { businessId: platformBusinessId, code: def.code }, select: { id: true } })
    if (existing) continue
    const role = await prisma.laundryAccessRole.create({ data: { businessId: platformBusinessId, code: def.code, name: def.name, description: def.description, isSystem: true, isOwner: !!def.isOwner, isActive: true } })
    // The owner role's full access is implicit (isOwner) — no rows needed; other
    // roles get their catalog-derived ALLOW rows.
    if (!def.isOwner) {
      const perms = [...new Set(def.perms())]
      if (perms.length) await prisma.laundryAccessPermission.createMany({ data: perms.map((permKey) => ({ roleId: role.id, permKey, effect: "ALLOW" })) })
    }
    created.push(def.code)
  }
  return created
}
