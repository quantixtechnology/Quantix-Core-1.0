import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await prisma.laundryBusiness.findUnique({
      where: { id },
      include: { stores: { orderBy: { createdAt: "desc" } } },
    })
    if (!business) {
      return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    }
    return NextResponse.json(business)
  } catch (error) {
    console.error("Error fetching laundry business:", error)
    return NextResponse.json({ error: "Failed to fetch laundry business" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { businessName, legalName, ownerName, mobile, email, gstNumber, logo, favicon, address, plan, status } = body

    const business = await prisma.laundryBusiness.update({
      where: { id },
      data: {
        ...(businessName !== undefined && { businessName }),
        ...(legalName !== undefined && { legalName: legalName || null }),
        ...(ownerName !== undefined && { ownerName }),
        ...(mobile !== undefined && { mobile }),
        ...(email !== undefined && { email: email || null }),
        ...(gstNumber !== undefined && { gstNumber: gstNumber || null }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(favicon !== undefined && { favicon: favicon || null }),
        ...(address !== undefined && { address: address || null }),
        ...(plan !== undefined && { plan }),
        ...(status !== undefined && { status }),
      },
    })

    return NextResponse.json(business)
  } catch (error) {
    console.error("Error updating laundry business:", error)
    return NextResponse.json({ error: "Failed to update laundry business" }, { status: 500 })
  }
}
