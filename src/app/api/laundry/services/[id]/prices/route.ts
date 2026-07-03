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
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: serviceId } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const service = await prisma.laundryService.findFirst({ where: { id: serviceId, businessId: lbId }, select: { id: true, name: true, defaultPricingType: true } })
    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    const rules = await prisma.laundryPricingRule.findMany({
      where: { businessId: lbId, serviceId, storeId: null, customerType: null, isActive: true },
    })
    // Per-KG service-level rule (garment null)
    const perKgRule = rules.find((r) => r.garmentId == null && r.pricingType === "PER_KG")
    const garmentRules = rules.filter((r) => r.garmentId != null)
    const garments = await prisma.laundryGarment.findMany({ where: { businessId: lbId, id: { in: garmentRules.map((r) => r.garmentId!) } }, select: { id: true, name: true, category: { select: { name: true } } } })
    const gMap = new Map(garments.map((g) => [g.id, g]))

    const rows = garmentRules.map((r) => ({ garmentId: r.garmentId!, garmentName: gMap.get(r.garmentId!)?.name || "Garment", category: gMap.get(r.garmentId!)?.category?.name || null, price: r.price, pricingType: r.pricingType }))
    return NextResponse.json({ success: true, data: {
      service: { id: service.id, name: service.name },
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
    const { businessId, mode, rows, perKg } = body as {
      businessId?: string; mode?: "PER_GARMENT" | "PER_KG"
      rows?: { garmentId: string; price: number | string }[]
      perKg?: { price: number | string; minWeightKg?: number | string | null }
    }
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const service = await prisma.laundryService.findFirst({ where: { id: serviceId, businessId: lbId }, select: { id: true, name: true } })
    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    // Existing simple rules for this service (garment-scoped + service-level KG).
    const existing = await prisma.laundryPricingRule.findMany({ where: { businessId: lbId, serviceId, storeId: null, customerType: null, categoryId: null } })

    let upserted = 0
    if (mode === "PER_KG") {
      // Deactivate garment rows; keep/one service-level PER_KG rule.
      await prisma.laundryPricingRule.updateMany({ where: { businessId: lbId, serviceId, storeId: null, customerType: null, garmentId: { not: null } }, data: { isActive: false, status: "INACTIVE" } })
      const price = Number(perKg?.price) || 0
      const minW = perKg?.minWeightKg == null || perKg?.minWeightKg === "" ? null : Number(perKg.minWeightKg)
      const kgRule = existing.find((r) => r.garmentId == null && r.pricingType === "PER_KG")
      if (kgRule) await prisma.laundryPricingRule.update({ where: { id: kgRule.id }, data: { price, minWeightKg: minW, isActive: true, status: "ACTIVE" } })
      else await prisma.laundryPricingRule.create({ data: { businessId: lbId, name: `${service.name} · Per KG`, serviceId, garmentId: null, categoryId: null, storeId: null, customerType: null, pricingType: "PER_KG", price, minWeightKg: minW, gstPercent: 0, priority: 0, status: "ACTIVE", isActive: true } })
      upserted = 1
    } else {
      const wanted = new Map((rows || []).map((r) => [r.garmentId, Number(r.price) || 0]))
      const garments = await prisma.laundryGarment.findMany({ where: { businessId: lbId, id: { in: [...wanted.keys()] } }, select: { id: true, name: true } })
      const gName = new Map(garments.map((g) => [g.id, g.name]))
      const existByGarment = new Map(existing.filter((r) => r.garmentId).map((r) => [r.garmentId!, r]))
      for (const [garmentId, price] of wanted) {
        const cur = existByGarment.get(garmentId)
        if (cur) await prisma.laundryPricingRule.update({ where: { id: cur.id }, data: { price, pricingType: "PER_PIECE", isActive: true, status: "ACTIVE" } })
        else await prisma.laundryPricingRule.create({ data: { businessId: lbId, name: `${service.name} · ${gName.get(garmentId) || "Garment"}`, serviceId, garmentId, categoryId: null, storeId: null, customerType: null, pricingType: "PER_PIECE", price, gstPercent: 0, priority: 0, status: "ACTIVE", isActive: true } })
        upserted++
      }
      // Soft-remove garment rules that are no longer in the menu.
      for (const [garmentId, rule] of existByGarment) if (!wanted.has(garmentId)) await prisma.laundryPricingRule.update({ where: { id: rule.id }, data: { isActive: false, status: "INACTIVE" } })
      // Deactivate any stray PER_KG service rule when switching to per-garment.
      const kgRule = existing.find((r) => r.garmentId == null && r.pricingType === "PER_KG")
      if (kgRule) await prisma.laundryPricingRule.update({ where: { id: kgRule.id }, data: { isActive: false, status: "INACTIVE" } })
    }

    return NextResponse.json({ success: true, data: { upserted } })
  } catch (e) {
    console.error("[service-prices] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Save failed" }, { status: 500 })
  }
}
