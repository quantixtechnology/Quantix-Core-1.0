// Reusable Bag inventory — list + bulk-generate permanent BAG-NNNNNN codes.
// The QR is printed once and permanently attached to the physical bag.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [], counts: {} })

    const where: Record<string, unknown> = { businessId: biz.id }
    if (status && status !== "ALL") where.status = status
    if (search?.trim()) where.OR = [{ bagNumber: { contains: search.trim() } }, { currentOrderNumber: { contains: search.trim() } }, { currentCustomerName: { contains: search.trim() } }]

    const [bags, grouped] = await Promise.all([
      prisma.laundryBag.findMany({ where, orderBy: { bagNumber: "asc" }, take: 500 }),
      prisma.laundryBag.groupBy({ by: ["status"], where: { businessId: biz.id }, _count: { _all: true } }),
    ])
    const counts: Record<string, number> = {}
    for (const g of grouped) counts[g.status] = g._count._all
    return NextResponse.json({ success: true, data: bags, counts })
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
