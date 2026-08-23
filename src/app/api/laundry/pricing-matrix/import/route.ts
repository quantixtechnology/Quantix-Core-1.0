// POST /api/laundry/pricing-matrix/import — bulk pricing import, keyed by the
// immutable Garment Code. Pricing import NEVER creates garments; it only
// references existing garments by code. Rows with an unknown code or an unknown
// service are rejected. Validates every row first; nothing is written unless all
// rows pass. Optional `replaceExisting` wipes the whole base-scope matrix first
// (garments are untouched), then imports the new pricing.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { saveGarmentCells, type Cell, type CellMode } from "@/lib/laundry-pricing-matrix"
import { ensureGarmentCodes } from "@/lib/laundry-garment-codes"

export const runtime = "nodejs"
const MODES = new Set(["NOT_AVAILABLE", "PER_PIECE", "PER_KG"])

interface ImportCell { service: string; price?: string | number | null; billing?: string }
interface ImportRow { code?: string; cells?: ImportCell[] }

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    await ensureGarmentCodes(lbId)
    const rows: ImportRow[] = Array.isArray(b.rows) ? b.rows : []
    if (!rows.length) return NextResponse.json({ success: false, error: "No rows to import." }, { status: 400 })

    // Active services are the importable columns — the same rule the matrix and
    // the template are built from. Deactivated ones are read too, but ONLY so a
    // row naming one can be told what actually happened: without them the
    // message is "Unknown service", which is wrong and sends the user looking
    // for a typo in a service that is sitting right there in the master.
    // Reading them changes nothing: an inactive service is still refused, still
    // not reactivated, and still not duplicated.
    const [services, inactiveServices, garments] = await Promise.all([
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }, select: { id: true, name: true } }),
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: false }, select: { name: true } }),
      prisma.laundryGarment.findMany({ where: { businessId: lbId }, select: { id: true, code: true, name: true } }),
    ])
    const inactiveByName = new Set(inactiveServices.map((s) => s.name.trim().toLowerCase()))
    const svcByName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]))
    const svcNameById = new Map(services.map((s) => [s.id, s.name]))
    const garmentByCode = new Map(garments.filter((g) => g.code).map((g) => [g.code!.trim().toLowerCase(), g]))

    // ── Validate every row ──────────────────────────────────────────────────
    const errors: { row: number; code: string; message: string }[] = []
    const seen = new Set<string>()
    const prepared: { garmentId: string; garmentName: string; cells: Cell[] }[] = []

    rows.forEach((r, idx) => {
      const rn = idx + 1
      const code = String(r.code ?? "").trim()
      if (!code) { errors.push({ row: rn, code: "", message: "Garment Code is required." }); return }
      const key = code.toLowerCase()
      if (seen.has(key)) { errors.push({ row: rn, code, message: `Duplicate code "${code}" in file.` }); return }
      seen.add(key)
      const garment = garmentByCode.get(key)
      if (!garment) { errors.push({ row: rn, code, message: `Unknown garment code "${code}".` }); return }

      const cells: Cell[] = []
      for (const c of r.cells || []) {
        const svcKey = String(c.service || "").trim().toLowerCase()
        const svc = svcByName.get(svcKey)
        if (!svc) {
          errors.push({
            row: rn, code,
            message: inactiveByName.has(svcKey)
              ? `"${c.service}" is deactivated in Services. Reactivate it there to price it — importing cannot.`
              : `Unknown service "${c.service}".`,
          })
          continue
        }
        const billing = String(c.billing || "NOT_AVAILABLE").trim().toUpperCase().replace(/[\s-]/g, "_")
        const mode = billing === "NA" ? "NOT_AVAILABLE" : billing
        if (!MODES.has(mode)) { errors.push({ row: rn, code, message: `Invalid billing "${c.billing}" for ${svc.name}.` }); continue }
        if (mode === "NOT_AVAILABLE") { cells.push({ serviceId: svc.id, mode: "NOT_AVAILABLE" }); continue }
        const priceRaw = c.price
        if (priceRaw === "" || priceRaw == null || String(priceRaw).toUpperCase() === "NA") { errors.push({ row: rn, code, message: `Missing price for ${svc.name}.` }); continue }
        const price = Number(priceRaw)
        if (isNaN(price) || price < 0) { errors.push({ row: rn, code, message: `Invalid price for ${svc.name}.` }); continue }
        cells.push({ serviceId: svc.id, mode: mode as CellMode, price })
      }
      prepared.push({ garmentId: garment.id, garmentName: garment.name, cells })
    })

    if (errors.length) return NextResponse.json({ success: false, errors }, { status: 422 })

    // ── Replace mode: wipe the whole base-scope matrix first (garments kept) ──
    if (b.replaceExisting) {
      await prisma.laundryPricingRule.deleteMany({ where: { businessId: lbId, garmentId: { not: null }, serviceId: { not: null }, storeId: null, customerType: null, categoryId: null } })
    }

    // ── Import (all rows valid) ─────────────────────────────────────────────
    let imported = 0
    for (const p of prepared) {
      await saveGarmentCells(lbId, p.garmentId, p.garmentName, p.cells, (sid) => svcNameById.get(sid) || "Service")
      imported++
    }
    return NextResponse.json({ success: true, imported, replaced: !!b.replaceExisting })
  } catch (e) {
    console.error("[pricing-matrix-import] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
