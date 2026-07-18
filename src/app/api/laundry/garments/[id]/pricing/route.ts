// Save one garment's pricing from the matrix editor: garment fields (category,
// avg weight, subscription) + per-service cells (NA / Per Piece / Per KG).
// Writes the same base-scope LaundryPricingRule rows the engine reads.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { saveGarmentCells, type Cell, type CellMode } from "@/lib/laundry-pricing-matrix"

export const runtime = "nodejs"
const MODES = new Set(["NOT_AVAILABLE", "PER_PIECE", "PER_KG"])

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id

    const garment = await prisma.laundryGarment.findFirst({ where: { id, businessId: lbId }, select: { id: true, name: true } })
    if (!garment) return NextResponse.json({ error: "Garment not found" }, { status: 404 })

    // Garment master fields.
    const gData: Record<string, unknown> = {}
    if (b.categoryId !== undefined) gData.categoryId = b.categoryId || null
    if (b.averageWeight !== undefined) gData.averageWeight = b.averageWeight === "" || b.averageWeight == null ? null : Number(b.averageWeight)
    if (b.subscriptionIncluded !== undefined) gData.subscriptionIncluded = !!b.subscriptionIncluded
    if (Object.keys(gData).length) await prisma.laundryGarment.update({ where: { id }, data: gData })

    const rawCells: { serviceId: string; mode: string; price?: number | null; minWeightKg?: number | null }[] = Array.isArray(b.cells) ? b.cells : []
    const cellServiceIds = rawCells.map((c) => c.serviceId).filter(Boolean)
    const services = cellServiceIds.length ? await prisma.laundryService.findMany({ where: { businessId: lbId, id: { in: cellServiceIds } }, select: { id: true, name: true } }) : []
    const nameById = new Map(services.map((s) => [s.id, s.name]))

    const cells: Cell[] = rawCells
      .filter((c) => c.serviceId && nameById.has(c.serviceId) && MODES.has(c.mode))
      .map((c) => ({ serviceId: c.serviceId, mode: c.mode as CellMode, price: c.price ?? 0, minWeightKg: c.minWeightKg ?? null }))
    await saveGarmentCells(lbId, id, garment.name, cells, (sid) => nameById.get(sid) || "Service")

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[garment-pricing] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
