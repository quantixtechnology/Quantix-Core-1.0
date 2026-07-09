// PUT / DELETE /api/laundry/services/[id]
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizeFlow, ROUTE_STAGES } from "@/lib/laundry-processing"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
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
        ...(b.processingSequence !== undefined && { processingSequence: b.processingSequence }),
        ...(b.expressAvailable !== undefined && { expressAvailable: !!b.expressAvailable }),
        ...(b.displayOnWebsite !== undefined && { displayOnWebsite: !!b.displayOnWebsite }),
        ...(b.availableInStore !== undefined && { availableInStore: !!b.availableInStore }),
        ...(b.availableForPickup !== undefined && { availableForPickup: !!b.availableForPickup }),
        ...(b.subscriptionEligible !== undefined && { subscriptionEligible: !!b.subscriptionEligible }),
        ...(b.displayOrder !== undefined && { displayOrder: b.displayOrder }),
        ...(b.isActive !== undefined && { isActive: !!b.isActive }),
        // Configurable processing route: array of stage codes (validated
        // against stable stage keys); QC → PACKED terminals are enforced.
        // null clears the config (engine falls back to the name heuristic).
        ...(b.processFlow !== undefined && {
          processFlow: Array.isArray(b.processFlow) && b.processFlow.length
            ? JSON.stringify(normalizeFlow(b.processFlow.map(String).filter((s: string) => (ROUTE_STAGES as readonly string[]).includes(s))))
            : null,
        }),
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-services] PUT", e)
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.laundryService.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-services] DELETE", e)
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 })
  }
}
