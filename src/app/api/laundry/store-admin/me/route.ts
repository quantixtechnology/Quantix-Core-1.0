// GET /api/laundry/store-admin/me — resolve the current session.
//   • Store staff → their fixed store + business branding.
//   • Super Admin → the full list of businesses + stores to pick from (unrestricted).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStoreAdmin } from "@/lib/laundry-store-admin-auth"
import { resolveImageUrl } from "@/lib/image-url"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const g = await requireStoreAdmin(request)
  if (!g.ok) return g.res
  const s = g.session

  if (s.isSuperAdmin) {
    const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } })
    // Every laundry business + its stores — the Super Admin picks any store.
    const lbs = await prisma.laundryBusiness.findMany({
      where: { platformBusinessId: { not: null } },
      select: { id: true, businessName: true, platformBusinessId: true, stores: { where: { isActive: true }, select: { id: true, storeName: true, storeCode: true } } },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json({
      success: true,
      data: {
        isSuperAdmin: true, name: user?.name ?? "Super Admin", email: user?.email ?? null, roleName: "Super Admin",
        businesses: lbs.map((b) => ({ businessId: b.id, businessName: b.businessName, stores: b.stores })),
      },
    })
  }

  const [user, store, business] = await Promise.all([
    prisma.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } }),
    prisma.laundryStore.findUnique({ where: { id: s.storeId }, select: { storeName: true, storeCode: true } }),
    prisma.business.findUnique({ where: { id: s.platformBusinessId! }, select: { name: true, logo: true, primaryColor: true } }),
  ])
  return NextResponse.json({
    success: true,
    data: {
      isSuperAdmin: false,
      name: user?.name ?? null, email: user?.email ?? null,
      businessId: s.businessId,
      businessName: business?.name ?? null,
      businessLogo: business?.logo ? resolveImageUrl(business.logo) : null,
      primaryColor: business?.primaryColor ?? null,
      roleCode: s.roleCode, roleName: s.roleName,
      storeId: s.storeId, storeName: store?.storeName ?? null, storeCode: store?.storeCode ?? null,
    },
  })
}
