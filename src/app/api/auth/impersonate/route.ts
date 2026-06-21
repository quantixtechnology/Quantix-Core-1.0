import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPlatformRole } from "@/lib/permissions"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    console.log("[impersonate] Session user:", session?.user)
    console.log("[impersonate] Role:", session?.user?.role)
    console.log("[impersonate] isPlatformAdmin:", session?.user?.isPlatformAdmin)
    // Check role directly — session.isPlatformAdmin may be stale from old JWTs
    const role = session?.user?.role
    if (!role || !isPlatformRole(role)) {
      return NextResponse.json({ error: "Unauthorized. Only platform admins can access this." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const platformBusinessId = searchParams.get("businessId")
    const laundryBusinessId = searchParams.get("laundryBusinessId")

    if (!platformBusinessId && !laundryBusinessId) {
      return NextResponse.json({ error: "Missing businessId or laundryBusinessId parameter" }, { status: 400 })
    }

    let platformBusiness: { id: string; name: string; slug: string; businessType: string; status: string; primaryColor: string | null; logo: string | null } | null = null
    let laundryBusiness: { id: string; businessName: string; status: string; plan: string } | null = null

    if (laundryBusinessId) {
      laundryBusiness = await prisma.laundryBusiness.findUnique({
        where: { id: laundryBusinessId },
        select: { id: true, businessName: true, status: true, plan: true, platformBusinessId: true },
      })
      if (!laundryBusiness) {
        return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
      }
      if (laundryBusiness.platformBusinessId) {
        platformBusiness = await prisma.business.findUnique({
          where: { id: laundryBusiness.platformBusinessId },
          select: { id: true, name: true, slug: true, businessType: true, status: true, primaryColor: true, logo: true },
        })
      }
      if (!platformBusiness) {
        // Laundry business exists without a platform link — return what we have
        return NextResponse.json({
          success: true,
          business: {
            businessId: laundryBusiness.id,
            businessName: laundryBusiness.businessName,
            businessType: "LAUNDRY",
            businessSlug: laundryBusiness.id,
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
      }
    } else if (platformBusinessId) {
      platformBusiness = await prisma.business.findUnique({
        where: { id: platformBusinessId },
        select: { id: true, name: true, slug: true, businessType: true, status: true, primaryColor: true, logo: true },
      })
      if (!platformBusiness) {
        return NextResponse.json({ error: "Platform business not found" }, { status: 404 })
      }
      if (platformBusiness.businessType !== "LAUNDRY") {
        return NextResponse.json({ error: "Business is not a Laundry type" }, { status: 400 })
      }
      laundryBusiness = await prisma.laundryBusiness.findUnique({
        where: { platformBusinessId },
        select: { id: true, businessName: true, status: true, plan: true },
      })
      if (!laundryBusiness) {
        return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
      }
    }

    const bizId = platformBusiness?.id || laundryBusiness!.id
    const bizName = platformBusiness?.name || laundryBusiness!.businessName
    const bizSlug = platformBusiness?.slug || laundryBusiness!.id

    return NextResponse.json({
      success: true,
      business: {
        businessId: bizId,
        businessName: bizName,
        businessType: "LAUNDRY",
        businessSlug: bizSlug,
        role: "CLIENT_OWNER",
        storeId: null,
        permissions: [],
        isPlatformAdmin: false,
        laundryBusinessId: laundryBusiness!.id,
        laundryBusinessName: laundryBusiness!.businessName,
        laundryStatus: laundryBusiness!.status,
        laundryPlan: laundryBusiness!.plan,
      },
    })
  } catch (error) {
    console.error("[impersonate] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
