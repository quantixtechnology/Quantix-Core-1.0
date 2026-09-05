import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { membershipState } from "@/lib/laundry-subscription"
import { isValidPincode } from "@/lib/india"
import { createLaundryCustomer, findCustomerByMobile } from "@/lib/laundry-customer-create"

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
    const guard = await requireLaundryPermission(request, businessId, "laundry.customers.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ success: true, data: [], total: 0 })

    const where: Record<string, unknown> = { businessId: biz.platformBusinessId }
    // Archived (soft-deleted) AND merged customers are hidden from the list +
    // search unless the caller explicitly asks (includeArchived=1). Both carry
    // isActive=false; their history is untouched and they can be restored.
    if (sp.get("includeArchived") !== "1") where.isActive = true
    if (q) where.OR = [{ name: { contains: q } }, { phone: { contains: q } }, { customerCode: { contains: q } }, { email: { contains: q } }]
    // Part 9: fast filter to subscribers only.
    const subscription = sp.get("subscription")
    if (subscription === "active") {
      const subCustomers = await prisma.customerSubscription.findMany({ where: { businessId: biz.platformBusinessId, status: { in: ["ACTIVE", "GRACE"] } }, select: { customerId: true } })
      where.id = { in: [...new Set(subCustomers.map((s) => s.customerId))] }
    }

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
    // ── Membership state for the rows on THIS page ──────────────────────────
    // The list showed loyaltyTier ("BRONZE"), which says nothing about whether
    // the customer holds a subscription. One query for the page's customers —
    // not one per row — and the state is decided by membershipState(), the same
    // branches processExpiry() applies. Read-only: nothing here renews, expires
    // or cancels anything.
    const pageIds = rows.map((r) => r.id)
    const subs = pageIds.length
      ? await prisma.customerSubscription.findMany({
          where: { businessId: biz.platformBusinessId, customerId: { in: pageIds } },
          select: {
            customerId: true, status: true, currentPeriodEnd: true, graceEndsAt: true,
            plan: { select: { name: true, autoRenew: true, graceDays: true } },
          },
          orderBy: { currentPeriodEnd: "desc" },
        })
      : []
    // A customer may hold more than one row over time. Prefer the one the rest
    // of the system treats as live (ACTIVE/GRACE); otherwise the most recent,
    // which is what "has/had a subscription" means on this screen.
    const subByCustomer = new Map<string, (typeof subs)[number]>()
    for (const s of subs) {
      const held = subByCustomer.get(s.customerId)
      const live = (x: (typeof subs)[number]) => x.status === "ACTIVE" || x.status === "GRACE"
      if (!held || (live(s) && !live(held))) subByCustomer.set(s.customerId, s)
    }
    const now = new Date()
    const data = rows.map((r) => {
      const s = subByCustomer.get(r.id)
      return {
        ...r,
        membershipState: membershipState(s ? { ...s, autoRenew: s.plan?.autoRenew, graceDays: s.plan?.graceDays } : null, now),
        membershipPlanName: s?.plan?.name ?? null,
      }
    })

    return NextResponse.json({ success: true, data, total, limit, offset, summary: { totalCustomers, activeCustomers, activeMemberships } })
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
    const guard = await requireLaundryPermission(request, businessId, "laundry.customers.create")
    if (!guard.ok) return guard.res
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

    const existing = await findCustomerByMobile(laundryBusiness.platformBusinessId, mobile)
    if (existing) {
      return NextResponse.json({ error: "Customer with this mobile number already exists", data: existing }, { status: 409 })
    }

    // The shared creator — the same one the bulk importer uses, so a customer
    // created here and one created from a file are identical records.
    const customer = await createLaundryCustomer(laundryBusiness.platformBusinessId, laundryBusiness.id, {
      name, mobile, alternateMobile, email,
      addressLine1, addressLine2, area, landmark, city, state, pincode, country,
      gender: body.gender, dateOfBirth: body.dateOfBirth, avatar: body.avatar,
      gstNumber: body.gstNumber, accountType: body.accountType,
      customerSourceId: body.customerSourceId,
      salesTeamOwnerId: body.salesTeamOwnerId, salesTeamOwnerName: body.salesTeamOwnerName,
      anniversary: body.anniversary, company: body.company, reference: body.reference,
      comm: body.comm, tags: body.tags, notes: body.notes,
    })

    console.log(tag, "CREATED customer", customer.id, customer.customerCode, "under platformBusinessId=", laundryBusiness.platformBusinessId)
    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (error) {
    console.error("[laundry-customers] POST Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
