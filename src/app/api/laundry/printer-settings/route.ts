// GET/PUT /api/laundry/printer-settings?businessId= — receipt/invoice printer
// configuration stored on LaundryOperationalConfig, per laundry business.
//
// Same shape and same guards as the neighbouring settings endpoints
// (payment-settings, slot-config). Presentation only: nothing here touches an
// order, a payment, an invoice number or a total.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { fromConfigRow, toConfigRow, normalizePrinterSettings } from "@/lib/laundry-printer"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    // View is broad on purpose: order screens need to know the paper size in
    // order to print at all, and counter staff are not settings editors.
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: {}, create: { businessId: biz.id } })
    return NextResponse.json({ success: true, data: fromConfigRow(cfg) })
  } catch (e) {
    console.error("[printer-settings] GET", e)
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
    // Normalised server-side too — the client is not the last line of defence.
    const data = toConfigRow(normalizePrinterSettings(b))
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: data, create: { businessId: biz.id, ...data } })
    return NextResponse.json({ success: true, data: fromConfigRow(cfg) })
  } catch (e) {
    console.error("[printer-settings] PUT", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
