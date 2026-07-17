// Receive At Store — scan a Pickup Bag QR/code to mark it physically received.
// COLLECTED → RECEIVED_AT_STORE. Additive; does not touch the order workflow
// (Store Audit still runs its existing process, now openable from the bag).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId as string | undefined
    const code = String(b.code || b.qrValue || "").trim()
    if (!businessId || !code) return NextResponse.json({ success: false, error: "businessId and code are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res

    const bag = await prisma.laundryPickupBag.findFirst({ where: { code } })
    if (!bag) return NextResponse.json({ success: false, error: "Pickup bag not found for this code." }, { status: 404 })
    if (bag.status === "RECEIVED_AT_STORE" || bag.status === "AUDITED") {
      return NextResponse.json({ success: true, data: bag, alreadyReceived: true })
    }
    const updated = await prisma.laundryPickupBag.update({ where: { id: bag.id }, data: { status: "RECEIVED_AT_STORE", receivedAt: new Date(), receivedBy: b.actorName || null } })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error("[pickup-bags-receive] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
