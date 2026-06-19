import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import { resolveBusinessFromDomain } from "@/lib/tenant-resolver"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string; categoryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { businessId, categoryId } = await params
    
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

    const allowedFields = ["name", "description", "type", "sortOrder", "isActive"]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (updateData.name) {
      updateData.slug = (updateData.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    }

    const category = await prisma.laundryServiceCategory.update({
      where: { id: categoryId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error("Error updating laundry service category:", error)
    return NextResponse.json({ success: false, error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string; categoryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { businessId, categoryId } = await params
    
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

    await prisma.laundryServiceCategory.delete({
      where: { id: categoryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting laundry service category:", error)
    return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 })
  }
}