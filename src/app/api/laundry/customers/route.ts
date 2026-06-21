import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, mobile, alternateMobile, email, address, area, landmark } = body

    if (!businessId || !name || !mobile) {
      return NextResponse.json({ error: "Missing required fields: businessId, name, mobile" }, { status: 400 })
    }

    const laundryBusiness = await prisma.laundryBusiness.findUnique({
      where: { id: businessId },
      select: { platformBusinessId: true },
    })

    if (!laundryBusiness?.platformBusinessId) {
      return NextResponse.json({ error: "Platform business not linked" }, { status: 404 })
    }

    const existing = await prisma.customer.findFirst({
      where: { businessId: laundryBusiness.platformBusinessId, phone: mobile },
    })
    if (existing) {
      return NextResponse.json({ error: "Customer with this mobile number already exists", data: existing }, { status: 409 })
    }

    const monthPrefix = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`
    const prefix = `CUS-${monthPrefix}-`
    const last = await prisma.customer.findFirst({
      where: { customerCode: { startsWith: prefix } },
      orderBy: { customerCode: "desc" },
      select: { customerCode: true },
    })
    let nextSeq = 1
    if (last?.customerCode) {
      const parts = last.customerCode.split("-")
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1
    }
    const customerCode = `${prefix}${String(nextSeq).padStart(4, "0")}`

    const customer = await prisma.customer.create({
      data: {
        businessId: laundryBusiness.platformBusinessId,
        name,
        phone: mobile,
        email: email || null,
        customerCode,
        source: "LAUNDRY_OS",
        isGuest: false,
        notes: alternateMobile ? `Alternate Mobile: ${alternateMobile}` : "",
      },
    })

    if (address || area || landmark) {
      await prisma.address.create({
        data: {
          customerId: customer.id,
          addressLine1: address || "",
          area: area || null,
          landmark: landmark || null,
          city: "",
          state: "",
          pincode: "",
          isDefault: true,
        },
      })
    }

    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (error) {
    console.error("[laundry-customers] POST Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
