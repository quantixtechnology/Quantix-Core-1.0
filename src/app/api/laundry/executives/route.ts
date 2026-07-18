// GET /api/laundry/executives?businessId= — active Delivery Executives assignable
// to pickup/delivery jobs. Sourced from the dedicated LaundryDeliveryExecutive
// master (NOT generic staff), so only real field executives appear in the
// scheduler. Assignment stores the executive's id on the order.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId!)
    if (!biz) return NextResponse.json({ success: true, data: [] })

    const execs = await prisma.laundryDeliveryExecutive.findMany({
      where: { businessId: biz.id, isActive: true },
      orderBy: { name: "asc" },
      include: { store: { select: { storeName: true } } },
    })
    const data = execs.map((e) => ({
      id: e.id, name: e.name, mobile: e.mobile, employeeCode: e.employeeCode,
      storeId: e.storeId, storeName: e.store?.storeName ?? null,
      vehicleType: e.vehicleType, availability: e.availability,
    }))
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-executives] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
