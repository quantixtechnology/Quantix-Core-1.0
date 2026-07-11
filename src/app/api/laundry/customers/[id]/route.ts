// GET /api/laundry/customers/[id]  — full profile (identity, addresses, tags,
//   communication, metadata, live statistics).
// PUT /api/laundry/customers/[id]  — edit the complete profile (partial update).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { isValidPincode, formatFullAddress } from "@/lib/india"
import { parseMeta, parseTags, mergeMeta, customerStats, type CommPrefs } from "@/lib/laundry-customer"

export const runtime = "nodejs"

async function scopedCustomer(businessId: string, id: string) {
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return null
  return prisma.customer.findFirst({
    where: { id, businessId: biz.platformBusinessId },
    include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] } },
  })
}

// Flatten metadata + tags onto the response so the UI reads one flat object.
function shape(c: Awaited<ReturnType<typeof scopedCustomer>>) {
  if (!c) return c
  const meta = parseMeta(c.metadata)
  const defaultAddress = c.addresses.find((a) => a.isDefault) || c.addresses[0] || null
  return {
    ...c, tags: parseTags(c.tags), meta,
    alternateMobile: meta.alternateMobile || null, anniversary: meta.anniversary || null,
    company: meta.company || null, reference: meta.reference || null,
    comm: meta.comm || {}, fullAddress: defaultAddress ? formatFullAddress(defaultAddress) : "",
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const customer = await scopedCustomer(businessId, id)
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const stats = await customerStats(id)
    return NextResponse.json({ success: true, data: { ...shape(customer), stats } })
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
    if (b.pincode && !isValidPincode(b.pincode)) return NextResponse.json({ error: "PIN Code must be a valid 6-digit Indian pincode" }, { status: 400 })

    // Metadata patch (alternate mobile, anniversary, company, reference, comm).
    const metaPatch: Record<string, unknown> = {}
    if (b.alternateMobile !== undefined) metaPatch.alternateMobile = b.alternateMobile || ""
    if (b.anniversary !== undefined) metaPatch.anniversary = b.anniversary || ""
    if (b.company !== undefined) metaPatch.company = b.company || ""
    if (b.reference !== undefined) metaPatch.reference = b.reference || ""
    if (b.comm !== undefined && b.comm && typeof b.comm === "object") metaPatch.comm = b.comm as CommPrefs
    const metadata = Object.keys(metaPatch).length ? mergeMeta(customer.metadata, metaPatch) : undefined

    await prisma.customer.update({
      where: { id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.mobile !== undefined && { phone: b.mobile }),
        ...(b.email !== undefined && { email: b.email || null }),
        ...(b.gender !== undefined && { gender: b.gender || null }),
        ...(b.dateOfBirth !== undefined && { dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : null }),
        ...(b.avatar !== undefined && { avatar: b.avatar || null }),
        ...(b.gstNumber !== undefined && { gstNumber: b.gstNumber || null }),
        ...(b.accountType !== undefined && { accountType: b.accountType }),
        ...(b.loyaltyTier !== undefined && { loyaltyTier: b.loyaltyTier }),
        ...(b.status !== undefined && { status: b.status, isActive: b.status === "ACTIVE" }),
        ...(b.notes !== undefined && { notes: b.notes || "" }),
        ...(Array.isArray(b.tags) && { tags: JSON.stringify([...new Set(b.tags.map(String))]) }),
        ...(metadata !== undefined && { metadata }),
      },
    })

    // Optional inline default-address upsert (backward compatible).
    const hasAddr = [b.addressLine1, b.addressLine2, b.area, b.landmark, b.city, b.state, b.pincode].some((v) => v)
    if (hasAddr) {
      const existing = customer.addresses.find((a) => a.isDefault) || customer.addresses[0]
      const data = { addressLine1: b.addressLine1 ?? b.address ?? "", addressLine2: b.addressLine2 || null, area: b.area || null, landmark: b.landmark || null, city: b.city || "", state: b.state || "", pincode: b.pincode || "", country: b.country || "India", isDefault: true }
      if (existing) await prisma.address.update({ where: { id: existing.id }, data })
      else await prisma.address.create({ data: { ...data, customerId: id } })
    }

    const updated = await scopedCustomer(b.businessId, id)
    return NextResponse.json({ success: true, data: shape(updated) })
  } catch (e) {
    console.error("[laundry-customers] PUT[id]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
