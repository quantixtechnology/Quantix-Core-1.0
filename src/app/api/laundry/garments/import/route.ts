// POST /api/laundry/garments/import — enterprise garment catalogue import.
//   { businessId, rows: ImportRow[], duplicateStrategy?: "update"|"skip", commit?: boolean }
// Flow: validate every row → detect duplicates by immutable Garment Code →
// return a preview (counts + warnings + error report). Nothing is written unless
// commit=true AND there are zero errors. Existing garments are matched by CODE
// (names may change freely); a name-collision under a different code is a
// non-blocking warning. Never creates duplicate garments.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

interface ImportRow { code?: string; name?: string; category?: string; material?: string; avgWeight?: string | number | null; subscription?: string | boolean; image?: string; status?: string }
const truthy = (v: unknown) => { const s = String(v ?? "").trim().toLowerCase(); return s === "yes" || s === "true" || s === "y" || s === "1" }
const isArchived = (v: unknown) => { const s = String(v ?? "").trim().toLowerCase(); return s === "archived" || s === "inactive" || s === "no" || s === "false" }

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const strategy = b.duplicateStrategy === "skip" ? "skip" : "update"
    const rows: ImportRow[] = Array.isArray(b.rows) ? b.rows : []
    if (!rows.length) return NextResponse.json({ success: false, error: "No rows to import." }, { status: 400 })

    const [categories, garments] = await Promise.all([
      prisma.laundryCategory.findMany({ where: { businessId: lbId }, select: { id: true, name: true } }),
      prisma.laundryGarment.findMany({ where: { businessId: lbId }, select: { id: true, code: true, name: true } }),
    ])
    const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]))
    const byCode = new Map(garments.filter((g) => g.code).map((g) => [g.code!.trim().toLowerCase(), g]))
    const nameToCodes = new Map<string, string[]>()
    for (const g of garments) { const k = g.name.trim().toLowerCase(); if (!nameToCodes.has(k)) nameToCodes.set(k, []); if (g.code) nameToCodes.get(k)!.push(g.code) }

    const errors: { row: number; code: string; message: string }[] = []
    const warnings: { row: number; code: string; message: string }[] = []
    const seenCodes = new Set<string>()
    type Prepared = { mode: "create" | "update" | "skip"; id?: string; code: string; name: string; categoryId: string | null; material: string | null; averageWeight: number | null; subscription: boolean; image: string | null; isActive: boolean }
    const prepared: Prepared[] = []

    rows.forEach((r, idx) => {
      const rn = idx + 1
      const code = String(r.code ?? "").trim()
      const name = String(r.name ?? "").trim()
      if (!code) { errors.push({ row: rn, code: "", message: "Garment Code is required." }); return }
      const codeKey = code.toLowerCase()
      if (seenCodes.has(codeKey)) { errors.push({ row: rn, code, message: `Duplicate code "${code}" in file.` }); return }
      seenCodes.add(codeKey)
      if (!name) { errors.push({ row: rn, code, message: "Garment Name is required." }); return }

      let categoryId: string | null = null
      const cat = String(r.category ?? "").trim()
      if (cat) { const c = catByName.get(cat.toLowerCase()); if (!c) { errors.push({ row: rn, code, message: `Unknown category "${cat}".` }); return } categoryId = c.id }

      let averageWeight: number | null = null
      if (r.avgWeight !== "" && r.avgWeight != null) {
        const w = Number(r.avgWeight)
        if (isNaN(w) || w < 0) { errors.push({ row: rn, code, message: "Invalid average weight." }); return }
        averageWeight = w
      }
      const statusRaw = String(r.status ?? "").trim()
      if (statusRaw && !isArchived(statusRaw) && statusRaw.toLowerCase() !== "active") { errors.push({ row: rn, code, message: `Invalid status "${statusRaw}" (use Active or Archived).` }); return }
      const isActive = !isArchived(statusRaw)

      // Name collision under a different code = possible duplicate (warn only).
      const codesForName = nameToCodes.get(name.toLowerCase()) || []
      if (codesForName.length && !codesForName.some((c) => c.toLowerCase() === codeKey)) warnings.push({ row: rn, code, message: `Name "${name}" already exists under code ${codesForName.join(", ")} — possible duplicate.` })

      const existing = byCode.get(codeKey)
      const base = { code, name, categoryId, material: String(r.material ?? "").trim() || null, averageWeight, subscription: truthy(r.subscription), image: String(r.image ?? "").trim() || null, isActive }
      if (existing) {
        if (strategy === "skip") prepared.push({ mode: "skip", ...base })
        else prepared.push({ mode: "update", id: existing.id, ...base })
      } else {
        prepared.push({ mode: "create", ...base })
      }
    })

    const summary = {
      toCreate: prepared.filter((p) => p.mode === "create").length,
      toUpdate: prepared.filter((p) => p.mode === "update").length,
      toSkip: prepared.filter((p) => p.mode === "skip").length,
    }

    // Preview / validation failure → never write.
    if (!b.commit || errors.length) {
      return NextResponse.json({ success: errors.length === 0, preview: true, summary, warnings, errors }, { status: errors.length ? 422 : 200 })
    }

    // Commit — apply create/update (skip = no-op). Codes are immutable, so an
    // update never touches the code.
    let created = 0, updated = 0
    for (const p of prepared) {
      if (p.mode === "skip") continue
      const data = { name: p.name, categoryId: p.categoryId, material: p.material, averageWeight: p.averageWeight, subscriptionIncluded: p.subscription, image: p.image, isActive: p.isActive }
      if (p.mode === "update" && p.id) { await prisma.laundryGarment.update({ where: { id: p.id }, data }); updated++ }
      else { await prisma.laundryGarment.create({ data: { businessId: lbId, code: p.code, ...data } }); created++ }
    }
    return NextResponse.json({ success: true, created, updated, skipped: summary.toSkip, warnings })
  } catch (e) {
    console.error("[laundry-garments-import] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
