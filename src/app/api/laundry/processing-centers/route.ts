import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateProcessingCenterCode } from "@/lib/laundry-codes"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    // Accept either LaundryBusiness.id or the platform Business.id.
    const resolved = businessId ? await resolveLaundryBusiness(businessId) : null
    const centers = resolved
      ? await prisma.laundryProcessingCenter.findMany({ where: { businessId: resolved.id }, orderBy: { createdAt: "desc" } })
      : []
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

    // Resolve tenant (self-healing) — same as Stores/Services.
    const resolved = await resolveLaundryBusiness(businessId)
    if (!resolved) {
      return NextResponse.json({ error: `No laundry workspace matches businessId "${businessId}"` }, { status: 404 })
    }
    const laundryBusinessId = resolved.id

    const business = await prisma.laundryBusiness.findUnique({
      where: { id: laundryBusinessId },
      select: { businessCode: true },
    })
    if (!business) {
      return NextResponse.json({ error: "Laundry workspace not found" }, { status: 404 })
    }

    const limits = await prisma.laundryScalingLimit.findUnique({ where: { businessId: laundryBusinessId } })
    if (limits && limits.processingCentersUsed >= limits.processingCentersAllowed) {
      return NextResponse.json({ error: `Processing center limit reached (${limits.processingCentersAllowed}). Contact Quantix to increase capacity.` }, { status: 403 })
    }

    const centerCode = await generateProcessingCenterCode(business.businessCode)

    const center = await prisma.laundryProcessingCenter.create({
      data: {
        centerCode,
        businessId: laundryBusinessId,
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

    // Safe increment — never fails the create if no scaling-limit row exists.
    await prisma.laundryScalingLimit.updateMany({
      where: { businessId: laundryBusinessId },
      data: { processingCentersUsed: { increment: 1 } },
    })

    return NextResponse.json(center, { status: 201 })
  } catch (error) {
    console.error("Error creating processing center:", error)
    return NextResponse.json({ error: "Failed to create processing center" }, { status: 500 })
  }
}
