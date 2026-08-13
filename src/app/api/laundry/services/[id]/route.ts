// PUT / DELETE /api/laundry/services/[id]
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { validateProcessFlow } from "@/lib/laundry-processing"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
    // Canonical processing-route validation (shared with create). An invalid
    // route is rejected with INVALID_PROCESS_FLOW — never silently rewritten.
    let flowUpdate: { processFlow: string | null } | undefined
    if (b.processFlow !== undefined) {
      const flow = validateProcessFlow(b.processFlow)
      if (!flow.ok) return NextResponse.json({ error: flow.error, code: flow.code }, { status: 422 })
      flowUpdate = { processFlow: flow.flow ? JSON.stringify(flow.flow) : null }
    }
    const data = await prisma.laundryService.update({
      where: { id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.code !== undefined && { code: b.code?.trim() || null }),
        ...(b.categoryId !== undefined && { categoryId: b.categoryId || null }),
        ...(b.description !== undefined && { description: b.description?.trim() || null }),
        ...(b.icon !== undefined && { icon: b.icon?.trim() || null }),
        ...(b.image !== undefined && { image: b.image?.trim() || null }),
        ...(b.color !== undefined && { color: b.color?.trim() || null }),
        ...(b.defaultPricingType !== undefined && { defaultPricingType: b.defaultPricingType }),
        ...(b.defaultGstPercent !== undefined && { defaultGstPercent: NUM(b.defaultGstPercent) }),
        ...(b.defaultTurnaroundHours !== undefined && { defaultTurnaroundHours: b.defaultTurnaroundHours }),
        ...(b.tatEnabled !== undefined && { tatEnabled: !!b.tatEnabled }),
        ...(b.tatUnit !== undefined && { tatUnit: b.tatUnit === "DAYS" ? "DAYS" : b.tatUnit === "HOURS" ? "HOURS" : null }),
        ...(b.processingSequence !== undefined && { processingSequence: b.processingSequence }),
        ...(b.expressAvailable !== undefined && { expressAvailable: !!b.expressAvailable }),
        ...(b.displayOnWebsite !== undefined && { displayOnWebsite: !!b.displayOnWebsite }),
        ...(b.availableInStore !== undefined && { availableInStore: !!b.availableInStore }),
        ...(b.availableForPickup !== undefined && { availableForPickup: !!b.availableForPickup }),
        ...(b.subscriptionEligible !== undefined && { subscriptionEligible: !!b.subscriptionEligible }),
        ...(b.displayOrder !== undefined && { displayOrder: b.displayOrder }),
        ...(b.isActive !== undefined && { isActive: !!b.isActive }),
        ...(b.orderMode !== undefined && { orderMode: b.orderMode === "BAG" ? "BAG" : "GARMENT" }),
        // Configurable processing route — validated by validateProcessFlow
        // (QC → PACKED appended; STEAM/duplicates/malformed terminals rejected
        // above). null clears the config (engine falls back to the heuristic).
        ...(flowUpdate ?? {}),
      },
    })

    // Service → Compatible Categories was a SECOND answer to "which garments
    // can this service be offered for", alongside Pricing. Two editable answers
    // can disagree, so this one is gone: `compatibleCategoryIds` is no longer
    // read or written, and a client that still sends it is simply ignored.
    // Pricing is the single source of truth — Garment Category → Garment →
    // Service → Price. Existing rows are left untouched (see the note in
    // prisma/schema.prisma on LaundryServiceGarmentCategory).
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-services] PUT", e)
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const svc0 = await prisma.laundryService.findUnique({ where: { id }, select: { businessId: true } })
    if (!svc0) return NextResponse.json({ error: "Service not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, svc0.businessId, "laundry.pricing.delete_rules")
    if (!guard.ok) return guard.res
    // A service referenced by order history must NEVER be destroyed — deactivate
    // it so it disappears from new-order selection while old orders still resolve
    // it (order items carry a serviceName snapshot). Only a service that has
    // never been ordered may be hard-deleted (its pricing config goes with it).
    const orderUses = await prisma.laundryOrderItem.count({ where: { serviceId: id } })
    if (orderUses > 0) {
      const svc = await prisma.laundryService.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json({ success: true, deactivated: true, reason: "referenced-by-orders", service: { id: svc.id, isActive: svc.isActive } })
    }
    // Unused → safe hard delete. Remove its (config-only) pricing rules first.
    await prisma.laundryPricingRule.deleteMany({ where: { serviceId: id } })
    await prisma.laundryService.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: true })
  } catch (e) {
    console.error("[laundry-services] DELETE", e)
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 })
  }
}
