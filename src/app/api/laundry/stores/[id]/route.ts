import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { assertValidStoreLocation } from "@/lib/core/store"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.laundryStore.findUnique({ where: { id }, select: { laundryBusinessId: true } })
    if (!existing) return NextResponse.json({ error: "Store not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, existing.laundryBusinessId, "laundry.stores.edit")
    if (!guard.ok) return guard.res
    const body = await request.json()
    const { storeName, storeType, managerName, mobile, email, address, city, state, pincode, latitude, longitude, googlePlaceId, formattedAddress, serviceRadiusKm, dailyCapacityKg, isActive } = body

    if (latitude !== undefined || longitude !== undefined) {
      assertValidStoreLocation({
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        googlePlaceId: googlePlaceId || null,
      })
    }

    const store = await prisma.laundryStore.update({
      where: { id },
      data: {
        ...(storeName !== undefined && { storeName }),
        ...(storeType !== undefined && { storeType }),
        ...(managerName !== undefined && { managerName: managerName || null }),
        ...(mobile !== undefined && { mobile: mobile || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
        ...(pincode !== undefined && { pincode: pincode || null }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(googlePlaceId !== undefined && { googlePlaceId: googlePlaceId || null }),
        ...(formattedAddress !== undefined && { formattedAddress: formattedAddress || null }),
        ...(serviceRadiusKm !== undefined && { serviceRadiusKm: serviceRadiusKm ? parseFloat(serviceRadiusKm) : null }),
        ...(dailyCapacityKg !== undefined && { dailyCapacityKg: dailyCapacityKg ? parseFloat(dailyCapacityKg) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(store)
  } catch (error) {
    console.error("Error updating laundry store:", error)
    return NextResponse.json({ error: "Failed to update laundry store" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.laundryStore.findUnique({ where: { id }, select: { laundryBusinessId: true } })
    if (!existing) return NextResponse.json({ error: "Store not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, existing.laundryBusinessId, "laundry.stores.delete")
    if (!guard.ok) return guard.res
    await prisma.laundryStore.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting laundry store:", error)
    return NextResponse.json({ error: "Failed to delete laundry store" }, { status: 500 })
  }
}
