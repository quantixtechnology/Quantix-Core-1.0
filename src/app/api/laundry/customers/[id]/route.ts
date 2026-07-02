// GET /api/laundry/customers/[id]  — view customer with full India address
// PUT /api/laundry/customers/[id]  — edit customer + upsert default address
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { isValidPincode, formatFullAddress } from "@/lib/india"

export const runtime = "nodejs"

async function scopedCustomer(businessId: string, id: string) {
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return null
  return prisma.customer.findFirst({
    where: { id, businessId: biz.platformBusinessId },
    include: { addresses: { orderBy: { isDefault: "desc" } } },
  })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const customer = await scopedCustomer(businessId, id)
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const defaultAddress = customer.addresses.find((a) => a.isDefault) || customer.addresses[0] || null
    return NextResponse.json({ success: true, data: { ...customer, fullAddress: defaultAddress ? formatFullAddress(defaultAddress) : "" } })
  } catch (e) {
    console.error("[laundry-customers] GET[id]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const customer = await scopedCustomer(b.businessId, id)
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const pincode = b.pincode
    if (pincode && !isValidPincode(pincode)) {
      return NextResponse.json({ error: "PIN Code must be a valid 6-digit Indian pincode" }, { status: 400 })
    }

    await prisma.customer.update({
      where: { id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.mobile !== undefined && { phone: b.mobile }),
        ...(b.email !== undefined && { email: b.email || null }),
        ...(b.alternateMobile !== undefined && { notes: b.alternateMobile ? `Alternate Mobile: ${b.alternateMobile}` : "" }),
      },
    })

    // Upsert the default address (India format).
    const hasAddr = [b.addressLine1, b.addressLine2, b.area, b.landmark, b.city, b.state, b.pincode].some((v) => v)
    if (hasAddr) {
      const existing = customer.addresses.find((a) => a.isDefault) || customer.addresses[0]
      const data = {
        addressLine1: b.addressLine1 ?? b.address ?? "",
        addressLine2: b.addressLine2 || null,
        area: b.area || null,
        landmark: b.landmark || null,
        city: b.city || "",
        state: b.state || "",
        pincode: b.pincode || "",
        country: b.country || "India",
        isDefault: true,
      }
      if (existing) await prisma.address.update({ where: { id: existing.id }, data })
      else await prisma.address.create({ data: { ...data, customerId: id } })
    }

    const updated = await scopedCustomer(b.businessId, id)
    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error("[laundry-customers] PUT[id]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
