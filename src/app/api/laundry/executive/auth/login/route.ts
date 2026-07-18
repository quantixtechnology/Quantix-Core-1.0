// POST /api/laundry/executive/auth/login — Delivery Executive login (mobile +
// password). Validates: executive exists, ACTIVE, has an assigned store, and a
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
    const mobile = String(b.mobile || "").trim()
    const password = String(b.password || "")
    if (!mobile || !password) return NextResponse.json({ error: "Mobile and password are required" }, { status: 400 })

    // The tenant is inferred from the host (white-label deployment). When it
    // resolves, scope the lookup to that business so mobile is per-tenant.
    const tenant = await resolveExecutiveTenant(request).catch(() => null)

    // Active executives with this mobile + a linked login account.
    const execs = await prisma.laundryDeliveryExecutive.findMany({
      where: { mobile, isActive: true, userId: { not: null }, ...(tenant ? { businessId: tenant.laundryBusinessId } : {}) },
      include: { store: { select: { storeName: true } } },
    })
    if (execs.length === 0) return NextResponse.json({ error: "No active delivery executive found for this mobile" }, { status: 401 })

    // Match the executive whose linked User password verifies.
    let matched: (typeof execs)[number] | null = null
    for (const e of execs) {
      const user = e.userId ? await prisma.user.findUnique({ where: { id: e.userId }, select: { passwordHash: true, isActive: true } }) : null
      if (user?.passwordHash && user.isActive && (await verifyPassword(password, user.passwordHash))) { matched = e; break }
    }
    if (!matched) return NextResponse.json({ error: "Incorrect mobile or password" }, { status: 401 })
    if (!matched.storeId) return NextResponse.json({ error: "No store assigned. Contact your admin." }, { status: 403 })

    // Mint a 24h access token in the shared session store + record last login.
    const token = createAccessToken()
    const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24)
    await prisma.refreshToken.create({ data: { userId: matched.userId!, token, expiresAt } })
    await prisma.user.update({ where: { id: matched.userId! }, data: { lastLoginAt: new Date() } }).catch(() => {})

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
