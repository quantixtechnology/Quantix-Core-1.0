// PUT / DELETE /api/laundry/services/[id]
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const data = await prisma.laundryService.update({
      where: { id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.categoryId !== undefined && { categoryId: b.categoryId || null }),
        ...(b.defaultTurnaroundHours !== undefined && { defaultTurnaroundHours: b.defaultTurnaroundHours }),
        ...(b.displayOnWebsite !== undefined && { displayOnWebsite: !!b.displayOnWebsite }),
        ...(b.availableInStore !== undefined && { availableInStore: !!b.availableInStore }),
        ...(b.availableForPickup !== undefined && { availableForPickup: !!b.availableForPickup }),
        ...(b.subscriptionEligible !== undefined && { subscriptionEligible: !!b.subscriptionEligible }),
        ...(b.displayOrder !== undefined && { displayOrder: b.displayOrder }),
        ...(b.isActive !== undefined && { isActive: !!b.isActive }),
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
