import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { storeName, storeType, contactPerson, mobile, email, address, latitude, longitude, serviceRadiusKm } = body

    const store = await prisma.laundryStore.update({
      where: { id },
      data: {
        ...(storeName !== undefined && { storeName }),
        ...(storeType !== undefined && { storeType }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson || null }),
        ...(mobile !== undefined && { mobile: mobile || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(serviceRadiusKm !== undefined && { serviceRadiusKm: serviceRadiusKm ? parseFloat(serviceRadiusKm) : null }),
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
    await prisma.laundryStore.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting laundry store:", error)
    return NextResponse.json({ error: "Failed to delete laundry store" }, { status: 500 })
  }
}
