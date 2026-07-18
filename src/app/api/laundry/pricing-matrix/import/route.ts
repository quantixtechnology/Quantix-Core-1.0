// Bulk import garments + pricing. Validates EVERY row first; imports nothing
// unless all rows pass. Upserts garments by name and writes the same base-scope
// LaundryPricingRule rows the engine reads. Reuses the matrix cell writer.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { saveGarmentCells, type Cell, type CellMode } from "@/lib/laundry-pricing-matrix"

export const runtime = "nodejs"
const MODES = new Set(["NOT_AVAILABLE", "PER_PIECE", "PER_KG"])

interface ImportCell { service: string; price?: string | number | null; billing?: string }
interface ImportRow { name?: string; category?: string; avgWeight?: string | number | null; subscription?: string | boolean; cells?: ImportCell[] }

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const rows: ImportRow[] = Array.isArray(b.rows) ? b.rows : []
    if (!rows.length) return NextResponse.json({ success: false, error: "No rows to import." }, { status: 400 })

    const [services, categories, garments] = await Promise.all([
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }, select: { id: true, name: true } }),
      prisma.laundryCategory.findMany({ where: { businessId: lbId, isActive: true }, select: { id: true, name: true } }),
      prisma.laundryGarment.findMany({ where: { businessId: lbId }, select: { id: true, name: true } }),
    ])
    const svcByName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]))
    const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]))
    const garmentByName = new Map(garments.map((g) => [g.name.trim().toLowerCase(), g]))
    const svcNameById = new Map(services.map((s) => [s.id, s.name]))

    // ── Validate every row ──────────────────────────────────────────────────
    const errors: { row: number; message: string }[] = []
    const seen = new Set<string>()
    const prepared: { name: string; categoryId: string | null; avgWeight: number | null; subscription: boolean; cells: Cell[] }[] = []

    rows.forEach((r, idx) => {
      const rn = idx + 1
      const name = String(r.name || "").trim()
      if (!name) { errors.push({ row: rn, message: "Garment name is required." }); return }
      const key = name.toLowerCase()
      if (seen.has(key)) { errors.push({ row: rn, message: `Duplicate garment "${name}" in the file.` }); return }
      seen.add(key)

      let categoryId: string | null = null
      const cat = String(r.category || "").trim()
      if (cat) { const c = catByName.get(cat.toLowerCase()); if (!c) { errors.push({ row: rn, message: `Unknown category "${cat}".` }); return } categoryId = c.id }

      let avgWeight: number | null = null
      if (r.avgWeight !== "" && r.avgWeight != null) {
        const w = Number(r.avgWeight)
        if (isNaN(w) || w < 0) { errors.push({ row: rn, message: "Invalid average weight." }); return }
        avgWeight = w
      }
      const subStr = String(r.subscription ?? "").trim().toLowerCase()
      const subscription = subStr === "yes" || subStr === "true" || r.subscription === true

      const cells: Cell[] = []
      for (const c of r.cells || []) {
        const svc = svcByName.get(String(c.service || "").trim().toLowerCase())
        if (!svc) { errors.push({ row: rn, message: `Unknown service "${c.service}".` }); continue }
        const billing = String(c.billing || "NOT_AVAILABLE").trim().toUpperCase().replace(/[\s-]/g, "_")
        const mode = billing === "NA" ? "NOT_AVAILABLE" : billing
        if (!MODES.has(mode)) { errors.push({ row: rn, message: `Invalid billing "${c.billing}" for ${svc.name}.` }); continue }
        if (mode === "NOT_AVAILABLE") { cells.push({ serviceId: svc.id, mode: "NOT_AVAILABLE" }); continue }
        const priceRaw = c.price
        if (priceRaw === "" || priceRaw == null || String(priceRaw).toUpperCase() === "NA") { errors.push({ row: rn, message: `Missing price for ${svc.name}.` }); continue }
        const price = Number(priceRaw)
        if (isNaN(price) || price < 0) { errors.push({ row: rn, message: `Invalid price for ${svc.name}.` }); continue }
        cells.push({ serviceId: svc.id, mode: mode as CellMode, price })
      }
      prepared.push({ name, categoryId, avgWeight, subscription, cells })
    })

    if (errors.length) return NextResponse.json({ success: false, errors }, { status: 422 })

    // ── Import (all rows valid) ─────────────────────────────────────────────
    let imported = 0
    for (const p of prepared) {
      const existing = garmentByName.get(p.name.toLowerCase())
      let garmentId: string
      if (existing) {
        garmentId = existing.id
        await prisma.laundryGarment.update({ where: { id: existing.id }, data: { categoryId: p.categoryId, averageWeight: p.avgWeight, subscriptionIncluded: p.subscription, isActive: true } })
      } else {
        const g = await prisma.laundryGarment.create({ data: { businessId: lbId, name: p.name, categoryId: p.categoryId, averageWeight: p.avgWeight, subscriptionIncluded: p.subscription } })
        garmentId = g.id
        garmentByName.set(p.name.toLowerCase(), { id: g.id, name: g.name })
      }
      await saveGarmentCells(lbId, garmentId, p.name, p.cells, (sid) => svcNameById.get(sid) || "Service")
      imported++
    }
    return NextResponse.json({ success: true, imported })
  } catch (e) {
    console.error("[pricing-matrix-import] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
