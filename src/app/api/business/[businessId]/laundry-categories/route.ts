import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import { resolveBusinessFromDomain } from "@/lib/tenant-resolver"

export async function POST(
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
    const { name, description, type, sortOrder } = body

    if (!name || !type) {
      return NextResponse.json({ success: false, error: "Name and type are required" }, { status: 400 })
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

    const existingCategory = await prisma.laundryServiceCategory.findUnique({
      where: { businessId_slug: { businessId: resolvedBusinessId, slug } },
    })

    if (existingCategory) {
      return NextResponse.json({ success: false, error: "Category with this name already exists" }, { status: 400 })
    }

    const category = await prisma.laundryServiceCategory.create({
      data: {
        businessId: resolvedBusinessId,
        name,
        slug,
        description,
        type,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error("Error creating laundry service category:", error)
    return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 })
  }
}