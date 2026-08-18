// Reusable Bag inventory — list + bulk-generate permanent BAG-NNNNNN codes.
// The QR is printed once and permanently attached to the physical bag.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getBagInventory, activeTotal, BAG_STATUS } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    // The screen is laundry.bags — the guard must be the same key, or the nav
    // shows a page the API then refuses.
    const guard = await requireLaundryPermission(request, businessId, "laundry.bags.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [], counts: {}, inventory: null, page: 1, pageSize: 0, total: 0 })

    const status = searchParams.get("status")
    const custodian = searchParams.get("custodian")
    const condition = searchParams.get("condition")
    const storeId = searchParams.get("storeId")
    const bucket = searchParams.get("bucket")
    const search = searchParams.get("search")?.trim()
    const since = searchParams.get("since")
    // PAGINATED BY DEFAULT. This table is expected to reach six figures; the
    // browser must never be handed the whole inventory to filter (§20).
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize")) || 50))

    const where: Record<string, unknown> = { businessId: biz.id }
    if (status && status !== "ALL") where.status = status
    if (custodian && custodian !== "ALL") where.currentCustodianType = custodian
    if (condition && condition !== "ALL") where.condition = condition
    if (storeId && storeId !== "ALL") where.currentStoreId = storeId
    if (since) {
      const d = new Date(since)
      if (!Number.isNaN(d.getTime())) where.updatedAt = { gte: d }
    }
    // A bucket is a VIEW of the census, so it filters on exactly what the census
    // counted rather than on a second, hand-rolled definition of the same thing.
    if (bucket === "withCustomers") where.status = BAG_STATUS.HANDED_TO_CUSTOMER
    else if (bucket === "inspectionRequired") where.status = BAG_STATUS.INSPECTION_REQUIRED
    else if (bucket === "damaged") where.status = BAG_STATUS.DAMAGED
    else if (bucket === "lost") where.status = BAG_STATUS.LOST
    else if (bucket === "retired") where.status = BAG_STATUS.RETIRED
    else if (bucket === "available") where.status = BAG_STATUS.AVAILABLE
    else if (bucket === "outForDelivery") where.status = BAG_STATUS.OUT_FOR_DELIVERY

    if (search) {
      // Mobile lives on Customer, not on the bag. Resolve the ids first (one
      // extra query, bounded) instead of joining every row or filtering in JS.
      // Customer rows are shared platform records, so they are scoped by the
      // PLATFORM business id. Without one, the lookup is skipped entirely rather
      // than widened — a search must never reach another tenant's customers.
      const byPhone = biz.platformBusinessId
        ? await prisma.customer.findMany({
            where: { businessId: biz.platformBusinessId, OR: [{ phone: { contains: search } }, { name: { contains: search } }] },
            select: { id: true }, take: 200,
          }).catch(() => [] as { id: string }[])
        : []
      where.OR = [
        { bagNumber: { contains: search } },
        { qrValue: { contains: search } },
        { currentOrderNumber: { contains: search } },
        { currentCustomerName: { contains: search } },
        ...(byPhone.length ? [{ currentCustomerId: { in: byPhone.map((c) => c.id) } }] : []),
      ]
    }

    const [bags, total, grouped, census] = await Promise.all([
      prisma.laundryBag.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.laundryBag.count({ where }),
      prisma.laundryBag.groupBy({ by: ["status"], where: { businessId: biz.id }, _count: { _all: true } }),
      // Buckets come from the ONE lifecycle classifier — never recomputed here
      // and never in the browser, so the dashboard cannot drift from the domain.
      getBagInventory(biz.id),
    ])
    const counts: Record<string, number> = {}
    for (const g of grouped) counts[g.status] = g._count._all

    return NextResponse.json({
      success: true, data: bags, counts,
      inventory: census, activeTotal: activeTotal(census),
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (e) {
    console.error("[bags] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const count = Math.max(1, Math.min(1000, Number(b.count) || 0))

    // Continue the per-business sequence — zero-padded so string sort = numeric.
    const last = await prisma.laundryBag.findFirst({ where: { businessId: biz.id }, orderBy: { bagNumber: "desc" }, select: { bagNumber: true } })
    const start = last ? parseInt(last.bagNumber.split("-")[1] || "0", 10) : 0
    const data = Array.from({ length: count }, (_, i) => {
      const num = `BAG-${String(start + i + 1).padStart(6, "0")}`
      return { businessId: biz.id, bagNumber: num, qrValue: num, status: "AVAILABLE" }
    })
    await prisma.laundryBag.createMany({ data })
    const created = await prisma.laundryBag.findMany({ where: { businessId: biz.id, bagNumber: { in: data.map((d) => d.bagNumber) } }, orderBy: { bagNumber: "asc" } })
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (e) {
    console.error("[bags] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
