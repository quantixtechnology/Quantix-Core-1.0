import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { isValidPincode } from "@/lib/india"
import { generateCustomerCode } from "@/lib/laundry-codes"

export const runtime = "nodejs"

// GET /api/laundry/customers?businessId=&q=&limit=&offset=  — paginated listing
// with per-customer KPIs (orders, lifetime value, wallet, membership, status).
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const q = (sp.get("q") || "").trim()
    const limit = Math.min(parseInt(sp.get("limit") || "10"), 100)
    const offset = parseInt(sp.get("offset") || "0")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ success: true, data: [], total: 0 })

    const where: Record<string, unknown> = { businessId: biz.platformBusinessId }
    if (q) where.OR = [{ name: { contains: q } }, { phone: { contains: q } }, { customerCode: { contains: q } }, { email: { contains: q } }]

    const [rows, total, totalCustomers, activeCustomers, activeMemberships] = await Promise.all([
      prisma.customer.findMany({
        where: where as never,
        select: {
          id: true, name: true, phone: true, email: true, customerCode: true,
          loyaltyTier: true, walletBalance: true, totalOrders: true, totalSpent: true,
          status: true, isActive: true, lastOrderAt: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit, skip: offset,
      }),
      prisma.customer.count({ where: where as never }),
      prisma.customer.count({ where: { businessId: biz.platformBusinessId } }),
      prisma.customer.count({ where: { businessId: biz.platformBusinessId, isActive: true } }),
      // Real count of customers with an ACTIVE subscription — not a page count,
      // not fabricated. Read-only; does not touch subscription logic.
      prisma.customerSubscription.count({ where: { businessId: biz.platformBusinessId, status: "ACTIVE" } }),
    ])
    return NextResponse.json({ success: true, data: rows, total, limit, offset, summary: { totalCustomers, activeCustomers, activeMemberships } })
  } catch (e) {
    console.error("[laundry-customers] GET list", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    // Enterprise ID via the shared generator: CUS-{businessCode}-NNNNNN
    const lb = await prisma.laundryBusiness.findUnique({ where: { id: laundryBusiness.id }, select: { businessCode: true } })
    const customerCode = await generateCustomerCode(lb?.businessCode || `LND-${laundryBusiness.id}`)

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
