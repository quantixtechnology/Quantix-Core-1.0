// GET  /api/laundry/services?businessId=  — list services (with category)
// POST /api/laundry/services               — create service
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { validateProcessFlow } from "@/lib/laundry-processing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [] })
    // Active-only by default so deactivated ("deleted") services never surface in
    // New Order or the Customer App. Management screens pass includeInactive=1.
    const includeInactive = sp.get("includeInactive") === "1"
    const data = await prisma.laundryService.findMany({
      where: { businessId: biz.id, ...(includeInactive ? {} : { isActive: true }) },
      include: {
        category: { select: { id: true, name: true } },
        // Compatible garment-category ids drive the Add Garments default scope.
        compatibleCategories: { select: { categoryId: true } },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })
    // Flatten compatibility to a simple id array for the client.
    const shaped = data.map((s) => ({ ...s, compatibleCategoryIds: s.compatibleCategories.map((c) => c.categoryId) }))
    return NextResponse.json({ success: true, data: shaped })
  } catch (e) {
    console.error("[laundry-services] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId || !b.name?.trim()) return NextResponse.json({ error: "businessId and name are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    // Canonical processing-route validation (same validator as update). The
    // configured route is stored verbatim (QC → PACKED appended); an invalid
    // route is rejected, never silently normalized.
    const flow = validateProcessFlow(b.processFlow)
    if (!flow.ok) return NextResponse.json({ error: flow.error, code: flow.code }, { status: 422 })
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
    const data = await prisma.laundryService.create({
      data: {
        businessId: biz.id,
        name: b.name.trim(),
        code: b.code?.trim() || null,
        categoryId: b.categoryId || null,
        description: b.description?.trim() || null,
        icon: b.icon?.trim() || null,
        image: b.image?.trim() || null,
        color: b.color?.trim() || null,
        defaultPricingType: b.defaultPricingType || "PER_PIECE",
        defaultGstPercent: NUM(b.defaultGstPercent),
        defaultTurnaroundHours: typeof b.defaultTurnaroundHours === "number" ? b.defaultTurnaroundHours : 24,
        // Off by default: a new service uses the standard delivery time until
        // the owner deliberately overrides it.
        tatEnabled: !!b.tatEnabled,
        tatUnit: b.tatUnit === "DAYS" ? "DAYS" : b.tatUnit === "HOURS" ? "HOURS" : null,
        processingSequence: typeof b.processingSequence === "number" ? b.processingSequence : 0,
        expressAvailable: b.expressAvailable ?? false,
        displayOnWebsite: b.displayOnWebsite ?? true,
        availableInStore: b.availableInStore ?? true,
        availableForPickup: b.availableForPickup ?? true,
        subscriptionEligible: b.subscriptionEligible ?? false,
        displayOrder: typeof b.displayOrder === "number" ? b.displayOrder : 0,
        isActive: b.isActive ?? true,
        orderMode: b.orderMode === "BAG" ? "BAG" : "GARMENT",
        processFlow: flow.flow ? JSON.stringify(flow.flow) : null,
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-services] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
