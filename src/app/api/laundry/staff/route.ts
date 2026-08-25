// Laundry OS — Staff (Employee) management. Tenant-facing, guarded by Laundry
// RBAC (laundry.staff.*). Operates on the SHARED User / BusinessUser models and
// the Laundry RBAC assignment (LaundryAccessAssignment) — no parallel models.
// This is the Business Owner's employee surface; the core platform-admin
// business-users endpoints are Quantix-Core-RBAC gated and untouched.
//
// GET  /api/laundry/staff?businessId=  — employee list (role, store, status, last login)
// POST /api/laundry/staff              — create employee (+ optional role/store), returns temp password
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission, rbacAudit, isBusinessOwnerRole } from "@/lib/laundry-rbac"
import { hashPassword } from "@/lib/password-utils"
import { issueStaffEmployeeId, reconcileStaffEmployeeIds } from "@/lib/laundry-employee-identity"

export const runtime = "nodejs"

// New laundry employees carry a generic laundry BusinessUser role so
// getLaundryAuthContext resolves them; their real permissions come from the
// assigned Laundry RBAC role (authoritative). Owners get LAUNDRY_OWNER so they
// always keep full access even via the legacy fallback.
const BASE_EMPLOYEE_ROLE = "STORE_EXECUTIVE"
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const genPassword = () => `Laundry@${Math.random().toString(36).slice(2, 7).toUpperCase()}`

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
  if (!guard.ok) return guard.res
  const platformBusinessId = guard.platformBusinessId
  const laundryBusinessId = guard.ctx.laundryBusinessId
  // Runtime reconciliation, same philosophy as the navigation/CRM defaults:
  // idempotent, tenant-independent, non-destructive, nothing to configure.
  await reconcileStaffEmployeeIds(platformBusinessId, laundryBusinessId).catch(() => 0)

  const [members, assignments, stores, execs, ownerRoles] = await Promise.all([
    prisma.businessUser.findMany({
      where: { businessId: platformBusinessId, role: { not: "CUSTOMER" } },
      include: { user: { select: { id: true, email: true, name: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.laundryAccessAssignment.findMany({ where: { businessId: platformBusinessId }, include: { role: { select: { id: true, code: true, name: true, isOwner: true } } } }),
    prisma.laundryStore.findMany({ where: { laundryBusinessId }, select: { id: true, storeName: true } }),
    // The delivery workforce, so they can be kept out of the office-staff list.
    prisma.laundryDeliveryExecutive.findMany({
      where: { businessId: laundryBusinessId, userId: { not: null } },
      select: { userId: true },
    }),
    // The existing Business Owner system role, so the owner row names the same
    // role Roles & Permissions shows rather than a hardcoded string.
    prisma.laundryAccessRole.findMany({
      where: { businessId: platformBusinessId, isOwner: true, isActive: true },
      select: { id: true, name: true, isOwner: true },
      take: 1,
    }),
  ])
  const aByUser = new Map(assignments.map((a) => [a.userId, a]))
  const storeName = new Map(stores.map((s) => [s.id, s.storeName]))
  const execUserIds = new Set(execs.map((e) => e.userId).filter(Boolean) as string[])

  // This list is built from BusinessUser — every person who belongs to the
  // business, not a dedicated Staff table. Creating a Delivery Executive
  // provisions a login and therefore a BusinessUser row, so executives were
  // showing up here as if they were office staff.
  //
  // A delivery executive is filtered out UNLESS an administrator has also given
  // them a laundry role (a LaundryAccessAssignment). That is the deliberate
  // "this person is both" case, and it stays visible.
  //
  // Filtering rather than deleting the BusinessUser row: that row is the
  // person's membership of the business, nothing distinguishes an
  // auto-provisioned one from an admin-created one with certainty, and removing
  // it destroys data to fix a display problem. Executives never read it —
  // their session resolves via RefreshToken -> LaundryDeliveryExecutive.
  // The Business Owner's role is not an assignment — it comes from the
  // owner relationship on BusinessUser (CLIENT_OWNER / LAUNDRY_OWNER), which is
  // exactly how resolveUserPermissions grants them full access. Reading the
  // role name from the assignment alone is what printed "—" against the owner:
  // they have every permission and no LaundryAccessAssignment row.
  const ownerSystemRole = ownerRoles.find((r) => r.isOwner) ?? null

  const data = members.filter((bu) => !execUserIds.has(bu.userId) || aByUser.has(bu.userId)).map((bu) => {
    const a = aByUser.get(bu.userId)
    const owner = a?.role.isOwner ?? isBusinessOwnerRole(bu.role)
    return {
      userId: bu.userId,
      businessUserId: bu.id,
      // Null for the Business Owner by design — see §5. The UI shows
      // "Not required" rather than an empty cell.
      employeeCode: bu.employeeCode,
      email: bu.user.email,
      name: bu.user.name,
      phone: bu.user.phone,
      active: bu.isActive && bu.user.isActive,
      lastLoginAt: bu.user.lastLoginAt,
      createdAt: bu.user.createdAt,
      roleId: a?.roleId ?? (owner ? ownerSystemRole?.id ?? null : null),
      roleCode: a?.role.code ?? (owner ? "BUSINESS_OWNER" : null),
      // Falls back to the literal name only if the system role has not been
      // seeded yet — the owner is still shown as the owner either way.
      roleName: a?.role.name ?? (owner ? ownerSystemRole?.name ?? "Business Owner" : null),
      isOwner: owner,
      storeId: a?.storeId ?? null,
      storeName: a?.storeId ? storeName.get(a.storeId) ?? null : null,
    }
  })
  return NextResponse.json({ success: true, data, stores })
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff.create")
  if (!guard.ok) return guard.res
  const platformBusinessId = guard.platformBusinessId

  const email = String(b.email || "").trim().toLowerCase()
  const name = String(b.name || "").trim()
  if (!isEmail(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  // Resolve the requested Laundry role (must belong to this tenant).
  const role = b.roleId ? await prisma.laundryAccessRole.findFirst({ where: { id: b.roleId, businessId: platformBusinessId }, select: { id: true, name: true, isOwner: true } }) : null
  if (b.roleId && !role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

  // Email must be unique platform-wide.
  const existing = await prisma.user.findFirst({ where: { email }, select: { id: true } })
  if (existing) return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 })

  const rawPassword = String(b.password || "").trim() || genPassword()
  if (rawPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  const passwordHash = await hashPassword(rawPassword)

  const user = await prisma.user.create({
    data: {
      email, loginId: email, name, phone: b.phone ? String(b.phone).trim() : null,
      passwordHash, authProvider: "PASSWORD", isActive: true, hasPassword: true,
      mustChangePassword: true, emailVerified: true, createdBy: guard.ctx.userId,
    },
  })
  // The Business Owner is the business, not an employee of it, and the existing
  // staff surface already treats that row differently — so no EMP number is
  // consumed for them. Everyone else gets one, issued by the shared platform
  // counter and never typed by an administrator.
  const employeeCode = role?.isOwner ? null : await issueStaffEmployeeId(platformBusinessId)
  await prisma.businessUser.create({
    data: {
      userId: user.id, businessId: platformBusinessId, employeeCode,
      role: role?.isOwner ? "LAUNDRY_OWNER" : BASE_EMPLOYEE_ROLE,
      storeId: null, isActive: true, invitedAt: new Date(), acceptedAt: new Date(),
    },
  })
  if (role) {
    await prisma.laundryAccessAssignment.upsert({
      where: { businessId_userId: { businessId: platformBusinessId, userId: user.id } },
      create: { businessId: platformBusinessId, userId: user.id, roleId: role.id, storeId: b.storeId || null, active: true, assignedBy: guard.ctx.userName },
      update: { roleId: role.id, storeId: b.storeId || null, active: true },
    })
  }
  await rbacAudit(platformBusinessId, "EMPLOYEE_CREATED", { targetUserId: user.id, roleId: role?.id ?? null, actorName: guard.ctx.userName, detail: { email, role: role?.name ?? null } })

  return NextResponse.json({ success: true, data: { userId: user.id, email, employeeCode, tempPassword: rawPassword } }, { status: 201 })
}
