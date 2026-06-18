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

    const config = await prisma.qRPaymentConfig.findUnique({
      where: { businessId: resolvedBusinessId },
    })

    if (!config) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error("Error fetching QR payment config:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch QR payment config" }, { status: 500 })
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
      "upiId", "qrCode", "dynamicQREnabled", "codEnabled", "outstandingQR", "metadata"
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = field === "metadata" ? JSON.stringify(body[field]) : body[field]
      }
    }

    const config = await prisma.qRPaymentConfig.upsert({
      where: { businessId: resolvedBusinessId },
      update: updateData,
      create: { businessId: resolvedBusinessId, ...updateData },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error("Error updating QR payment config:", error)
    return NextResponse.json({ success: false, error: "Failed to update QR payment config" }, { status: 500 })
  }
}