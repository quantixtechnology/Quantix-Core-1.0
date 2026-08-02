// Order-Based Finishing Bag assignment.
//
// GET  /api/laundry/processing/finishing-bag?businessId= — the Workspace Scan
//      Mode + the label/hint to show at the bag-assignment prompt (Bag /
//      Processing Package / Both — never hardcoded).
// POST /api/laundry/processing/finishing-bag
//      Body: { businessId, orderId, code, actorName? }
//      Assign the order's ONE finishing bag at the moment its LAST garment
//      passes Quality Check. Scanning the configured container associates EVERY
//      garment of the order with it and retires all garment barcodes — after
//      that, Ironing/Folding/Packing operate only by scanning the container.
//
// Server enforcements (see assignFinishingBag):
//   • one active finishing bag per order  (second call is a no-op)
//   • the scanned code must belong to THIS order (a bag on another order is
//     rejected — each finishing bag belongs to one order)
//   • eligible only once every garment has passed QC
//   • Scan-Mode gate (Bag / Package / Both) is the workspace setting, never hardcoded
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { assignFinishingBag, finishingBagTarget } from "@/lib/laundry-finishing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "processing.quality_check.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: { mode: "GENERATE_NEW", target: finishingBagTarget("GENERATE_NEW") } })
    const row = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { processingPackageQrMode: true } })
    const mode = row?.processingPackageQrMode || "GENERATE_NEW"
    return NextResponse.json({ success: true, data: { mode, target: finishingBagTarget(mode) } })
  } catch (e) {
    console.error("[finishing-bag] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = String(b.businessId || "")
    const orderId = String(b.orderId || "")
    const code = String(b.code || "").trim()
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 })
    if (!code) return NextResponse.json({ error: "Scan a container code to assign the finishing bag." }, { status: 400 })

    const guard = await requireLaundryPermission(request, businessId, "processing.quality_check.process")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const row = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { processingPackageQrMode: true } })
    const mode = row?.processingPackageQrMode || "GENERATE_NEW"

    const result = await assignFinishingBag({ orderId, businessId, code, mode, actorName: b.actorName || null })
    if (!result.ok) {
      const status = result.code === "WRONG_ORDER" ? 409 : result.code === "ALREADY_ASSIGNED" ? 409 : 400
      return NextResponse.json({ success: false, error: result.error }, { status })
    }
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    console.error("[finishing-bag] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}