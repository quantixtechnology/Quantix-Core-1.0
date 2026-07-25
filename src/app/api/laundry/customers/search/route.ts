import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

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
    const permGuard = await requireLaundryPermission(request, businessId, "laundry.customers.view")
    if (!permGuard.ok) return permGuard.res

    const laundryBusiness = await resolveLaundryBusiness(businessId)
    const tag = `[cust-search ${Date.now().toString(36)}]`
    console.log(tag, "input.businessId=", businessId, "resolved=", laundryBusiness, "q=", JSON.stringify(query))

    if (!laundryBusiness?.platformBusinessId) {
      console.error(tag, "TENANT NOT RESOLVED/LINKED (search aborted)")
      return NextResponse.json({ error: "Platform business not linked" }, { status: 404 })
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId: laundryBusiness.platformBusinessId,
        // Archived ("deleted") customers must never surface in New Order lookup.
        isActive: true,
        status: { not: "ARCHIVED" },
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
        addresses: { orderBy: { isDefault: "desc" }, take: 1, select: { addressLine1: true, addressLine2: true, area: true, landmark: true, city: true, state: true, pincode: true, country: true } },
        loyaltyTier: true,
        walletBalance: true,
        customerCode: true,
        totalOrders: true,
        accountType: true, // RETAIL | CORPORATE — drives the New Order payment preference default
      },
      take: limit,
      orderBy: { name: "asc" },
    })

    console.log(tag, "platformBusinessId=", laundryBusiness.platformBusinessId, "→", customers.length, "result(s)")
    return NextResponse.json({ success: true, data: customers })
  } catch (error) {
    console.error("[laundry-customers-search] GET Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
