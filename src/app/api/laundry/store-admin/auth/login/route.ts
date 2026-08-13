// POST /api/laundry/store-admin/auth/login — Store Admin login (email + password).
// Only a User with an ACTIVE store-operational RBAC role scoped to one Store may
// sign in. Mints a platform access token (RefreshToken store — same session
// system as everywhere else). No self-registration; accounts are created by Admin.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, createAccessToken } from "@/lib/password-utils"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { STORE_ADMIN_ROLES, isCrossTenantRole } from "@/lib/laundry-store-admin-auth"
import { resolveImageUrl } from "@/lib/image-url"
import { sessionMatchesHostTenant, TENANT_MISMATCH_MESSAGE } from "@/lib/pwa-tenant-boundary"


async function mintToken(userId: string) {
  const token = createAccessToken()
  const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24)
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } })
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => {})
  return token
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const email = String(b.email || "").trim().toLowerCase()
    const password = String(b.password || "")
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 })

    const user = await prisma.user.findFirst({ where: { email }, select: { id: true, name: true, passwordHash: true, isActive: true, platformRole: true } })
    if (!user?.passwordHash || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 })
    }

    // Platform administrators — unrestricted access to every store, any time
    // (mirrors their desktop access). They pick the store in the app.
    //
    // Deliberately CROSS_TENANT_ROLES and not isPlatformRole(): the latter is
    // true for thirteen roles, so a sales or support account signing in here
    // was handed every business in the platform.
    if (isCrossTenantRole(user.platformRole)) {
      const token = await mintToken(user.id)
      return NextResponse.json({ success: true, data: { token, staff: { name: user.name, isSuperAdmin: true, roleName: "Super Admin" } } })
    }

    // Must hold an active store-operational role. The assignment either names a
    // store or covers the business; the narrower grant wins when both exist.
    const assignments = await prisma.laundryAccessAssignment.findMany({
      where: { userId: user.id, active: true },
      include: { role: { select: { code: true, name: true, isActive: true } } },
    })
    const usable = assignments.filter((a) => a.role.isActive && STORE_ADMIN_ROLES.has(a.role.code))
    const assign = usable.find((a) => a.storeId) ?? usable[0]
    // Only store-operational staff may enter. Super Admins, Business Owners and
    // every other role are rejected with a clear redirect — never auto-converted
    // into a store account.
    if (!assign) {
      return NextResponse.json({ error: "This application is for Store Staff only. Please log in to the Admin Dashboard.", code: "NOT_STORE_STAFF" }, { status: 403 })
    }

    const biz = await resolveLaundryBusiness(assign.businessId)
    if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 })

    // The host is the tenant boundary, and it applies at LOGIN — otherwise a
    // Business A store admin gets a valid token on store.<B> and only discovers
    // it when every subsequent call 401s. Platform administrators returned
    // above and are unaffected. On a host that names no tenant (localhost,
    // laundry.<base>) nothing is constrained, exactly as before.
    if (!(await sessionMatchesHostTenant(request, assign.businessId))) {
      return NextResponse.json({ error: TENANT_MISMATCH_MESSAGE }, { status: 403 })
    }
    // Business-wide assignment: no fixed store, so the app opens on a picker
    // showing THIS business's stores only.
    const store = assign.storeId
      ? await prisma.laundryStore.findFirst({ where: { id: assign.storeId, laundryBusinessId: biz.id, isActive: true }, select: { id: true, storeName: true, storeCode: true } })
      : null
    if (assign.storeId && !store) return NextResponse.json({ error: "Your assigned store is inactive. Contact your admin." }, { status: 403 })

    const token = createAccessToken()
    const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24)
    await prisma.refreshToken.create({ data: { userId: user.id, token, expiresAt } })
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})

    const business = biz.platformBusinessId ? await prisma.business.findUnique({ where: { id: biz.platformBusinessId }, select: { name: true, logo: true } }) : null

    return NextResponse.json({
      success: true,
      data: {
        token,
        staff: {
          name: user.name, businessId: biz.id,
          businessName: business?.name ?? null, businessLogo: business?.logo ? resolveImageUrl(business.logo) : null,
          roleCode: assign.role.code, roleName: assign.role.name,
          // Null for a business-wide manager — the client then calls /me and
          // shows this business's store picker.
          storeId: store?.id ?? null, storeName: store?.storeName ?? null, storeCode: store?.storeCode ?? null,
        },
      },
    })
  } catch (e) {
    console.error("[store-admin-login] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
