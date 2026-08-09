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

  // PLATFORM — no tenant in the host, so every business is offered. On
  // store.<slug>.<base> requireStoreAdmin has already narrowed to BUSINESS, so
  // even a Super Admin never reaches this branch on a tenant host.
  if (s.scope === "PLATFORM") {
    const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } })
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

  // BUSINESS — one business, several stores to choose from. Reached by a
  // manager assigned business-wide, and by a platform admin on a tenant host.
  // Both get exactly one business: the picker cannot show another tenant
  // because only this business's stores are ever loaded.
  if (s.scope === "BUSINESS") {
    const [user, lb, business, stores] = await Promise.all([
      prisma.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } }),
      prisma.laundryBusiness.findUnique({ where: { id: s.businessId! }, select: { businessName: true } }),
      s.platformBusinessId
        ? prisma.business.findUnique({ where: { id: s.platformBusinessId }, select: { name: true, logo: true, primaryColor: true } })
        : Promise.resolve(null),
      prisma.laundryStore.findMany({
        where: { laundryBusinessId: s.businessId!, isActive: true },
        select: { id: true, storeName: true, storeCode: true },
        orderBy: { storeName: "asc" },
      }),
    ])
    const businessName = business?.name ?? lb?.businessName ?? null
    return NextResponse.json({
      success: true,
      data: {
        isSuperAdmin: s.isSuperAdmin,
        name: user?.name ?? null, email: user?.email ?? null,
        roleCode: s.roleCode ?? null, roleName: s.roleName ?? (s.isSuperAdmin ? "Super Admin" : null),
        businessId: s.businessId,
        businessName,
        businessLogo: business?.logo ? resolveImageUrl(business.logo) : null,
        primaryColor: business?.primaryColor ?? null,
        // Shaped like the PLATFORM payload so the picker renders one code path,
        // just with a single business it can never look past.
        businesses: [{ businessId: s.businessId!, businessName: businessName ?? "Laundry", stores }],
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
