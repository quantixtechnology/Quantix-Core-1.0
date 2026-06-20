import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const SYSTEM_STAGE_CODES = [
  "STORE_ORDER_CREATED",
  "STORE_AUDIT",
  "READY_FOR_PROCESSING",
  "IN_TRANSIT_TO_PROCESSING",
  "PROCESSING_ENTRY_AUDIT",
  "BARCODE_TAGGING",
  "WASHING",
  "DRYING",
  "IRONING",
  "FOLDING",
  "PACKING",
  "READY_FOR_STORE_DISPATCH",
  "IN_TRANSIT_TO_STORE",
  "READY_FOR_DELIVERY",
  "DELIVERED",
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const plan = searchParams.get("plan") || ""

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { businessCode: { contains: search } },
        { ownerName: { contains: search } },
        { mobile: { contains: search } },
      ]
    }
    if (status) where.status = status
    if (plan) where.plan = plan

    const businesses = await prisma.laundryBusiness.findMany({
      where,
      include: { _count: { select: { stores: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(businesses)
  } catch (error) {
    console.error("Error fetching laundry businesses:", error)
    return NextResponse.json({ error: "Failed to fetch laundry businesses" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessName, legalName, ownerName, mobile, email, gstNumber, logo, favicon, address, plan, status } = body

    if (!businessName || !ownerName || !mobile) {
      return NextResponse.json({ error: "Business name, owner name, and mobile are required" }, { status: 400 })
    }

    const code = businessName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 20) || "BIZ"

    const business = await prisma.laundryBusiness.create({
      data: {
        businessCode: code,
        businessName,
        legalName: legalName || null,
        ownerName,
        mobile,
        email: email || null,
        gstNumber: gstNumber || null,
        logo: logo || null,
        favicon: favicon || null,
        address: address || null,
        plan: plan || "STANDARD",
        status: status || "ONBOARDING",
      },
    })

    // Auto-create workflow configurations for all system stages
    const systemStages = await prisma.laundryWorkflowStage.findMany({
      where: { code: { in: SYSTEM_STAGE_CODES } },
      orderBy: { sequence: "asc" },
    })

    for (const stage of systemStages) {
      await prisma.laundryWorkflowConfiguration.create({
        data: {
          businessId: business.id,
          stageId: stage.id,
          enabled: true,
          sequence: stage.sequence,
        },
      })
    }

    return NextResponse.json(business, { status: 201 })
  } catch (error) {
    console.error("Error creating laundry business:", error)
    return NextResponse.json({ error: "Failed to create laundry business" }, { status: 500 })
  }
}
