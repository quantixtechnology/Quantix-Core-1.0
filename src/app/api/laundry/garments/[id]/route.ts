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
    const { name, code, categoryId, defaultService, defaultUnit, image, material, careInstructions, barcodePrefix, weightFactor, averageWeight, displayOrder, isActive } = await request.json()
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
    const data = await prisma.laundryGarment.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code?.trim() || null }),
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
    await prisma.laundryGarment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-garments] DELETE", e)
    return NextResponse.json({ error: "Failed to delete garment" }, { status: 500 })
  }
}
