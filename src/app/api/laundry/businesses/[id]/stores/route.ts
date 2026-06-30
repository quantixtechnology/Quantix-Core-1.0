import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateStoreCode } from "@/lib/laundry-codes"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Accept either LaundryBusiness.id or the platform Business.id.
    const resolved = await resolveLaundryBusiness(id)
    const stores = resolved ? await prisma.laundryStore.findMany({
      where: { laundryBusinessId: resolved.id },
      orderBy: { createdAt: "desc" },
    }) : []
    return NextResponse.json(stores)
  } catch (error) {
    console.error("Error fetching laundry stores:", error)
    return NextResponse.json({ error: "Failed to fetch laundry stores" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { storeName, storeType, managerName, mobile, email, address, city, state, pincode, latitude, longitude, serviceRadiusKm, dailyCapacityKg, isActive } = body

    if (!storeName) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 })
    }

    const business = await prisma.laundryBusiness.findUnique({
      where: { id },
      select: { businessCode: true },
    })
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    const limits = await prisma.laundryScalingLimit.findUnique({ where: { businessId: id } })
    if (limits && limits.storesUsed >= limits.storesAllowed) {
      return NextResponse.json({ error: `Store limit reached (${limits.storesAllowed}). Contact Quantix to increase capacity.` }, { status: 403 })
    }

    const storeCode = await generateStoreCode(business.businessCode)

    const store = await prisma.laundryStore.create({
      data: {
        storeCode,
        laundryBusinessId: id,
        storeName,
        storeType: storeType || "RETAIL_STORE",
        managerName: managerName || null,
        mobile: mobile || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        serviceRadiusKm: serviceRadiusKm ? parseFloat(serviceRadiusKm) : null,
        dailyCapacityKg: dailyCapacityKg ? parseFloat(dailyCapacityKg) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    await prisma.laundryScalingLimit.update({
      where: { businessId: id },
      data: { storesUsed: { increment: 1 } },
    })

    return NextResponse.json(store, { status: 201 })
  } catch (error) {
    console.error("Error creating laundry store:", error)
    return NextResponse.json({ error: "Failed to create laundry store" }, { status: 500 })
  }
}
