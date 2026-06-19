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

    const categories = await prisma.laundryServiceCategory.findMany({
      where: { businessId: resolvedBusinessId },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error("Error fetching laundry services:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch laundry services" }, { status: 500 })
  }
}

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
    const resolvedBusinessId = await getBusinessIdFromRequest(req, businessId)
    if (!resolvedBusinessId) {
      return NextResponse.json({ success: false, error: "Business context required" }, { status: 400 })
    }

    const body = await req.json()
    const { name, description, type, sortOrder, services } = body

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
        services: services?.length
          ? {
              create: services.map((svc: any, idx: number) => ({
                businessId: resolvedBusinessId,
                name: svc.name,
                slug: svc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                description: svc.description,
                price: svc.price ?? 0,
                unitType: svc.unitType ?? "PER_KG",
                turnaroundTime: svc.turnaroundTime ?? "24h",
                sortOrder: idx,
                metadata: svc.metadata ? JSON.stringify(svc.metadata) : "{}",
              })),
            }
          : undefined,
      },
      include: { services: true },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error("Error creating laundry service category:", error)
    return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 })
  }
}