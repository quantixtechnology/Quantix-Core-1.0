// GET/PUT /api/laundry/payment-settings?businessId= — laundry payment settings.
// Today: the COD (Cash on Delivery) switch stored on LaundryOperationalConfig.
// COD is available everywhere (storefront, counter, delivery) unless the owner
// turns it off here. Online-gateway (Razorpay/Paytm/…) selection + keys live in
// the platform gateway system; this endpoint is the laundry-side home for the
// COD switch and future laundry-specific payment prefs.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shape = (c: any) => ({ codEnabled: c?.codEnabled ?? true })

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: {}, create: { businessId: biz.id } })
    return NextResponse.json({ success: true, data: shape(cfg) })
  } catch (e) {
    console.error("[payment-settings] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const data = { codEnabled: !!b.codEnabled }
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: data, create: { businessId: biz.id, ...data } })
    return NextResponse.json({ success: true, data: shape(cfg) })
  } catch (e) {
    console.error("[payment-settings] PUT", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
