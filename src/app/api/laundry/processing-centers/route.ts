import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateProcessingCenterCode } from "@/lib/laundry-codes"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")

    const where: Record<string, unknown> = {}
    if (businessId) where.businessId = businessId

    const centers = await prisma.laundryProcessingCenter.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(centers)
  } catch (error) {
    console.error("Error fetching processing centers:", error)
    return NextResponse.json({ error: "Failed to fetch processing centers" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, centerName, centerType, managerName, mobile, email, address, city, state, pincode, latitude, longitude, dailyCapacityKg } = body

    if (!businessId || !centerName) {
      return NextResponse.json({ error: "Business ID and center name are required" }, { status: 400 })
    }

    const business = await prisma.laundryBusiness.findUnique({
      where: { id: businessId },
      select: { businessCode: true },
    })
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    const centerCode = await generateProcessingCenterCode(business.businessCode)

    const center = await prisma.laundryProcessingCenter.create({
      data: {
        centerCode,
        businessId,
        centerName,
        centerType: centerType || "PROCESSING_HUB",
        managerName: managerName || null,
        mobile: mobile || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        dailyCapacityKg: dailyCapacityKg ? parseFloat(dailyCapacityKg) : null,
      },
    })

    return NextResponse.json(center, { status: 201 })
  } catch (error) {
    console.error("Error creating processing center:", error)
    return NextResponse.json({ error: "Failed to create processing center" }, { status: 500 })
  }
}
