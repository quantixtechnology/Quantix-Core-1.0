// Advance a reusable bag through its lifecycle by scanning its permanent QR.
// COLLECTED → RECEIVED_AT_STORE → UNDER_AUDIT → PROCESSING → READY_FOR_DELIVERY
// → DELIVERED → RETURNED → CLEANING → AVAILABLE. On AVAILABLE the bag is cleared
// and its open assignment is closed, ready for the next pickup. Additive — the
// order/audit/processing engines are unchanged; this only tracks the asset.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getBagReleaseStage, releaseBag } from "@/lib/laundry-bag-assign"
import { custodyFor, recordBagEvent, custodianForStatus } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

const LIFECYCLE = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING", "AVAILABLE"])

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId as string | undefined
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    const toStatus = String(b.toStatus || "").trim()
    if (!businessId || !code || !toStatus) return NextResponse.json({ success: false, error: "businessId, code and toStatus are required" }, { status: 400 })
    if (!LIFECYCLE.has(toStatus)) return NextResponse.json({ success: false, error: "Invalid lifecycle status." }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const bag = await prisma.laundryBag.findFirst({ where: { businessId: biz.id, OR: [{ bagNumber: code }, { qrValue: code }] } })
    if (!bag) return NextResponse.json({ success: false, error: `Bag "${code}" not found.` }, { status: 404 })

    // Configurable release: on PROCESSING_RECEIVE laundries the bag is RELEASED the
    // moment it is scanned in at the store (garments removed there). Manual
    // "receive returned bag" (→ AVAILABLE) always routes through the same
    // release. Both use the single release engine (history + usage preserved).
    // PROCESSING here IS the Processing Center receive scan — a person scanning
    // the bag in at the PC — so the bag goes straight back into circulation.
    // (The order-advance route is different: there PROCESSING is Store Audit's
    // "approved" signal, which must NOT free a bag that is about to travel.)
    const FREED_BY_SCAN = new Set(["RECEIVED_AT_STORE", "PROCESSING"])
    const shouldRelease = toStatus === "AVAILABLE" ||
      (FREED_BY_SCAN.has(toStatus) && (await getBagReleaseStage(biz.id)) === "PROCESSING_RECEIVE")
    if (shouldRelease) {
      const orderId = bag.currentOrderId
      await releaseBag(biz.id, bag.id) // no-op if already released
      const fresh = await prisma.laundryBag.findUnique({ where: { id: bag.id } })
      return NextResponse.json({ success: true, data: fresh, released: true, orderId })
    }

    // RECEIVING IS RELEASING. Moving the status moves the holder in the same
    // write, so the location that now has the bag is the only one that has it.
    // Guarded on the status we read, so two operators scanning the same bag at
    // once cannot both claim it — the second finds it already moved.
    const claimed = await prisma.laundryBag.updateMany({
      where: { id: bag.id, status: bag.status },
      data: { status: toStatus, ...custodyFor(toStatus), lastUsedAt: new Date() },
    })
    if (claimed.count === 0) {
      // Idempotent: the same scan repeated, or a colleague got there first. The
      // bag is already where this scan wanted to put it, so this is success.
      const now = await prisma.laundryBag.findUnique({ where: { id: bag.id } })
      if (now?.status === toStatus) return NextResponse.json({ success: true, data: now, orderId: now.currentOrderId, alreadyThere: true })
      return NextResponse.json({ success: false, code: "CONCURRENT_UPDATE", error: "This bag was just updated by someone else. Scan it again." }, { status: 409 })
    }
    const updated = await prisma.laundryBag.findUnique({ where: { id: bag.id } })
    // Movement history — append-only, never rewritten.
    await prisma.$transaction(async (tx) => {
      await recordBagEvent(tx, {
        businessId: biz.id, bagId: bag.id, bagNumber: bag.bagNumber, action: "REASSIGNED",
        previousStatus: bag.status, newStatus: toStatus,
        previousCustodianType: bag.currentCustodianType, newCustodianType: custodianForStatus(toStatus),
        orderId: bag.currentOrderId, orderNumber: bag.currentOrderNumber,
        actor: { name: b.actorName || null },
        reason: `Bag scanned to ${toStatus}`,
      })
    }).catch(() => null)
    return NextResponse.json({ success: true, data: updated, orderId: bag.currentOrderId })
  } catch (e) {
    console.error("[bags-advance] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
