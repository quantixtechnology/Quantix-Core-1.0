// POST /api/laundry/executive/auth/login — Delivery Executive login
// (mobile number OR employee code + password). Validates: executive exists, ACTIVE, has an assigned store, and a
// linked auth User. Mints a platform access token (RefreshToken store — same
// session system as everywhere else). No self-registration; accounts are made by
// Admin. Only active Delivery Executives can log in.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, createAccessToken } from "@/lib/password-utils"
import { resolveExecutiveTenant } from "@/lib/laundry-executive-tenant"

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

    // Active executives matching the identifier (mobile OR employee code) with
    // a linked login account. Employee codes are matched case-insensitively
    // because they are typed by hand on a phone.
    const execs = await prisma.laundryDeliveryExecutive.findMany({
      where: {
        isActive: true, userId: { not: null },
        OR: [{ mobile: identifier }, { employeeCode: identifier }, { employeeCode: identifier.toUpperCase() }],
        ...(tenant ? { businessId: tenant.laundryBusinessId } : {}),
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
        },
      },
    })
  } catch (e) {
    console.error("[executive-login] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
