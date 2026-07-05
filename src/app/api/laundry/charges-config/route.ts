// GET/PUT /api/laundry/charges-config?businessId=  — the two Charges & Rules
// config cards (Minimum Order by order type + Express Delivery) stored on
// LaundryOperationalConfig. Single source; the Billing Resolver reads these.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

const shape = (c: {
  walkInMinOrder: number; pickupMinOrder: number; deliveryMinOrder: number
  expressEnabled: boolean; expressTurnaroundHours: number | null; expressChargeType: string; expressChargeValue: number
}) => ({
  walkInMinOrder: c.walkInMinOrder, pickupMinOrder: c.pickupMinOrder, deliveryMinOrder: c.deliveryMinOrder,
  expressEnabled: c.expressEnabled, expressTurnaroundHours: c.expressTurnaroundHours,
  expressChargeType: c.expressChargeType, expressChargeValue: c.expressChargeValue,
})

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: {}, create: { businessId: biz.id } })
    return NextResponse.json({ success: true, data: shape(cfg) })
  } catch (e) {
    console.error("[charges-config] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json()
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const num = (v: unknown) => Math.max(0, Number(v) || 0)
    const data = {
      walkInMinOrder: num(b.walkInMinOrder), pickupMinOrder: num(b.pickupMinOrder), deliveryMinOrder: num(b.deliveryMinOrder),
      expressEnabled: !!b.expressEnabled,
      expressTurnaroundHours: b.expressTurnaroundHours == null || b.expressTurnaroundHours === "" ? null : Math.max(1, Number(b.expressTurnaroundHours) || 0),
      expressChargeType: b.expressChargeType === "PERCENT" ? "PERCENT" : "FIXED",
      expressChargeValue: num(b.expressChargeValue),
    }
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: data, create: { businessId: biz.id, ...data } })
    return NextResponse.json({ success: true, data: shape(cfg) })
  } catch (e) {
    console.error("[charges-config] PUT", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
