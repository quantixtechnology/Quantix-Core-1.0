// POST /api/laundry/executive/auth/login — Delivery Executive login
// (mobile number OR employee code + password). Validates: executive exists, ACTIVE, has an assigned store, and a
// linked auth User. Mints a platform access token (RefreshToken store — same
// session system as everywhere else). No self-registration; accounts are made by
// Admin. Only active Delivery Executives can log in.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, createAccessToken } from "@/lib/password-utils"
import { resolveExecutiveTenant } from "@/lib/laundry-executive-tenant"
import { classifyHostTenant, TENANT_MISMATCH_MESSAGE } from "@/lib/pwa-tenant-boundary"
import { parseEmployeeId } from "@/lib/tenant-identity"
import { resolveTenantByEmployeeId } from "@/lib/tenant-identity-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    // Executives identify themselves by the two things they actually know:
    // their mobile number or their employee code. `mobile` is still accepted so
    // an older app build keeps working.
    const identifier = String(b.identifier || b.mobile || "").trim()
    const password = String(b.password || "")
    if (!identifier || !password) {
      return NextResponse.json({ error: "Mobile number or employee code and password are required" }, { status: 400 })
    }

    // The tenant is inferred from the host (white-label deployment). When it
    // resolves, scope the lookup to that business so mobile is per-tenant.
    const tenant = await resolveExecutiveTenant(request).catch(() => null)

    // A delivery.<something> host is addressing ONE tenant. If it names a tenant
    // we cannot serve — an unregistered hostname, or a business that has no
    // laundry — we must not fall through to an UNSCOPED lookup that would let an
    // executive of any other business sign in here. Only a host that names no
    // tenant (localhost, laundry.<base>) keeps the unscoped behaviour.
    if (!tenant) {
      const kind = await classifyHostTenant(request)
      if (kind.kind !== "non-tenant") {
        return NextResponse.json({ error: TENANT_MISMATCH_MESSAGE }, { status: 403 })
      }
    }

    // ── Tenant from the IDENTIFIER, on a host that names no tenant ──────────
    //
    // laundry.<base> is shared by every tenant, so the host cannot say who is
    // signing in. Until employee ids carried a tenant prefix, the query below
    // ran UNSCOPED and picked whichever executive's password happened to
    // verify: two tenants with EXE001 and the same password meant an executive
    // of business A could be signed in as the executive of business B, and a
    // wrong password incremented failedAttempts on both.
    //
    // A prefixed id (8T5DL001) names its tenant before any password is read.
    // The prefix is resolved first, and the lookup is scoped to that business.
    let identityBusinessId: string | null = null
    const parsedId = parseEmployeeId(identifier)
    if (parsedId) {
      const identity = await resolveTenantByEmployeeId(identifier).catch(() => null)
      // A well-formed id whose prefix belongs to no tenant is not a reason to
      // fall back to an unscoped search — that is the exact hole being closed.
      if (!identity) {
        return NextResponse.json({ error: "No active delivery executive found for this mobile number or employee code" }, { status: 401 })
      }
      const lb = await prisma.laundryBusiness.findFirst({
        where: { platformBusinessId: identity.businessId },
        select: { id: true },
      })
      if (!lb) {
        return NextResponse.json({ error: "No active delivery executive found for this mobile number or employee code" }, { status: 401 })
      }
      // If the host ALSO names a tenant, the two must agree. Disagreement is an
      // attempt to sign into one tenant from another tenant's app.
      if (tenant && tenant.laundryBusinessId !== lb.id) {
        return NextResponse.json({ error: TENANT_MISMATCH_MESSAGE }, { status: 403 })
      }
      identityBusinessId = lb.id
    }

    // Active executives matching the identifier (mobile OR employee code) with
    // a linked login account. Employee codes are matched case-insensitively
    // because they are typed by hand on a phone.
    const execs = await prisma.laundryDeliveryExecutive.findMany({
      where: {
        isActive: true, userId: { not: null },
        OR: [{ mobile: identifier }, { employeeCode: identifier }, { employeeCode: identifier.toUpperCase() }],
        // Identity prefix wins when present (it is exact); host scoping is the
        // fallback. One of the two is always applied unless the identifier is a
        // bare mobile number on a shared host.
        ...(identityBusinessId ? { businessId: identityBusinessId } : tenant ? { businessId: tenant.laundryBusinessId } : {}),
      },
      include: { store: { select: { storeName: true } } },
    })
    if (execs.length === 0) {
      return NextResponse.json({ error: "No active delivery executive found for this mobile number or employee code" }, { status: 401 })
    }
    const now = new Date()

    // Match the executive whose linked User password verifies.
    let matched: (typeof execs)[number] | null = null
    for (const e of execs) {
      const user = e.userId ? await prisma.user.findUnique({ where: { id: e.userId }, select: { passwordHash: true, isActive: true } }) : null
      if (user?.passwordHash && user.isActive && (await verifyPassword(password, user.passwordHash))) { matched = e; break }
    }

    if (!matched) {
      // Wrong password → count the failed attempt and auto-lock at 5 (15 min).
      for (const e of execs) {
        const attempts = (e.failedAttempts || 0) + 1
        await prisma.laundryDeliveryExecutive.update({ where: { id: e.id }, data: { failedAttempts: attempts, ...(attempts >= 5 ? { lockedUntil: new Date(now.getTime() + 15 * 60 * 1000) } : {}) } }).catch(() => {})
      }
      return NextResponse.json({ error: "Incorrect login or password" }, { status: 401 })
    }
    // Locked accounts cannot log in even with the right password.
    if (matched.isLocked) return NextResponse.json({ error: "Your account is locked. Contact your admin." }, { status: 403 })
    if (matched.lockedUntil && matched.lockedUntil > now) return NextResponse.json({ error: "Too many attempts. Try again later or contact your admin." }, { status: 403 })
    if (!matched.storeId) return NextResponse.json({ error: "No store assigned. Contact your admin." }, { status: 403 })

    // Capture device + IP for the admin's login-attempt view.
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || null
    const device = (request.headers.get("user-agent") || "").slice(0, 180) || null

    // Mint a 24h access token in the shared session store + record last login.
    const token = createAccessToken()
    const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24)
    await prisma.refreshToken.create({ data: { userId: matched.userId!, token, expiresAt } })
    await prisma.user.update({ where: { id: matched.userId! }, data: { lastLoginAt: now } }).catch(() => {})
    await prisma.laundryDeliveryExecutive.update({ where: { id: matched.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginIp: ip, lastLoginDevice: device } }).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        token,
        executive: {
          id: matched.id, name: matched.name, employeeCode: matched.employeeCode, mobile: matched.mobile,
          storeId: matched.storeId, storeName: matched.store?.storeName ?? null,
          vehicleType: matched.vehicleType, vehicleNumber: matched.vehicleNumber, photo: matched.photo,
          availability: matched.availability,
          // Assignment permission — see /me. Rendering only; the respond
          // endpoint enforces it server-side on every reject.
          canReject: matched.canReject,
        },
      },
    })
  } catch (e) {
    console.error("[executive-login] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
