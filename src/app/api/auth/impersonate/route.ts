import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isPlatformAdmin) {
      return NextResponse.json({ error: "Unauthorized. Only platform admins can access this." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const platformBusinessId = searchParams.get("businessId")
    if (!platformBusinessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 })
    }

    const platformBusiness = await prisma.business.findUnique({
      where: { id: platformBusinessId },
      select: { id: true, name: true, slug: true, businessType: true, status: true, primaryColor: true, logo: true },
    })

    if (!platformBusiness) {
      return NextResponse.json({ error: "Platform business not found" }, { status: 404 })
    }

    if (platformBusiness.businessType !== "LAUNDRY") {
      return NextResponse.json({ error: "Business is not a Laundry type" }, { status: 400 })
    }

    const laundryBusiness = await prisma.laundryBusiness.findUnique({
      where: { platformBusinessId },
      select: { id: true, businessName: true, status: true, plan: true },
    })

    if (!laundryBusiness) {
      return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      business: {
        businessId: platformBusiness.id,
        businessName: platformBusiness.name,
        businessType: "LAUNDRY",
        businessSlug: platformBusiness.slug,
        role: "CLIENT_OWNER",
        storeId: null,
        permissions: [],
        isPlatformAdmin: false,
        laundryBusinessId: laundryBusiness.id,
        laundryBusinessName: laundryBusiness.businessName,
        laundryStatus: laundryBusiness.status,
        laundryPlan: laundryBusiness.plan,
      },
    })
  } catch (error) {
    console.error("[impersonate] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
