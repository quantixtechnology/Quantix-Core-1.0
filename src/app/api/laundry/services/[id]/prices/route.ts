// Simple per-service price MENU on top of the existing Billing Resolver.
// GET  /api/laundry/services/[id]/prices?businessId=  — current garment price rows
// POST /api/laundry/services/[id]/prices              — one-save bulk upsert
//
// This is an ADMIN UX layer only. It creates/updates the exact same
// LaundryPricingRule records the resolver already uses — one garment-scoped rule
// per (service, garment) with safe defaults: All Customers (customerType null),
// All Stores (storeId null), no category scope, PER_PIECE, ACTIVE, priority 0,
// and an auto internal name "Service · Garment". No wizard, no customer scope,
// no priority. Per-KG services store one service-scoped PER_KG rule instead.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: serviceId } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.pricing.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const service = await prisma.laundryService.findFirst({ where: { id: serviceId, businessId: lbId }, select: { id: true, name: true, defaultPricingType: true } })
    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    const rules = await prisma.laundryPricingRule.findMany({
      where: { businessId: lbId, serviceId, storeId: null, customerType: null, isActive: true },
      orderBy: { updatedAt: "desc" },
    })
    // Per-KG service-level rule (garment null)
    const perKgRule = rules.find((r) => r.garmentId == null && r.pricingType === "PER_KG")
    // Exactly ONE row per garment — most recently updated wins. Defends against any
    // stale duplicate rule (e.g. from a past hard-delete) that could otherwise
    // shadow the saved billing type and make a Per-KG garment read back as Per Piece.
    const seen = new Set<string>()
    const garmentRules = rules.filter((r) => {
      if (r.garmentId == null || seen.has(r.garmentId)) return false
      seen.add(r.garmentId); return true
    })
    // Only ACTIVE garments — a deactivated ("deleted") garment must not appear in
    // the pricing menu even if a stale price rule still references it.
    const garments = await prisma.laundryGarment.findMany({ where: { businessId: lbId, isActive: true, id: { in: garmentRules.map((r) => r.garmentId!) } }, select: { id: true, name: true, category: { select: { name: true } } } })
    const gMap = new Map(garments.map((g) => [g.id, g]))

    // Each garment row carries its OWN billing type (PER_KG | PER_PIECE) + price.
    const rows = garmentRules.filter((r) => gMap.has(r.garmentId!)).map((r) => ({
      garmentId: r.garmentId!, garmentName: gMap.get(r.garmentId!)!.name,
      category: gMap.get(r.garmentId!)!.category?.name || null,
      price: r.price, pricingType: r.pricingType, minWeightKg: r.minWeightKg,
    }))
    return NextResponse.json({ success: true, data: {
      service: { id: service.id, name: service.name },
      // `mode` retained for backward compatibility only; row-level pricingType is
      // authoritative. A legacy service-level PER_KG rule (garment null) surfaces
      // here so it can be migrated to per-garment rows on next save.
      mode: perKgRule ? "PER_KG" : "PER_GARMENT",
      rows,
      perKg: perKgRule ? { price: perKgRule.price, minWeightKg: perKgRule.minWeightKg } : null,
    } })
  } catch (e) {
    console.error("[service-prices] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: serviceId } = await params
    const body = await request.json()
    const { businessId, rows, mode, perKg } = body as {
      businessId?: string
      // New authoritative format: per-garment rows, each with its OWN billing type.
      rows?: { garmentId: string; price: number | string; pricingType?: string; minWeightKg?: number | string | null }[]
      // Legacy format (kept for backward compatibility): global service mode.
      mode?: "PER_GARMENT" | "PER_KG"
      perKg?: { price: number | string; minWeightKg?: number | string | null }
    }
    const guard = await requireLaundryPermission(request, businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const service = await prisma.laundryService.findFirst({ where: { id: serviceId, businessId: lbId }, select: { id: true, name: true } })
    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    const norm = (t?: string) => (String(t || "").toUpperCase() === "PER_KG" ? "PER_KG" : "PER_PIECE")

    // Existing simple rules for this service (garment-scoped + any service-level KG).
    const existing = await prisma.laundryPricingRule.findMany({ where: { businessId: lbId, serviceId, storeId: null, customerType: null, categoryId: null } })

    // ── Legacy global-mode body (no per-row rows) — preserve prior behaviour ────
    const hasRows = Array.isArray(rows)
    if (!hasRows && mode === "PER_KG") {
      await prisma.laundryPricingRule.updateMany({ where: { businessId: lbId, serviceId, storeId: null, customerType: null, garmentId: { not: null } }, data: { isActive: false, status: "INACTIVE" } })
      const price = Number(perKg?.price) || 0
      const minW = perKg?.minWeightKg == null || perKg?.minWeightKg === "" ? null : Number(perKg.minWeightKg)
      const kgRule = existing.find((r) => r.garmentId == null && r.pricingType === "PER_KG")
      if (kgRule) await prisma.laundryPricingRule.update({ where: { id: kgRule.id }, data: { price, minWeightKg: minW, isActive: true, status: "ACTIVE" } })
      else await prisma.laundryPricingRule.create({ data: { businessId: lbId, name: `${service.name} · Per KG`, serviceId, garmentId: null, categoryId: null, storeId: null, customerType: null, pricingType: "PER_KG", price, minWeightKg: minW, gstPercent: 0, priority: 0, status: "ACTIVE", isActive: true } })
      return NextResponse.json({ success: true, data: { upserted: 1 } })
    }

    // ── Authoritative per-garment rows (each with its own billing type) ─────────
    const wanted = new Map((rows || []).map((r) => [r.garmentId, r]))
    const garments = await prisma.laundryGarment.findMany({ where: { businessId: lbId, id: { in: [...wanted.keys()] } }, select: { id: true, name: true } })
    const gName = new Map(garments.map((g) => [g.id, g.name]))
    // Group ALL existing garment rules by garment so duplicates can be collapsed
    // to exactly one ACTIVE rule per (service, garment).
    const byGarment = new Map<string, typeof existing>()
    for (const r of existing) if (r.garmentId) { const a = byGarment.get(r.garmentId) || []; a.push(r); byGarment.set(r.garmentId, a) }

    let upserted = 0
    for (const [garmentId, row] of wanted) {
      const pricingType = norm(row.pricingType)
      const price = Number(row.price) || 0
      const minW = row.minWeightKg == null || row.minWeightKg === "" ? null : Number(row.minWeightKg)
      const dupes = byGarment.get(garmentId) || []
      if (dupes.length > 0) {
        // Keep the first, update it; deactivate the rest (dedupe).
        await prisma.laundryPricingRule.update({ where: { id: dupes[0].id }, data: { price, pricingType, minWeightKg: pricingType === "PER_KG" ? minW : null, isActive: true, status: "ACTIVE" } })
        for (const extra of dupes.slice(1)) await prisma.laundryPricingRule.update({ where: { id: extra.id }, data: { isActive: false, status: "INACTIVE" } })
      } else {
        await prisma.laundryPricingRule.create({ data: { businessId: lbId, name: `${service.name} · ${gName.get(garmentId) || "Garment"}`, serviceId, garmentId, categoryId: null, storeId: null, customerType: null, pricingType, price, minWeightKg: pricingType === "PER_KG" ? minW : null, gstPercent: 0, priority: 0, status: "ACTIVE", isActive: true } })
      }
      upserted++
    }
    // Soft-remove garment rules no longer in the menu.
    for (const [garmentId, dupes] of byGarment) if (!wanted.has(garmentId)) for (const r of dupes) await prisma.laundryPricingRule.update({ where: { id: r.id }, data: { isActive: false, status: "INACTIVE" } })
    // Deactivate any stray service-level PER_KG rule (migrated to per-garment rows).
    for (const r of existing) if (r.garmentId == null && r.pricingType === "PER_KG" && r.isActive) await prisma.laundryPricingRule.update({ where: { id: r.id }, data: { isActive: false, status: "INACTIVE" } })

    return NextResponse.json({ success: true, data: { upserted } })
  } catch (e) {
    console.error("[service-prices] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Save failed" }, { status: 500 })
  }
}
