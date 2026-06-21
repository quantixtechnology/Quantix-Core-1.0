import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPlatformRole } from "@/lib/permissions"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const role = session.user.role
    if (!role || !isPlatformRole(role)) {
      return NextResponse.json({ error: "Only platform admins can create support sessions" }, { status: 403 })
    }

    const { laundryBusinessId } = await request.json()
    if (!laundryBusinessId) {
      return NextResponse.json({ error: "laundryBusinessId is required" }, { status: 400 })
    }

    const laundryBusiness = await prisma.laundryBusiness.findUnique({
      where: { id: laundryBusinessId },
      select: { id: true, businessName: true, status: true, plan: true, platformBusinessId: true },
    })

    if (!laundryBusiness) {
      return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    }

    let platformBusiness: { id: string; name: string; slug: string; businessType: string; status: string } | null = null
    if (laundryBusiness.platformBusinessId) {
      platformBusiness = await prisma.business.findUnique({
        where: { id: laundryBusiness.platformBusinessId },
        select: { id: true, name: true, slug: true, businessType: true, status: true },
      })
    }

    return NextResponse.json({
      success: true,
      supportSession: {
        platformAdminId: session.user.id,
        platformAdminName: session.user.name,
        platformAdminRole: session.user.role,
        laundryBusinessId: laundryBusiness.id,
        laundryBusinessName: laundryBusiness.businessName,
        laundryStatus: laundryBusiness.status,
        laundryPlan: laundryBusiness.plan,
        platformBusinessId: platformBusiness?.id || null,
        platformBusinessName: platformBusiness?.name || laundryBusiness.businessName,
        platformBusinessSlug: platformBusiness?.slug || laundryBusiness.id,
      },
    })
  } catch (error) {
    console.error("[support-session] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
