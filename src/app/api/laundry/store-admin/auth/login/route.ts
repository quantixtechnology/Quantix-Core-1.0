// POST /api/laundry/store-admin/auth/login — Store Admin login (email + password).
// Only a User with an ACTIVE store-operational RBAC role scoped to one Store may
// sign in. Mints a platform access token (RefreshToken store — same session
// system as everywhere else). No self-registration; accounts are created by Admin.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, createAccessToken } from "@/lib/password-utils"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { STORE_ADMIN_ROLES } from "@/lib/laundry-store-admin-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const email = String(b.email || "").trim().toLowerCase()
    const password = String(b.password || "")
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 })

    const user = await prisma.user.findFirst({ where: { email }, select: { id: true, name: true, passwordHash: true, isActive: true } })
    if (!user?.passwordHash || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 })
    }

    // Must hold an active store-operational role bound to a store.
    const assign = await prisma.laundryAccessAssignment.findFirst({
      where: { userId: user.id, active: true, storeId: { not: null } },
      include: { role: { select: { code: true, name: true, isActive: true } } },
    })
    // Only store-operational staff bound to a store may enter. Super Admins,
    // Business Owners and every other role are rejected with a clear redirect —
    // never auto-converted into a store account.
    if (!assign?.storeId || !assign.role.isActive || !STORE_ADMIN_ROLES.has(assign.role.code)) {
      return NextResponse.json({ error: "This application is for Store Staff only. Please log in to the Admin Dashboard.", code: "NOT_STORE_STAFF" }, { status: 403 })
    }

    const biz = await resolveLaundryBusiness(assign.businessId)
    if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 })
    const store = await prisma.laundryStore.findFirst({ where: { id: assign.storeId, laundryBusinessId: biz.id, isActive: true }, select: { id: true, storeName: true, storeCode: true } })
    if (!store) return NextResponse.json({ error: "Your assigned store is inactive. Contact your admin." }, { status: 403 })

    const token = createAccessToken()
    const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24)
    await prisma.refreshToken.create({ data: { userId: user.id, token, expiresAt } })
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        token,
        staff: { name: user.name, businessId: biz.id, roleCode: assign.role.code, roleName: assign.role.name, storeId: store.id, storeName: store.storeName, storeCode: store.storeCode },
      },
    })
  } catch (e) {
    console.error("[store-admin-login] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
