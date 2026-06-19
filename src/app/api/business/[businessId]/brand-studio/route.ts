import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import { resolveBusinessFromDomain } from "@/lib/tenant-resolver"

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
    
    // Resolve business from host header or use provided businessId
    let resolvedBusinessId = businessId;
    
    // Try to resolve from host header (for custom domains)
    const host = req.headers.get('host') || '';
    if (host) {
      const resolved = await resolveBusinessFromDomain(host);
      if (resolved) {
        resolvedBusinessId = resolved.business.businessId;
      }
    }
    
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
    
    // Resolve business from host header or use provided businessId
    let resolvedBusinessId = businessId;
    
    // Try to resolve from host header (for custom domains)
    const host = req.headers.get('host') || '';
    if (host) {
      const resolved = await resolveBusinessFromDomain(host);
      if (resolved) {
        resolvedBusinessId = resolved.business.businessId;
      }
    }
    
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

    // Sync branding fields to the Business model so storefront reads them directly
    const syncFields = ["primaryColor", "secondaryColor", "darkMode", "tagline", "logo", "favicon"]
    const businessUpdateData: Record<string, unknown> = {}
    for (const field of syncFields) {
      if (field in body) {
        businessUpdateData[field] = body[field]
      }
    }
    if (Object.keys(businessUpdateData).length > 0) {
      await prisma.business.update({
        where: { businessId: resolvedBusinessId },
        data: businessUpdateData,
      })
    }

    return NextResponse.json({ success: true, data: branding })
  } catch (error) {
    console.error("Error updating branding:", error)
    return NextResponse.json({ success: false, error: "Failed to update branding" }, { status: 500 })
  }
}