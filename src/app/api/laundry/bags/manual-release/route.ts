// POST /api/laundry/bags/manual-release — Manual Release (fallback).
// When a bag's QR cannot be scanned (damaged/sticker removed/scanner failure),
// authorized users can manually release the bag. Only Platform Super Admin OR
// business users with the `laundry.bags.manual_release` permission may perform
// this action. Everyone else receives 403 Forbidden.
//
// Body: { businessId, code (bagNumber or qrValue), reason, storeId?, actorName? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { releaseBagWithAudit } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId as string | undefined
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    const reason = String(b.reason || "").trim()

    if (!businessId || !code) {
      return NextResponse.json({ success: false, error: "businessId and code are required" }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ success: false, error: "reason is required for manual release" }, { status: 400 })
    }

    // Gate: only users with launder.bags.manual_release permission.
    const guard = await requireLaundryPermission(request, businessId, "laundry.bags.manual_release")
    if (!guard.ok) return guard.res

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const bag = await prisma.laundryBag.findFirst({
      where: { businessId: biz.id, OR: [{ bagNumber: code }, { qrValue: code }] },
      select: { id: true, status: true, bagNumber: true, currentOrderId: true, currentOrderNumber: true },
    })
    if (!bag) return NextResponse.json({ success: false, error: `Bag "${code}" not found.` }, { status: 404 })
    if (bag.status === "AVAILABLE") {
      return NextResponse.json({ success: false, error: `Bag ${bag.bagNumber} is already AVAILABLE.` }, { status: 409 })
    }
    if (bag.status === "LOST") {
      return NextResponse.json({ success: false, error: `Bag ${bag.bagNumber} is marked as Lost and cannot be released.` }, { status: 409 })
    }

    const r = await releaseBagWithAudit({
      lbId: biz.id,
      bagId: bag.id,
      code,
      storeId: b.storeId || null,
      releasedBy: b.actorName || guard.ctx.userName || null,
      releaseType: "MANUAL",
      reason,
    })
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status })

    const fresh = await prisma.laundryBag.findUnique({ where: { id: bag.id } })
    return NextResponse.json({
      success: true,
      data: fresh,
      released: true,
      releaseType: "MANUAL",
      reason,
      orderId: bag.currentOrderId,
      orderNumber: bag.currentOrderNumber,
    })
  } catch (e) {
    console.error("[bags-manual-release] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
