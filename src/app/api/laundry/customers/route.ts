import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { isValidPincode } from "@/lib/india"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, mobile, alternateMobile, email } = body
    // India-format address (backward compatible: legacy `address` → addressLine1).
    const addressLine1 = body.addressLine1 ?? body.address ?? ""
    const { addressLine2, area, landmark, city, state, pincode } = body
    const country = body.country || "India"

    if (!businessId || !name || !mobile) {
      return NextResponse.json({ error: "Missing required fields: businessId, name, mobile" }, { status: 400 })
    }
    if (pincode && !isValidPincode(pincode)) {
      return NextResponse.json({ error: "PIN Code must be a valid 6-digit Indian pincode" }, { status: 400 })
    }

    // Accept either LaundryBusiness.id (owner) or platform Business.id (admin via Open Workspace).
    const laundryBusiness = await resolveLaundryBusiness(businessId)
    const tag = `[cust-create ${Date.now().toString(36)}]`
    console.log(tag, "input.businessId=", businessId, "resolved=", laundryBusiness, "hasAddress=", !!(addressLine1 || area || city || state || pincode))

    if (!laundryBusiness) {
      console.error(tag, "RESOLVE FAILED — no LaundryBusiness matches this id (create aborted)")
      return NextResponse.json({ error: `No laundry workspace matches businessId "${businessId}"` }, { status: 404 })
    }
    if (!laundryBusiness.platformBusinessId) {
      console.error(tag, "TENANT NOT LINKED — LaundryBusiness", laundryBusiness.id, "has null platformBusinessId (create aborted)")
      return NextResponse.json({ error: "Platform business not linked to this workspace" }, { status: 404 })
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

    if (addressLine1 || area || landmark || city || state || pincode) {
      await prisma.address.create({
        data: {
          customerId: customer.id,
          addressLine1: addressLine1 || "",
          addressLine2: addressLine2 || null,
          area: area || null,
          landmark: landmark || null,
          city: city || "",
          state: state || "",
          pincode: pincode || "",
          country,
          isDefault: true,
        },
      })
    }

    console.log(tag, "CREATED customer", customer.id, customer.customerCode, "under platformBusinessId=", laundryBusiness.platformBusinessId)
    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (error) {
    console.error("[laundry-customers] POST Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
