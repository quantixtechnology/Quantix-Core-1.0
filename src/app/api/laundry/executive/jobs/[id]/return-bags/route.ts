// GET  /api/laundry/executive/jobs/[id]/return-bags — the bags this pickup's
//      customer is currently holding, with what has been scanned back.
// POST /api/laundry/executive/jobs/[id]/return-bags { code } — return one.
//
// Thin transport over customerReturnBags()/confirmReturnedBag(). Ownership,
// tenant scoping, idempotency and the all-bags rule live there and are not
// restated. The bag list comes from the customer's CURRENT holdings, so a bag
// returned on an earlier visit never reappears.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive } from "@/lib/laundry-executive-auth"
import { customerReturnBags, confirmReturnedBag } from "@/lib/laundry-pickup-return"

export const runtime = "nodejs"

async function guardJob(request: Request, id: string) {
  const session = await resolveExecutive(request)
  if (!session) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  const order = await prisma.laundryOrder.findFirst({
    where: { id, businessId: session.businessId },
    select: { id: true, pickupExecutiveId: true, customerId: true, storeId: true, pickupCompletedAt: true },
  })
  if (!order) return { error: NextResponse.json({ error: "Order not found" }, { status: 404 }) }
  if (order.pickupExecutiveId !== session.executiveId) {
    return { error: NextResponse.json({ error: "This pickup is not assigned to you" }, { status: 403 }) }
  }
  return { session, order }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const g = await guardJob(request, id)
    if ("error" in g) return g.error
    // No customer on the order → nothing is held, and nothing is owed back.
    if (!g.order.customerId) {
      return NextResponse.json({ success: true, data: { bags: [], total: 0, returned: 0, outstanding: 0, allReturned: true, message: null } })
    }
    return NextResponse.json({
      success: true,
      data: await customerReturnBags(g.session.businessId, g.order.customerId, { orderId: g.order.id }),
    })
  } catch (e) {
    console.error("[executive-return-bags] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const g = await guardJob(request, id)
    if ("error" in g) return g.error
    if (!g.order.customerId) return NextResponse.json({ error: "This pickup has no customer to return bags for." }, { status: 409 })

    const b = await request.json().catch(() => ({}))
    const res = await confirmReturnedBag({
      lbId: g.session.businessId,
      customerId: g.order.customerId,
      orderId: g.order.id,
      storeId: g.order.storeId,
      code: String(b.code || b.bagNumber || b.qrValue || ""),
      condition: b.condition ?? null,
      actor: { id: g.session.executiveId, name: b.executiveName ?? "Executive", role: "PICKUP_EXECUTIVE" },
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

    return NextResponse.json({
      success: true,
      data: { ...await customerReturnBags(g.session.businessId, g.order.customerId, { orderId: g.order.id }), scanned: res.bagNumber, alreadyReturned: res.alreadyReturned },
    })
  } catch (e) {
    console.error("[executive-return-bags] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
