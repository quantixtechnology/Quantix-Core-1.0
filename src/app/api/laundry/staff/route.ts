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
import { issueStaffEmployeeId, reconcileStaffEmployeeIds, reconcileStaffLoginIds } from "@/lib/laundry-employee-identity"

export const runtime = "nodejs"

/** Where an employee with no email address is parked. Never shown, never used to sign in. */
const PLACEHOLDER_EMAIL_DOMAIN = "staff.quantix.local"
const isPlaceholderEmail = (e: string | null | undefined) =>
  !!e && e.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)

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
  // The User ID an employee signs in with is their employee id; bring existing
  // rows that still carry an email into line. Idempotent, one read per member.
  await reconcileStaffLoginIds(platformBusinessId).catch(() => 0)

  const [members, assignments, stores, execs, ownerRoles] = await Promise.all([
    prisma.businessUser.findMany({
      where: { businessId: platformBusinessId, role: { not: "CUSTOMER" } },
      include: { user: { select: { id: true, email: true, loginId: true, name: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true } } },
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
      // What the employee actually types to sign in — their employee id once
      // reconciled, the email for the Business Owner who has no employee id.
      loginId: bu.user.loginId || bu.user.email,
      // The staff member's own contact address. Falls back to the account
      // address for memberships created before contactEmail existed; a
      // synthesised account address is storage, not a contact detail, so it
      // shows as nothing rather than as an address nobody can write to.
      email: bu.contactEmail || (isPlaceholderEmail(bu.user.email) ? null : bu.user.email),
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
  const laundryBusinessId = guard.ctx.laundryBusinessId

  // One person may be a Customer AND a member of staff. Those are two separate
  // business relationships, so they get two separate accounts and neither is
  // linked to, merged with, or modified because of the other.
  //
  // An address is a CONTACT detail, not an account identity. It is stored on the
  // membership (BusinessUser.contactEmail — nullable, not unique, exactly like
  // Customer.email), so the same address may appear on a Customer record and on
  // a Staff record at the same time. User.email stays @unique because 19 auth
  // call sites resolve accounts through it; the staff account therefore carries
  // its own internal address and nobody ever signs in with it.
  const email = String(b.email || "").trim().toLowerCase()
  const phone = b.phone ? String(b.phone).trim() : ""
  const name = String(b.name || "").trim()
  if (email && !isEmail(email)) return NextResponse.json({ error: "That email address is not valid" }, { status: 400 })
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  // Resolve the requested Laundry role (must belong to this tenant).
  const role = b.roleId ? await prisma.laundryAccessRole.findFirst({ where: { id: b.roleId, businessId: platformBusinessId }, select: { id: true, name: true, isOwner: true } }) : null
  if (b.roleId && !role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

  // Duplicate STAFF, not duplicate person. This is scoped to existing employees
  // of THIS business and deliberately never consults Customer rows: a customer
  // with the same details is a different relationship, not an existing employee.
  // It exists so a double-submitted form cannot mint two employee ids for one
  // hire — the reason it matches on contact details rather than on the employee
  // id, which the server issues and the form never carries.
  if (email || phone) {
    const clashes = [
      email ? { contactEmail: email } : null,
      phone ? { user: { is: { phone } } } : null,
    ].filter(Boolean) as object[]
    const twin = await prisma.businessUser.findFirst({
      where: { businessId: platformBusinessId, role: { not: "CUSTOMER" }, isActive: true, OR: clashes },
      select: { employeeCode: true, user: { select: { name: true } } },
    })
    if (twin) {
      const who = twin.user?.name ? `${twin.user.name}${twin.employeeCode ? ` (${twin.employeeCode})` : ""}` : twin.employeeCode || "an employee"
      return NextResponse.json({
        error: `${who} is already an employee of this business with those contact details. Edit that employee instead of creating a second record.`,
      }, { status: 409 })
    }
  }

  // A password the administrator TYPED is the password. Only one they did not
  // supply is a temporary one, and only a temporary one forces a change at
  // first login — setting a specific password and then demanding it be changed
  // is why a manually-entered password looked like it had been ignored.
  // `forceChange` lets the caller override either way; same contract as the
  // delivery-executive reset.
  const mode = String(b.password || "").trim() ? "MANUAL" : "RANDOM"
  const rawPassword = String(b.password || "").trim() || genPassword()
  if (rawPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  const mustChangePassword = b.forceChange !== undefined ? !!b.forceChange : mode === "RANDOM"
  const passwordHash = await hashPassword(rawPassword)

  // The Business Owner is the business, not an employee of it, and the existing
  // staff surface already treats that row differently — so no EMP number is
  // consumed for them. Everyone else gets one, issued by the shared platform
  // counter and never typed by an administrator.
  //
  // Issued BEFORE the User row because it IS the User ID: staff sign in with
  // V8EMP001, not with an email.
  const employeeCode = role?.isOwner ? null : await issueStaffEmployeeId(platformBusinessId, laundryBusinessId)

  // The ACCOUNT address. User.email is required and @unique, so it cannot hold a
  // contact address that someone else already carries — a customer, typically,
  // who is the same human. The staff account therefore gets its own internal
  // address whenever the real one is taken or absent, synthesised the way a
  // delivery executive's already is. It is never shown and never signed in with;
  // the real address lives on the membership as contactEmail.
  //
  // The Business Owner has no employee id to build one from and still signs in
  // by email, so theirs must be a real, free address.
  const emailFree = email ? !(await prisma.user.findUnique({ where: { email }, select: { id: true } })) : false
  const accountEmail = (emailFree ? email : "") || (employeeCode
    ? `staff.${employeeCode.toLowerCase()}.${Math.random().toString(36).slice(2, 8)}@${PLACEHOLDER_EMAIL_DOMAIN}`
    : "")
  if (!accountEmail) {
    return NextResponse.json({ error: `${email} is already in use, and the Business Owner signs in by email. Use a different address.` }, { status: 409 })
  }
  const loginId = employeeCode ?? accountEmail

  const user = await prisma.user.create({
    data: {
      email: accountEmail, loginId, name, phone: phone || null,
      passwordHash, authProvider: "PASSWORD", isActive: true, hasPassword: true,
      mustChangePassword, emailVerified: true, createdBy: guard.ctx.userId,
    },
  })
  await prisma.businessUser.create({
    data: {
      userId: user.id, businessId: platformBusinessId, employeeCode,
      // The address the administrator typed, kept whether or not the account
      // address could be the same one.
      contactEmail: email || null,
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
  await rbacAudit(platformBusinessId, "EMPLOYEE_CREATED", { targetUserId: user.id, roleId: role?.id ?? null, actorName: guard.ctx.userName, detail: { email: email || null, employeeCode, role: role?.name ?? null } })

  return NextResponse.json({
    success: true,
    data: { userId: user.id, loginId, email: email || null, employeeCode, tempPassword: rawPassword, mode, mustChangePassword },
  }, { status: 201 })
}
