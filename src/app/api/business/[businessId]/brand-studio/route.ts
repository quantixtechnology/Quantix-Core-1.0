import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBusinessIdFromRequest } from "@/lib/api-utils"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { businessId } = await params
    const resolvedBusinessId = await getBusinessIdFromRequest(req, businessId)
    if (!resolvedBusinessId) {
      return NextResponse.json({ success: false, error: "Business context required" }, { status: 400 })
    }

    const branding = await prisma.businessBranding.findUnique({
      where: { businessId: resolvedBusinessId },
    })

    if (!branding) {
      const newBranding = await prisma.businessBranding.create({
        data: { businessId: resolvedBusinessId },
      })
      return NextResponse.json({ success: true, data: newBranding })
    }

    return NextResponse.json({ success: true, data: branding })
  } catch (error) {
    console.error("Error fetching branding:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch branding" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { businessId } = await params
    const resolvedBusinessId = await getBusinessIdFromRequest(req, businessId)
    if (!resolvedBusinessId) {
      return NextResponse.json({ success: false, error: "Business context required" }, { status: 400 })
    }

    const body = await req.json()

    const allowedFields = [
      "primaryColor", "secondaryColor", "accentColor", "textColor", "backgroundColor",
      "logo", "favicon", "coverImage", "appIcon", "secondaryLogo", "watermarkLogo",
      "fontFamily", "headingStyle", "buttonStyle", "borderRadius", "darkMode",
      "customCss", "theme", "tagline"
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    const branding = await prisma.businessBranding.upsert({
      where: { businessId: resolvedBusinessId },
      update: updateData,
      create: { businessId: resolvedBusinessId, ...updateData },
    })

    return NextResponse.json({ success: true, data: branding })
  } catch (error) {
    console.error("Error updating branding:", error)
    return NextResponse.json({ success: false, error: "Failed to update branding" }, { status: 500 })
  }
}