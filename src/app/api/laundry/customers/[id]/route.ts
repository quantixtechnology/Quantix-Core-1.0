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

    // A mobile number identifies one customer within a business — that is the
    // @@unique([businessId, phone]) rule, and it stands. What did not stand was
    // how it was reported: Prisma raised P2002, the catch below turned it into
    // "Internal server error", and the whole save was lost. Staff correcting a
    // wrong number saw an edit that simply refused, with nothing naming the
    // record already holding it, so the field read as uneditable.
    //
    // Checked here so the answer is a plain 409 naming that customer, and the
    // constraint is still enforced by the database underneath.
    if (b.mobile !== undefined && b.mobile && b.mobile !== customer.phone) {
      const clash = await prisma.customer.findFirst({
        where: { businessId: customer.businessId, phone: b.mobile, id: { not: id } },
        select: { id: true, name: true, customerCode: true },
      })
      if (clash) {
        return NextResponse.json({
          error: `${b.mobile} already belongs to ${clash.name || "another customer"}${clash.customerCode ? ` (${clash.customerCode})` : ""}. Correct that record or merge the two.`,
          code: "PHONE_TAKEN",
          conflictCustomerId: clash.id,
        }, { status: 409 })
      }
    }

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
    //
    // Presence, not truthiness. Asking whether any field held a VALUE meant a
    // form submitted with every address box emptied looked identical to a
    // request that never mentioned an address at all, so the block was skipped
    // and the old address stayed — staff could write an address but never clear
    // one. Callers that genuinely say nothing about the address (the restore
    // button sends only a status) still send no keys, so they still skip it.
    const ADDRESS_KEYS = ["addressLine1", "addressLine2", "area", "landmark", "city", "state", "pincode", "address"] as const
    const hasAddr = ADDRESS_KEYS.some((k) => b[k] !== undefined)
    if (hasAddr) {
      const existing = customer.addresses.find((a) => a.isDefault) || customer.addresses[0]
      const data = { addressLine1: b.addressLine1 ?? b.address ?? "", addressLine2: b.addressLine2 || null, area: b.area || null, landmark: b.landmark || null, city: b.city || "", state: b.state || "", pincode: b.pincode || "", country: b.country || "India", isDefault: true }
      if (existing) await prisma.address.update({ where: { id: existing.id }, data })
      else await prisma.address.create({ data: { ...data, customerId: id } })
    }

    const updated = await scopedCustomer(b.businessId, id)
    return NextResponse.json({ success: true, data: shape(updated) })
  } catch (e) {
    // The pre-check above answers the ordinary case; this catches the race
    // where two edits claim the same number at once. Same rule, same wording,
    // never a 500 for something the operator can actually fix.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "That mobile number already belongs to another customer in this business.", code: "PHONE_TAKEN" }, { status: 409 })
    }
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
