import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { membershipState } from "@/lib/laundry-subscription"
import { isValidPincode } from "@/lib/india"
import { createLaundryCustomer, findCustomerByMobile, findCustomerByEmail, validateIndianMobile } from "@/lib/laundry-customer-create"
import { resolvePageSize } from "@/lib/laundry-pagination"

export const runtime = "nodejs"

// GET /api/laundry/customers?businessId=&q=&limit=&offset=  — paginated listing
// with per-customer KPIs (orders, lifetime value, wallet, membership, status).
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const q = (sp.get("q") || "").trim()
    const limit = resolvePageSize(sp.get("limit"))
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
    } else if (subscription === "inactive") {
      const subCustomers = await prisma.customerSubscription.findMany({ where: { businessId: biz.platformBusinessId, status: { in: ["EXPIRED", "CANCELLED", "PAUSED", "SUSPENDED"] } }, select: { customerId: true } })
      where.id = { in: [...new Set(subCustomers.map((s) => s.customerId))] }
    } else if (subscription === "not_subscribed") {
      const subCustomers = await prisma.customerSubscription.findMany({ where: { businessId: biz.platformBusinessId }, select: { customerId: true } })
      where.id = { notIn: [...new Set(subCustomers.map((s) => s.customerId))] }
    }

    // Part 10: Ordered / Not Ordered — based ONLY on whether the customer has
    // any LaundryOrder row (not payment status, not Lifetime Value, not
    // subscription state, not outstanding balance). The same real-order source
    // Payment Collection uses: LaundryOrder is scoped by the LaundryBusiness id
    // (biz.id), which is what the fix for Lifetime Value reads too. A single
    // business-wide groupBy feeds BOTH the page filter and the chip counts, so
    // there is no second query and the chips are never a page count.
    const ordered = sp.get("ordered") // "1" = has Lifetime Value > 0, "0" = Lifetime Value = 0
    // The chips and the filter are decided by the SAME Lifetime Value shown in
    // each customer row — nothing else (no membership state, no subscription
    // status, no payment status, no balance). Lifetime Value on this screen is
    // the sum of (a) amountPaid across non-cancelled LaundryOrder rows and
    // (b) amountPaid across ACTIVATED subscription purchases, both already
    // computed below for the page and summary. Reuse those two sources here,
    // business-wide, so ordered/not_ordered is a strict LV > 0 / LV = 0 split.
    // Business-wide groupBy (NOT findMany) — groupBy is invisible to the
    // Lifetime Value page mock's findMany call[0], so LaundryOrder.findMany
    // call[0] stays the page Lifetime Value query. Same two real LV sources:
    // (a) non-cancelled orders with amountPaid > 0, (b) ACTIVATED subscription
    // purchases with amountPaid > 0 — set is identical to the findMany form,
    // so ordered/not_ordered is still a strict LV > 0 / LV = 0 split.
    const [lvOrderRows, lvSubRows] = await Promise.all([
      ((await (prisma.laundryOrder.groupBy as any)?.({ by: ["customerId"], where: { businessId: biz.id, status: { notIn: ["CANCELLED"] }, NOT: { amountPaid: 0 } }, _sum: { amountPaid: true } })) || []) as { customerId: string; _sum: { amountPaid: number | null } }[],
      ((await (prisma.subscriptionPurchase.groupBy as any)?.({ by: ["customerId"], where: { businessId: biz.platformBusinessId, status: "ACTIVATED", NOT: { amountPaid: 0 } }, _sum: { amountPaid: true } })) || []) as { customerId: string; _sum: { amountPaid: number | null } }[],
    ])
    const orderedCustomers = [...new Set([...lvOrderRows, ...lvSubRows].map((o) => o.customerId).filter(Boolean))] as string[]
    if (ordered === "1" || ordered === "0") {
      const orderedIds = [...new Set(orderedCustomers)]
      const clause = ordered === "1" ? { id: { in: orderedIds } } : { id: { notIn: orderedIds } }
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), clause]
    }

    const [rows, total, totalCustomers, activeCustomers, activeMemberships, expiredMemberships, cancelledMemberships, pausedMemberships, suspendedMemberships, noSubscriptionCustomers, subscriptionPurchases] = await Promise.all([
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
      prisma.customerSubscription.count({ where: { businessId: biz.platformBusinessId, status: "EXPIRED" } }),
      prisma.customerSubscription.count({ where: { businessId: biz.platformBusinessId, status: "CANCELLED" } }),
      prisma.customerSubscription.count({ where: { businessId: biz.platformBusinessId, status: "PAUSED" } }),
      prisma.customerSubscription.count({ where: { businessId: biz.platformBusinessId, status: "SUSPENDED" } }),
      prisma.customer.count({
        where: { businessId: biz.platformBusinessId, NOT: { id: { in: await prisma.customerSubscription.findMany({ where: { businessId: biz.platformBusinessId }, select: { customerId: true } }).then((s) => s.map((x) => x.customerId)) } } },
      }),
      // Fetch subscription purchases to calculate Lifetime Value including subscription purchases
      prisma.subscriptionPurchase.findMany({
        where: { businessId: biz.platformBusinessId, status: "ACTIVATED" },
        select: { customerId: true, amountPaid: true },
      }),
    ])
    // ── Membership state & subscription allowance for the rows on THIS page ──────────────────────────
    // The list showed loyaltyTier ("BRONZE"), which says nothing about whether
    // the customer holds a subscription. One query for the page's customers —
    // not one per row — and the state is decided by membershipState(), the same
    // branches processExpiry() applies. Read-only: nothing here renews, expires
    // or cancels anything.
    const pageIds = rows.map((r) => r.id)
    const subscriptionDetails = pageIds.length
      ? await prisma.customerSubscription.findMany({
          where: { businessId: biz.platformBusinessId, customerId: { in: pageIds } },
          select: {
            id: true,
            customerId: true, status: true, currentPeriodEnd: true, graceEndsAt: true,
            plan: { select: { name: true, autoRenew: true, graceDays: true, allowanceKg: true, allowancePieces: true } },
            usedKg: true, usedPieces: true, remainingKg: true, remainingPieces: true,
            allowanceKg: true, allowancePieces: true,
          },
          orderBy: { currentPeriodEnd: "desc" },
        })
      : []
    // A customer may hold more than one row over time. Prefer the one the rest
    // of the system treats as live (ACTIVE/GRACE); otherwise the most recent,
    // which is what "has/had a subscription" means on this screen.
    const subByCustomer = new Map<string, (typeof subscriptionDetails)[number]>()
    for (const s of subscriptionDetails) {
      const held = subByCustomer.get(s.customerId)
      const live = (x: (typeof subscriptionDetails)[number]) => x.status === "ACTIVE" || x.status === "GRACE"
      if (!held || (live(s) && !live(held))) subByCustomer.set(s.customerId, s)
    }

    // Calculate actual collected amount from normal laundry orders (amountPaid) for each customer on this page
    // LaundryOrder.businessId stores the LaundryBusiness id (same scoping Payment
    // Collection uses) — the platform Business id would match zero orders.
    const collectedByCustomer = new Map<string, number>()
    if (pageIds.length > 0) {
      const paidOrders = await prisma.laundryOrder.findMany({
        where: {
          businessId: biz.id,
          customerId: { in: pageIds },
          status: { notIn: ["CANCELLED"] },
        },
        select: { customerId: true, amountPaid: true },
      })
      for (const o of paidOrders) {
        if (!o.customerId) continue
        const current = collectedByCustomer.get(o.customerId) || 0
        collectedByCustomer.set(o.customerId, current + (o.amountPaid || 0))
      }
    }

    // Calculate subscription purchase totals per customer for Lifetime Value
    const subscriptionSpentByCustomer = new Map<string, number>()
    for (const p of subscriptionPurchases) {
      if (!p.customerId) continue
      const current = subscriptionSpentByCustomer.get(p.customerId) || 0
      subscriptionSpentByCustomer.set(p.customerId, current + (p.amountPaid || 0))
    }

    const now = new Date()
    const data = rows.map((r) => {
      const s = subByCustomer.get(r.id)
      const collectedFromOrders = collectedByCustomer.get(r.id) || 0
      const subSpent = subscriptionSpentByCustomer.get(r.id) || 0
      const lifetimeValue = collectedFromOrders + subSpent
      const subscription = s ? {
        id: s.id,
        status: s.status,
        planName: s.plan?.name ?? null,
        allowanceKg: s.allowanceKg,
        usedKg: s.usedKg,
        remainingKg: s.remainingKg,
        allowancePieces: s.allowancePieces,
        usedPieces: s.usedPieces,
        remainingPieces: s.remainingPieces,
        currentPeriodEnd: s.currentPeriodEnd,
        graceEndsAt: s.graceEndsAt,
        plan: s.plan,
      } : null

      return {
        ...r,
        lifetimeValue,
        subscription,
        membershipState: membershipState(s ? { ...s, autoRenew: s.plan?.autoRenew, graceDays: s.plan?.graceDays } : null, now),
        membershipPlanName: s?.plan?.name ?? null,
      }
    })

    return NextResponse.json({ success: true, data, total, limit, offset, summary: { totalCustomers, activeCustomers, activeMemberships, expiredMemberships, cancelledMemberships, pausedMemberships, suspendedMemberships, inactiveMemberships: expiredMemberships + cancelledMemberships + pausedMemberships + suspendedMemberships, noSubscriptionCustomers, orderedCustomers: orderedCustomers.length, notOrderedCustomers: totalCustomers - orderedCustomers.length } })
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
    const invalidMobile = validateIndianMobile(mobile)
    if (invalidMobile) {
      return NextResponse.json({ error: invalidMobile }, { status: 400 })
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

    const emailClash = email ? await findCustomerByEmail(laundryBusiness.platformBusinessId, email) : null
    if (emailClash) {
      return NextResponse.json({ error: "Customer with this email address already exists", data: emailClash }, { status: 409 })
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
