// POST /api/laundry/pricing-matrix/import — bulk pricing import, keyed by the
// immutable Garment Code.
//
// The file is the complete pricing master: a code that does not exist yet is
// CREATED from the row's Garment Name and Category, using the code exactly as
// written. That is what makes "bulk delete, then import my sheet" a real
// workflow — the importer used to reject those rows with "Unknown garment
// code", which forced every garment to be created by hand first.
//
// A code that DOES exist is reused, never duplicated, and its name is left
// alone (history and the Pricing Matrix reference garment identity, and §16
// says not to change existing data unnecessarily). An archived one is
// reactivated, because a garment listed in the current master is by definition
// part of it.
//
// Rows with an unknown service are still rejected. Validates every row first;
// nothing is written unless all rows pass. Optional `replaceExisting` wipes the
// whole base-scope matrix first (garments are untouched), then imports.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { saveGarmentCells, type Cell, type CellMode } from "@/lib/laundry-pricing-matrix"
import { ensureGarmentCodes } from "@/lib/laundry-garment-codes"

export const runtime = "nodejs"
const MODES = new Set(["NOT_AVAILABLE", "PER_PIECE", "PER_KG"])

interface ImportCell { service: string; price?: string | number | null; billing?: string; subscription?: string | null }

/**
 * YES / NO for one garment × service pair.
 *
 * Deliberately three-valued. An EMPTY cell — or a sheet exported before the
 * column existed — returns undefined, which leaves whatever that pair already
 * has. Only an explicit YES/NO changes it, so importing an old file cannot
 * silently switch every pair off.
 */
function parseSubscription(v: string | null | undefined): boolean | undefined | null {
  if (v == null) return undefined
  const t = String(v).trim().toUpperCase()
  if (!t) return undefined
  if (["YES", "Y", "TRUE", "1", "INCLUDED"].includes(t)) return true
  if (["NO", "N", "FALSE", "0", "NOT INCLUDED", "EXCLUDED"].includes(t)) return false
  return null // present but unrecognised → a row error, never a silent default
}
interface ImportRow { code?: string; name?: string; category?: string; cells?: ImportCell[] }

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
    const [services, inactiveServices, garments, categories] = await Promise.all([
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }, select: { id: true, name: true } }),
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: false }, select: { name: true } }),
      // Every garment of THIS tenant, archived ones included — codes are unique
      // per business (@@unique([businessId, code])), so another tenant's
      // GAR00001 is invisible here and can never be matched or overwritten.
      prisma.laundryGarment.findMany({ where: { businessId: lbId }, select: { id: true, code: true, name: true, isActive: true } }),
      prisma.laundryCategory.findMany({ where: { businessId: lbId }, select: { id: true, name: true } }),
    ])
    const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]))
    const inactiveByName = new Set(inactiveServices.map((s) => s.name.trim().toLowerCase()))
    const svcByName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]))
    const svcNameById = new Map(services.map((s) => [s.id, s.name]))
    const garmentByCode = new Map(garments.filter((g) => g.code).map((g) => [g.code!.trim().toLowerCase(), g]))

    // ── Validate every row ──────────────────────────────────────────────────
    const errors: { row: number; code: string; message: string }[] = []
    const seen = new Set<string>()
    const prepared: { garmentId: string | null; garmentName: string; cells: Cell[]; create: { code: string; name: string; categoryId: string | null } | null; reactivate: boolean }[] = []

    rows.forEach((r, idx) => {
      const rn = idx + 1
      const code = String(r.code ?? "").trim()
      if (!code) { errors.push({ row: rn, code: "", message: "Garment Code is required." }); return }
      const key = code.toLowerCase()
      if (seen.has(key)) { errors.push({ row: rn, code, message: `Duplicate code "${code}" in file.` }); return }
      seen.add(key)
      // Unknown code → the row DEFINES a new garment rather than failing.
      const garment = garmentByCode.get(key)
      let create: { code: string; name: string; categoryId: string | null } | null = null
      if (!garment) {
        const name = String(r.name ?? "").trim()
        if (!name) { errors.push({ row: rn, code, message: `"${code}" is a new garment, so Garment Name is required to create it.` }); return }
        let categoryId: string | null = null
        const catName = String(r.category ?? "").trim()
        if (catName) {
          const cat = catByName.get(catName.toLowerCase())
          // Categories are not invented from a spreadsheet cell — a typo would
          // silently create one, and the master would fill with near-duplicates.
          if (!cat) { errors.push({ row: rn, code, message: `Unknown category "${catName}" for ${code}. Create it in Categories first, or leave the cell blank.` }); return }
          categoryId = cat.id
        }
        create = { code, name, categoryId }
      }

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

        // Subscription is read for EVERY pair, priced or not. It is a separate
        // statement from the pricing type: "Dry Clean, PER_PIECE, 99, NO" means
        // priced and excluded, which NA cannot express.
        const sub = parseSubscription(c.subscription)
        if (sub === null) { errors.push({ row: rn, code, message: `Invalid subscription "${c.subscription}" for ${svc.name} (use YES or NO).` }); continue }

        if (mode === "NOT_AVAILABLE") { cells.push({ serviceId: svc.id, mode: "NOT_AVAILABLE", subscriptionIncluded: sub }); continue }
        const priceRaw = c.price
        if (priceRaw === "" || priceRaw == null || String(priceRaw).toUpperCase() === "NA") { errors.push({ row: rn, code, message: `Missing price for ${svc.name}.` }); continue }
        const price = Number(priceRaw)
        if (isNaN(price) || price < 0) { errors.push({ row: rn, code, message: `Invalid price for ${svc.name}.` }); continue }
        cells.push({ serviceId: svc.id, mode: mode as CellMode, price, subscriptionIncluded: sub })
      }
      prepared.push({
        garmentId: garment?.id ?? null,
        garmentName: garment?.name ?? create!.name,
        cells,
        create,
        // A garment named in the current master belongs in it. Archiving is how
        // the Garments master "deletes", so without this an archived code would
        // be priced and still stay invisible.
        reactivate: !!garment && !garment.isActive,
      })
    })

    if (errors.length) return NextResponse.json({ success: false, errors }, { status: 422 })

    // ── Replace mode: wipe the whole base-scope matrix first (garments kept) ──
    if (b.replaceExisting) {
      await prisma.laundryPricingRule.deleteMany({ where: { businessId: lbId, garmentId: { not: null }, serviceId: { not: null }, storeId: null, customerType: null, categoryId: null } })
    }

    // ── Import (all rows valid) ─────────────────────────────────────────────
    let imported = 0, created = 0, reactivated = 0
    for (const p of prepared) {
      let garmentId = p.garmentId
      if (!garmentId && p.create) {
        // The code is written exactly as supplied — never regenerated. Codes are
        // unique per business, so this cannot collide with another tenant.
        const g = await prisma.laundryGarment.create({
          data: { businessId: lbId, code: p.create.code, name: p.create.name, categoryId: p.create.categoryId, isActive: true },
          select: { id: true },
        })
        garmentId = g.id
        created++
      } else if (garmentId && p.reactivate) {
        await prisma.laundryGarment.update({ where: { id: garmentId }, data: { isActive: true } })
        reactivated++
      }
      await saveGarmentCells(lbId, garmentId!, p.garmentName, p.cells, (sid) => svcNameById.get(sid) || "Service")
      imported++
    }
    return NextResponse.json({ success: true, imported, created, reactivated, replaced: !!b.replaceExisting })
  } catch (e) {
    console.error("[pricing-matrix-import] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
