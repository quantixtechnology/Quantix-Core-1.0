import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { centerName, centerType, managerName, mobile, email, address, city, state, pincode, latitude, longitude, dailyCapacityKg, isActive } = body

    const existing = await prisma.laundryProcessingCenter.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Processing center not found" }, { status: 404 })
    }
    const guard = await requireLaundryPermission(request, existing.businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res

    const center = await prisma.laundryProcessingCenter.update({
      where: { id },
      data: {
        ...(centerName !== undefined && { centerName }),
        ...(centerType !== undefined && { centerType }),
        ...(managerName !== undefined && { managerName: managerName || null }),
        ...(mobile !== undefined && { mobile: mobile || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
        ...(pincode !== undefined && { pincode: pincode || null }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(dailyCapacityKg !== undefined && { dailyCapacityKg: dailyCapacityKg ? parseFloat(dailyCapacityKg) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(center)
  } catch (error) {
    console.error("Error updating processing center:", error)
    return NextResponse.json({ error: "Failed to update processing center" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.laundryProcessingCenter.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Processing center not found" }, { status: 404 })
    }
    const guard = await requireLaundryPermission(request, existing.businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res

    await prisma.laundryProcessingCenter.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting processing center:", error)
    return NextResponse.json({ error: "Failed to delete processing center" }, { status: 500 })
  }
}
