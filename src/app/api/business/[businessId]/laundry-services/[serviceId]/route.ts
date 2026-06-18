import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBusinessIdFromRequest } from "@/lib/api-utils"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string; serviceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { businessId, serviceId } = await params
    const resolvedBusinessId = await getBusinessIdFromRequest(req, businessId)
    if (!resolvedBusinessId) {
      return NextResponse.json({ success: false, error: "Business context required" }, { status: 400 })
    }

    const body = await req.json()

    const allowedFields = [
      "name", "description", "price", "unitType", "turnaroundTime",
      "isActive", "sortOrder", "metadata"
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = field === "metadata" ? JSON.stringify(body[field]) : body[field]
      }
    }

    const service = await prisma.laundryService.update({
      where: { id: serviceId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: service })
  } catch (error) {
    console.error("Error updating laundry service:", error)
    return NextResponse.json({ success: false, error: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string; serviceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { businessId, serviceId } = await params
    const resolvedBusinessId = await getBusinessIdFromRequest(req, businessId)
    if (!resolvedBusinessId) {
      return NextResponse.json({ success: false, error: "Business context required" }, { status: 400 })
    }

    await prisma.laundryService.delete({
      where: { id: serviceId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting laundry service:", error)
    return NextResponse.json({ success: false, error: "Failed to delete service" }, { status: 500 })
  }
}