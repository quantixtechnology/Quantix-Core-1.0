// POST /api/laundry/masters/bulk-import
// Loads master data in one call — a built-in template or a custom payload
// (e.g. from an Excel/CSV paste). Creates Categories → Services → Garments,
// linking garments/services to categories by name. Dedupes by name
// (case-insensitive) so importing twice never creates duplicates.
//
// Body: { businessId, template?: "STANDARD",
//         data?: { categories?[], services?[], garments?[] } }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { getTemplate, type TemplateCategory, type TemplateService, type TemplateGarment } from "@/lib/laundry-templates"

export const runtime = "nodejs"

const key = (s: string) => s.trim().toLowerCase()

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const businessId = biz.id

    let categories: TemplateCategory[] = []
    let services: TemplateService[] = []
    let garments: TemplateGarment[] = []

    if (b.template) {
      const t = getTemplate(b.template)
      if (!t) return NextResponse.json({ error: "Unknown template" }, { status: 400 })
      categories = t.categories; services = t.services; garments = t.garments
    } else if (b.data) {
      categories = Array.isArray(b.data.categories) ? b.data.categories : []
      services = Array.isArray(b.data.services) ? b.data.services : []
      garments = Array.isArray(b.data.garments) ? b.data.garments : []
    } else {
      return NextResponse.json({ error: "Provide a template or data" }, { status: 400 })
    }

    const result = { categoriesCreated: 0, servicesCreated: 0, garmentsCreated: 0, skipped: 0 }

    // ── Categories ──
    const existingCats = await prisma.laundryCategory.findMany({ where: { businessId }, select: { id: true, name: true } })
    const catByName = new Map(existingCats.map((c) => [key(c.name), c.id]))
    for (const c of categories) {
      if (!c?.name?.trim()) continue
      if (catByName.has(key(c.name))) { result.skipped++; continue }
      const created = await prisma.laundryCategory.create({
        data: {
          businessId, name: c.name.trim(), code: c.code || null, color: c.color || null,
          defaultGstPercent: c.defaultGstPercent ?? null, displayOrder: c.displayOrder ?? 0,
        },
        select: { id: true, name: true },
      })
      catByName.set(key(created.name), created.id)
      result.categoriesCreated++
    }

    // ── Services ──
    const existingSvcs = await prisma.laundryService.findMany({ where: { businessId }, select: { name: true } })
    const svcNames = new Set(existingSvcs.map((s) => key(s.name)))
    for (const s of services) {
      if (!s?.name?.trim()) continue
      if (svcNames.has(key(s.name))) { result.skipped++; continue }
      await prisma.laundryService.create({
        data: {
          businessId, name: s.name.trim(), code: s.code || null,
          categoryId: s.category ? catByName.get(key(s.category)) ?? null : null,
          defaultPricingType: s.defaultPricingType || "PER_PIECE",
          defaultTurnaroundHours: s.defaultTurnaroundHours ?? 24,
          expressAvailable: s.expressAvailable ?? false,
          subscriptionEligible: s.subscriptionEligible ?? false,
          displayOrder: s.displayOrder ?? 0,
        },
      })
      svcNames.add(key(s.name))
      result.servicesCreated++
    }

    // ── Garments ──
    const existingGarments = await prisma.laundryGarment.findMany({ where: { businessId }, select: { name: true } })
    const grmNames = new Set(existingGarments.map((g) => key(g.name)))
    for (const g of garments) {
      if (!g?.name?.trim()) continue
      if (grmNames.has(key(g.name))) { result.skipped++; continue }
      await prisma.laundryGarment.create({
        data: {
          businessId, name: g.name.trim(), code: g.code || null,
          categoryId: g.category ? catByName.get(key(g.category)) ?? null : null,
          defaultUnit: g.defaultUnit || "PIECE",
          averageWeight: g.averageWeight ?? null, material: g.material || null,
          displayOrder: g.displayOrder ?? 0,
        },
      })
      grmNames.add(key(g.name))
      result.garmentsCreated++
    }

    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error("[laundry-masters/bulk-import] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
