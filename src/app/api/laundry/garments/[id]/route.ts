// PUT    /api/laundry/garments/[id]  — update
// DELETE /api/laundry/garments/[id]  — delete
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.laundryGarment.findUnique({ where: { id }, select: { businessId: true } })
    if (!existing) return NextResponse.json({ error: "Garment not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, existing.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const { name, categoryId, defaultService, defaultUnit, image, material, careInstructions, barcodePrefix, weightFactor, averageWeight, displayOrder, isActive } = await request.json()
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
    // NOTE: `code` is intentionally NOT updatable — the garment code is immutable
    // once assigned (pricing + history reference garment identity by it).
    const data = await prisma.laundryGarment.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(defaultService !== undefined && { defaultService: defaultService || null }),
        ...(defaultUnit !== undefined && { defaultUnit: defaultUnit === "KG" ? "KG" : "PIECE" }),
        ...(image !== undefined && { image: image?.trim() || null }),
        ...(material !== undefined && { material: material?.trim() || null }),
        ...(careInstructions !== undefined && { careInstructions: careInstructions?.trim() || null }),
        ...(barcodePrefix !== undefined && { barcodePrefix: barcodePrefix?.trim() || null }),
        ...(weightFactor !== undefined && { weightFactor: NUM(weightFactor) }),
        ...(averageWeight !== undefined && { averageWeight: NUM(averageWeight) }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive: !!isActive }),
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-garments] PUT", e)
    return NextResponse.json({ error: "Failed to update garment" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.laundryGarment.findUnique({ where: { id }, select: { businessId: true } })
    if (!existing) return NextResponse.json({ error: "Garment not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, existing.businessId, "laundry.pricing.delete_rules")
    if (!guard.ok) return guard.res
    // A garment referenced by order history must NEVER be destroyed — deactivate
    // it so it disappears from new-order / customer-app / pricing selection while
    // old orders still resolve it (order items carry a garmentName snapshot).
    // Only a garment that has never been ordered may be hard-deleted (its
    // config-only pricing rows go with it — deleted explicitly, never orphaned).
    const orderUses = await prisma.laundryOrderItem.count({ where: { garmentId: id } })
    if (orderUses > 0) {
      const g = await prisma.laundryGarment.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json({ success: true, deactivated: true, reason: "referenced-by-orders", garment: { id: g.id, isActive: g.isActive } })
    }
    await prisma.laundryPricingRule.deleteMany({ where: { garmentId: id } })
    await prisma.laundryGarment.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: true })
  } catch (e) {
    console.error("[laundry-garments] DELETE", e)
    return NextResponse.json({ error: "Failed to delete garment" }, { status: 500 })
  }
}
