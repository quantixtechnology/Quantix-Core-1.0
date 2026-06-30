// PUT / DELETE /api/laundry/pricing/[id]
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const data = await prisma.laundryPricingRule.update({
      where: { id },
      data: {
        ...(b.serviceId !== undefined && { serviceId: b.serviceId || null }),
        ...(b.garmentId !== undefined && { garmentId: b.garmentId || null }),
        ...(b.categoryId !== undefined && { categoryId: b.categoryId || null }),
        ...(b.storeId !== undefined && { storeId: b.storeId || null }),
        ...(b.customerType !== undefined && { customerType: b.customerType || null }),
        ...(b.pricingType !== undefined && { pricingType: b.pricingType }),
        ...(b.price !== undefined && { price: Number(b.price) || 0 }),
        ...(b.gstPercent !== undefined && { gstPercent: Number(b.gstPercent) || 0 }),
        ...(b.minCharge !== undefined && { minCharge: NUM(b.minCharge) }),
        ...(b.maxWeightKg !== undefined && { maxWeightKg: NUM(b.maxWeightKg) }),
        ...(b.extraWeightCharge !== undefined && { extraWeightCharge: NUM(b.extraWeightCharge) }),
        ...(b.weekendPrice !== undefined && { weekendPrice: NUM(b.weekendPrice) }),
        ...(b.expressCharge !== undefined && { expressCharge: NUM(b.expressCharge) }),
        ...(b.pickupCharge !== undefined && { pickupCharge: NUM(b.pickupCharge) }),
        ...(b.deliveryCharge !== undefined && { deliveryCharge: NUM(b.deliveryCharge) }),
        ...(b.effectiveFrom !== undefined && { effectiveFrom: b.effectiveFrom ? new Date(b.effectiveFrom) : null }),
        ...(b.effectiveTo !== undefined && { effectiveTo: b.effectiveTo ? new Date(b.effectiveTo) : null }),
        ...(b.priority !== undefined && { priority: Number(b.priority) || 0 }),
        ...(b.isActive !== undefined && { isActive: !!b.isActive }),
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-pricing] PUT", e)
    return NextResponse.json({ error: "Failed to update pricing rule" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.laundryPricingRule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-pricing] DELETE", e)
    return NextResponse.json({ error: "Failed to delete pricing rule" }, { status: 500 })
  }
}
