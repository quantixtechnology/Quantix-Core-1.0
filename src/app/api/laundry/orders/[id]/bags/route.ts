// GET  /api/laundry/orders/[id]/bags?businessId=  — the order's bag list
// POST /api/laundry/orders/[id]/bags { businessId, code } — attach one more bag
//
// ONE authoritative view of "which physical bags belong to this order", derived
// from LaundryBagAssignment. Sorting establishes the plan, Packing & QR may add
// to it, and Processing / Delivery / the next Pickup all read the same rows —
// so no stage keeps a counter of its own (§15).
//
// POST reuses assignBagToOrder() through addBagToOrder(): it does not generate
// bag numbers, does not create a second bag record, and inherits that function's
// existing guards — unknown bag, wrong tenant, bag held by another order,
// damaged/lost/cleaning, and idempotency on re-scan.
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { orderBags, addBagToOrder } from "@/lib/laundry-order-bags"
import { accountBagsByService, pickServiceForBag, type ServiceRequirement } from "@/lib/laundry-service-bags"
import { prisma } from "@/lib/prisma"
import { CUSTODIAN, type Custodian } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

async function resolveOrder(businessId: string | null, id: string) {
  if (!businessId) return { error: NextResponse.json({ error: "Missing businessId" }, { status: 400 }) }
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return { error: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  // Tenant boundary: the order must belong to THIS business before any bag of
  // it is read or written.
  const order = await prisma.laundryOrder.findFirst({
    where: { id, businessId: biz.id },
    // EVERY booked service with its own bag requirement. This used to be
    // `take: 1`, which is what made every caller collapse to services[0].
    select: {
      id: true, orderNumber: true,
      services: { select: { serviceId: true, serviceName: true, requiredBags: true }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!order) return { error: NextResponse.json({ error: "Order not found" }, { status: 404 }) }
  return { biz, order }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const r = await resolveOrder(businessId, id)
    if ("error" in r) return r.error

    const bags = await orderBags(r.biz.id, r.order.id)
    // Service-level accounting travels with the list, so Audit / Packing /
    // Delivery all read one answer instead of counting bags themselves.
    const accounting = accountBagsByService(r.order.services as ServiceRequirement[], bags)
    return NextResponse.json({
      success: true,
      data: { orderId: r.order.id, orderNumber: r.order.orderNumber, total: bags.length, bags, accounting },
    })
  } catch (e) {
    console.error("[order-bags] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const code = String(b.code || "").trim()
    if (!code) return NextResponse.json({ error: "Scan a bag to add it." }, { status: 400 })
    // Adding a bag changes the order's physical make-up — the same permission
    // the other bag-scanning stages require.
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.bag_management.operate")
    if (!guard.ok) return guard.res
    const r = await resolveOrder(b.businessId, id)
    if ("error" in r) return r.error

    // WHICH SERVICE — the operator's choice, never services[0]. A one-service
    // order still needs no choice, so that flow is unchanged; a multi-service
    // order refuses to guess, because a wrong guess silently mis-files a
    // physical bag and makes another service look accounted for.
    const services = r.order.services as ServiceRequirement[]
    const pick = pickServiceForBag(services, b.serviceId)
    if (!pick.ok) return NextResponse.json({ error: pick.error, code: "SERVICE_REQUIRED", services }, { status: 400 })

    // WHERE the bag is being picked up. Sorting binds its finishing bag at the
    // PLANT; pickup and packing happen at the store, which stays the default.
    // Validated against the enum so a caller cannot invent a location.
    const at = String(b.custodian || "").trim().toUpperCase()
    const custodian = (Object.values(CUSTODIAN) as string[]).includes(at) ? (at as Custodian) : undefined

    const res = await addBagToOrder({
      lbId: r.biz.id,
      orderId: r.order.id,
      code,
      serviceId: pick.service.serviceId,
      serviceName: pick.service.serviceName,
      custodian,
    })
    if (!res.ok) {
      // A refusal answers BOTH halves of the operator's question: which order is
      // holding the bag they just scanned (`conflict`), and which bags this order
      // actually has (`bags`) so the caller can name the one it needs. Read back
      // from the server, so a stale client cache cannot make the message wrong.
      const bags = await orderBags(r.biz.id, r.order.id)
      return NextResponse.json({ error: res.error, conflict: res.conflict, bags }, { status: res.status })
    }

    const bags = await orderBags(r.biz.id, r.order.id)
    const accounting = accountBagsByService(services, bags)
    return NextResponse.json({
      success: true,
      data: { bag: res.bag, total: res.total, alreadyOnOrder: res.alreadyOnOrder, bags, accounting },
    })
  } catch (e) {
    console.error("[order-bags] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
