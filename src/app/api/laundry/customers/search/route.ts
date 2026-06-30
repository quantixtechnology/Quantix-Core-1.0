import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const query = searchParams.get("q") || ""
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 })
    }

    const laundryBusiness = await resolveLaundryBusiness(businessId)

    if (!laundryBusiness?.platformBusinessId) {
      return NextResponse.json({ error: "Platform business not linked" }, { status: 404 })
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId: laundryBusiness.platformBusinessId,
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { customerCode: { contains: query } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        addresses: { where: { isDefault: true }, take: 1, select: { addressLine1: true, city: true } },
        loyaltyTier: true,
        walletBalance: true,
        customerCode: true,
        totalOrders: true,
      },
      take: limit,
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: customers })
  } catch (error) {
    console.error("[laundry-customers-search] GET Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
