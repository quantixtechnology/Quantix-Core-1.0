// GET /api/laundry/customers/[id]  — full profile (identity, addresses, tags,
//   communication, metadata, live statistics).
// PUT /api/laundry/customers/[id]  — edit the complete profile (partial update).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
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
    const guard = await requireLaundryPermission(request, businessId, "laundry.customers.view")
    if (!guard.ok) return guard.res
    const customer = await scopedCustomer(businessId, id)
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const stats = await customerStats(id)
    // The profile shows a NAME, so resolve it here rather than making every
    // caller fetch the master. There is no Prisma relation to join through —
    // the master is laundry-scoped while Customer is platform-scoped.
    const src = customer.customerSourceId
      ? await prisma.laundryCustomerSource.findUnique({
          where: { id: customer.customerSourceId }, select: { name: true, active: true },
        })
      : null
    return NextResponse.json({
      success: true,
      data: {
        ...shape(customer),
        stats,
        // Null source reads as the default rather than blank: a customer
        // created before this existed was still won somehow, and Direct is the
        // honest assumption. Nothing is written until the record is next saved.
        customerSourceName: src?.name ?? "Direct",
        customerSourceActive: src?.active ?? true,
      },
    })
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
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.customers.edit")
    if (!guard.ok) return guard.res
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
        // Acquisition. Editable for the life of the customer — how they were
        // won is often learnt after the record is first made.
        ...(b.customerSourceId !== undefined && { customerSourceId: b.customerSourceId || null }),
        ...(b.salesTeamOwnerId !== undefined && {
          salesTeamOwnerId: b.salesTeamOwnerId || null,
          // Name travels with the id, so the record keeps the person who won
          // them even after that person leaves the staff list.
          salesTeamOwnerName: b.salesTeamOwnerId ? (b.salesTeamOwnerName || null) : null,
        }),
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

// DELETE /api/laundry/customers/[id] — ARCHIVE (soft). Customers are financial/
// operational anchors: deleting one must NEVER erase orders, invoices, payments,
// subscription ledger or audit. We mark the customer archived + inactive so they
// vanish from search / New Order lookup / Customer App, while every historical
// record stays intact and still resolves the (now archived) customer.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.customers.delete")
    if (!guard.ok) return guard.res
    const customer = await scopedCustomer(businessId, id)
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    await prisma.customer.update({ where: { id }, data: { status: "ARCHIVED", isActive: false } })
    return NextResponse.json({ success: true, archived: true })
  } catch (e) {
    console.error("[laundry-customers] DELETE[id]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
