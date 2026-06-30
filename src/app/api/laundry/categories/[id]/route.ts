// PUT    /api/laundry/categories/[id]  — update
// DELETE /api/laundry/categories/[id]  — delete
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, code, description, color, icon, image, defaultGstPercent, displayOnWebsite, displayInPOS, displayInApp, displayOrder, isActive } = await request.json()
    const NUM = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
    const data = await prisma.laundryCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(description !== undefined && { description: description || null }),
        ...(color !== undefined && { color: color?.trim() || null }),
        ...(icon !== undefined && { icon: icon?.trim() || null }),
        ...(image !== undefined && { image: image?.trim() || null }),
        ...(defaultGstPercent !== undefined && { defaultGstPercent: NUM(defaultGstPercent) }),
        ...(displayOnWebsite !== undefined && { displayOnWebsite: !!displayOnWebsite }),
        ...(displayInPOS !== undefined && { displayInPOS: !!displayInPOS }),
        ...(displayInApp !== undefined && { displayInApp: !!displayInApp }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive: !!isActive }),
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-categories] PUT", e)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.laundryCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-categories] DELETE", e)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
