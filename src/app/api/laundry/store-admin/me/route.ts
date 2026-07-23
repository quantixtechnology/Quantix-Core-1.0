// GET /api/laundry/store-admin/me — resolve the current Store Admin session +
// their (single) store. Used by the PWA to restore a session on load.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStoreAdmin } from "@/lib/laundry-store-admin-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const g = await requireStoreAdmin(request)
  if (!g.ok) return g.res
  const s = g.session
  const [user, store] = await Promise.all([
    prisma.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } }),
    prisma.laundryStore.findUnique({ where: { id: s.storeId }, select: { storeName: true, storeCode: true } }),
  ])
  return NextResponse.json({
    success: true,
    data: {
      name: user?.name ?? null, email: user?.email ?? null,
      roleCode: s.roleCode, roleName: s.roleName,
      storeId: s.storeId, storeName: store?.storeName ?? null, storeCode: store?.storeCode ?? null,
    },
  })
}
