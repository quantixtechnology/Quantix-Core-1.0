// POST /api/core/storefront/laundry-subscription/subscribe
//
// Activates a laundry subscription for a customer using the EXISTING
// CustomerSubscription domain (no duplicate subscription system). The billing
// cycle is the plan's billing cycle from now; allowance counters come from the
// plan. Usage is later derived from auditable SubscriptionUsage rows.
//
// Body: { businessId, planId, customer: { name, phone, email?, id? } }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { generateCustomerCode } from "@/lib/laundry-codes"

export const runtime = "nodejs"

function cycleEnd(cycle: string, from: Date): Date {
  const d = new Date(from)
  switch (cycle) {
    case "WEEKLY": d.setDate(d.getDate() + 7); break
    case "QUARTERLY": d.setMonth(d.getMonth() + 3); break
    case "HALF_YEARLY": d.setMonth(d.getMonth() + 6); break
    case "YEARLY": d.setFullYear(d.getFullYear() + 1); break
    case "MONTHLY": default: d.setMonth(d.getMonth() + 1); break
  }
  return d
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, planId, customer } = body as { businessId?: string; planId?: string; customer?: { name?: string; phone?: string; email?: string; id?: string } }
    if (!businessId || !planId) return NextResponse.json({ success: false, error: "businessId and planId are required" }, { status: 400 })
    if (!customer?.name || !customer?.phone) return NextResponse.json({ success: false, error: "customer name and phone are required" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId
    const lb = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { businessCode: true } })

    const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, businessId: platformId, isActive: true } })
    if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 })

    // Resolve/create the customer (guest by phone).
    let customerRow = customer.id
      ? await prisma.customer.findFirst({ where: { id: customer.id, businessId: platformId } })
      : await prisma.customer.findFirst({ where: { businessId: platformId, phone: customer.phone } })
    if (!customerRow) {
      const code = await generateCustomerCode(lb?.businessCode || `LND-${biz.id}`)
      customerRow = await prisma.customer.create({ data: { businessId: platformId, name: customer.name, phone: customer.phone, email: customer.email || null, customerCode: code, source: "STOREFRONT", isGuest: true } })
    }

    // Reuse an existing ACTIVE subscription to this plan if present (idempotent).
    const existing = await prisma.customerSubscription.findFirst({ where: { businessId: platformId, customerId: customerRow.id, planId: plan.id, status: "ACTIVE" } })
    if (existing) {
      return NextResponse.json({ success: true, data: { subscriptionId: existing.id, customerId: customerRow.id, planName: plan.name, alreadyActive: true } })
    }

    const start = new Date()
    const end = cycleEnd(plan.billingCycle, start)
    const created = await prisma.customerSubscription.create({
      data: {
        businessId: platformId, customerId: customerRow.id, planId: plan.id, status: "ACTIVE",
        currentPeriodStart: start, currentPeriodEnd: end, nextBillingDate: end,
        totalCredits: plan.totalCredits, usedCredits: 0, remainingCredits: plan.totalCredits,
        lastPaymentAmount: plan.price, lastPaymentAt: start,
      },
    })
    await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { currentSubscribers: { increment: 1 } } }).catch(() => {})

    return NextResponse.json({ success: true, data: {
      subscriptionId: created.id, customerId: customerRow.id, planName: plan.name,
      allowance: plan.totalCredits, creditLabel: plan.creditLabel || "clothes",
      maxOrdersPerCycle: plan.maxOrdersPerCycle, cycleStart: start, cycleEnd: end,
    } }, { status: 201 })
  } catch (e) {
    console.error("[laundry-subscribe] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Subscribe failed" }, { status: 500 })
  }
}
