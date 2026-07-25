// ============================================================================
// Laundry Subscription PURCHASE lifecycle — the paid commercial transaction a
// customer completes BEFORE a subscription is activated.
//
// This deliberately reuses the shared platform building blocks:
//   • Customer identity is resolved from the authenticated session (the route
//     handler passes the resolved customerId — never free-text name/phone).
//   • Payment verification reuses the platform's Razorpay HMAC check (the same
//     one /api/core/payments/razorpay/verify uses).
//   • Activation reuses the existing CustomerSubscription domain.
//
// The CustomerSubscription is created ONLY after a payment is verified. There is
// no name+phone "instant subscribe" path here.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { createHmac } from "crypto"
import { grantAllowance } from "@/lib/laundry-subscription-server"

export function cycleEnd(cycle: string, from: Date): Date {
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

// Same verification the platform's Razorpay route uses: HMAC-SHA256 over
// "orderId|paymentId". In dev (no secret configured) the platform auto-verifies
// — this mirrors that exact behaviour, it does not invent a new one.
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature?: string | null): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return true // platform dev/mock mode (matches razorpay/verify)
  if (!signature) return false
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")
  return expected === signature
}

export interface CreatePurchaseInput { businessId: string; customerId: string; planId: string; laundryOrderId?: string | null }

// Create a PENDING purchase. Never activates. Returns the purchase + whether an
// online gateway is available for this tenant so the UI can route to payment.
export async function createSubscriptionPurchase({ businessId, customerId, planId, laundryOrderId }: CreatePurchaseInput) {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, businessId, isActive: true } })
  if (!plan) return { ok: false as const, error: "Plan not found" }

  // Already actively subscribed to this plan? Don't double-charge.
  const activeSub = await prisma.customerSubscription.findFirst({ where: { businessId, customerId, planId, status: "ACTIVE" } })
  if (activeSub) return { ok: false as const, error: "You already have an active subscription to this plan.", alreadyActive: true, subscriptionId: activeSub.id }

  // Reuse an existing open purchase for the same plan instead of stacking rows.
  let purchase = await prisma.subscriptionPurchase.findFirst({
    where: { businessId, customerId, planId, status: { in: ["INITIATED", "PAYMENT_PENDING"] } },
    orderBy: { createdAt: "desc" },
  })
  if (!purchase) {
    purchase = await prisma.subscriptionPurchase.create({
      data: { businessId, customerId, planId, amount: plan.price, currency: "INR", status: "PAYMENT_PENDING", paymentStatus: "PENDING", laundryOrderId: laundryOrderId || null },
    })
  } else if (laundryOrderId && !purchase.laundryOrderId) {
    purchase = await prisma.subscriptionPurchase.update({ where: { id: purchase.id }, data: { laundryOrderId } })
  }

  const gateways = await prisma.paymentGateway.findMany({ where: { businessId, isActive: true }, select: { gateway: true } })
  const onlineGateways = gateways.map((g) => g.gateway).filter((g) => g !== "COD")

  return { ok: true as const, purchase, plan, onlineGateways }
}

export interface ConfirmPurchaseInput {
  purchaseId: string
  customerId: string
  payment: { gateway?: string; orderId?: string; paymentId?: string; signature?: string } | null
}

// Confirm a purchase AFTER payment. Activation happens only if the payment
// verifies. Idempotent — a re-confirm of an already-activated purchase returns
// the existing subscription (protects against double click / retry / refresh).
export async function confirmSubscriptionPurchase({ purchaseId, customerId, payment }: ConfirmPurchaseInput) {
  const purchase = await prisma.subscriptionPurchase.findFirst({ where: { id: purchaseId, customerId } })
  if (!purchase) return { ok: false as const, error: "Purchase not found" }

  // Idempotency: already activated → return existing subscription.
  if (purchase.status === "ACTIVATED" && purchase.customerSubscriptionId) {
    return { ok: true as const, alreadyActivated: true, subscriptionId: purchase.customerSubscriptionId, purchase }
  }

  // Payment must be verified before anything is activated.
  const verified = !!payment?.paymentId && verifyRazorpaySignature(payment.orderId || purchase.paymentReference || "", payment.paymentId, payment.signature)
  if (!verified) {
    return { ok: false as const, pending: true, error: "Payment not verified — subscription not activated." }
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: purchase.planId } })
  if (!plan) return { ok: false as const, error: "Plan not found" }

  // Verified → mark paid, then activate the subscription (transaction-safe).
  const start = new Date()
  const end = cycleEnd(plan.billingCycle, start)
  const result = await prisma.$transaction(async (tx) => {
    // Reuse an existing active subscription if present.
    let sub = await tx.customerSubscription.findFirst({ where: { businessId: purchase.businessId, customerId, planId: plan.id, status: "ACTIVE" } })
    if (!sub) {
      sub = await tx.customerSubscription.create({
        data: {
          businessId: purchase.businessId, customerId, planId: plan.id, status: "ACTIVE",
          currentPeriodStart: start, currentPeriodEnd: end, nextBillingDate: end,
          totalCredits: plan.totalCredits, usedCredits: 0, remainingCredits: plan.totalCredits,
          lastPaymentAmount: purchase.amount, lastPaymentAt: start,
        },
      })
      await grantAllowance(tx, { id: sub.id, businessId: purchase.businessId }, { allowanceKg: plan.allowanceKg, allowancePieces: plan.allowancePieces }, { entryType: "OPENING", note: "Subscription activated" })
      await tx.subscriptionPlan.update({ where: { id: plan.id }, data: { currentSubscribers: { increment: 1 } } }).catch(() => {})
    }
    const updated = await tx.subscriptionPurchase.update({
      where: { id: purchase.id },
      data: { status: "ACTIVATED", paymentStatus: "COMPLETED", paidAt: start, gateway: payment?.gateway || purchase.gateway, paymentTransactionId: payment?.paymentId, paymentReference: payment?.orderId || purchase.paymentReference, customerSubscriptionId: sub.id },
    })
    return { sub, purchase: updated }
  })

  return { ok: true as const, subscriptionId: result.sub.id, purchase: result.purchase, plan, cycle: { start, end } }
}

// Apply a collected payment amount to a pending subscription purchase (used by
// the laundry Payment Collection screen). Supports partial settlement. The
// subscription (allowance) is ACTIVATED only when the purchase is FULLY paid.
// Returns how much of the passed amount was consumed by the subscription.
export async function applyPaymentToPurchase(purchaseId: string, amount: number) {
  const purchase = await prisma.subscriptionPurchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) return { applied: 0, activated: false, error: "Purchase not found" as string | undefined }
  if (purchase.status === "ACTIVATED") return { applied: 0, activated: true, subscriptionId: purchase.customerSubscriptionId || undefined }

  const outstanding = Math.max(0, purchase.amount - purchase.amountPaid)
  const applied = Math.min(Math.max(0, amount), outstanding)
  const newPaid = Math.round((purchase.amountPaid + applied) * 100) / 100
  const fullyPaid = newPaid >= purchase.amount - 0.001

  if (!fullyPaid) {
    await prisma.subscriptionPurchase.update({ where: { id: purchase.id }, data: { amountPaid: newPaid, paymentStatus: "PROCESSING" } })
    return { applied, activated: false, remaining: Math.round((purchase.amount - newPaid) * 100) / 100 }
  }

  // Fully paid → activate the subscription + allowance (transaction-safe).
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: purchase.planId } })
  if (!plan) return { applied, activated: false, error: "Plan not found" }
  const start = new Date()
  const end = cycleEnd(plan.billingCycle, start)
  const sub = await prisma.$transaction(async (tx) => {
    let s = await tx.customerSubscription.findFirst({ where: { businessId: purchase.businessId, customerId: purchase.customerId, planId: plan.id, status: "ACTIVE" } })
    if (!s) {
      s = await tx.customerSubscription.create({
        data: { businessId: purchase.businessId, customerId: purchase.customerId, planId: plan.id, status: "ACTIVE",
          currentPeriodStart: start, currentPeriodEnd: end, nextBillingDate: end,
          totalCredits: plan.totalCredits, usedCredits: 0, remainingCredits: plan.totalCredits,
          lastPaymentAmount: purchase.amount, lastPaymentAt: start },
      })
      await grantAllowance(tx, { id: s.id, businessId: purchase.businessId }, { allowanceKg: plan.allowanceKg, allowancePieces: plan.allowancePieces }, { entryType: "OPENING", note: "Subscription activated" })
      await tx.subscriptionPlan.update({ where: { id: plan.id }, data: { currentSubscribers: { increment: 1 } } }).catch(() => {})
    }
    await tx.subscriptionPurchase.update({ where: { id: purchase.id }, data: { amountPaid: newPaid, status: "ACTIVATED", paymentStatus: "COMPLETED", paidAt: start, customerSubscriptionId: s.id } })
    return s
  })
  return { applied, activated: true, subscriptionId: sub.id, remaining: 0 }
}

// The customer's current subscription financial picture: active plan (if any)
// plus any pending purchase due. Used by My Account + admin customer detail.
export async function customerSubscriptionSummary(businessId: string, customerId: string) {
  const [activeSub, pending] = await Promise.all([
    prisma.customerSubscription.findFirst({ where: { businessId, customerId, status: "ACTIVE" }, include: { plan: { select: { name: true, maxOrdersPerCycle: true } }, usages: { select: { creditsUsed: true } } } }),
    prisma.subscriptionPurchase.findFirst({ where: { businessId, customerId, status: { in: ["INITIATED", "PAYMENT_PENDING"] } }, orderBy: { createdAt: "desc" } }),
  ])
  let pendingPlanName: string | null = null
  if (pending) { const p = await prisma.subscriptionPlan.findUnique({ where: { id: pending.planId }, select: { name: true } }); pendingPlanName = p?.name || null }
  const used = activeSub ? activeSub.usages.reduce((s, u) => s + (u.creditsUsed || 0), 0) : 0
  return {
    active: activeSub ? {
      planName: activeSub.plan.name, status: "ACTIVE",
      allowance: activeSub.totalCredits, used, remaining: Math.max(0, activeSub.totalCredits - used),
      maxOrders: activeSub.plan.maxOrdersPerCycle,
      cycleStart: activeSub.currentPeriodStart, cycleEnd: activeSub.currentPeriodEnd,
    } : null,
    pending: pending ? {
      purchaseId: pending.id, planId: pending.planId, planName: pendingPlanName, amount: pending.amount, amountPaid: pending.amountPaid,
      due: Math.round((pending.amount - pending.amountPaid) * 100) / 100, status: "PAYMENT_PENDING", createdAt: pending.createdAt,
    } : null,
  }
}

export async function markPurchaseFailed(purchaseId: string, customerId: string) {
  return prisma.subscriptionPurchase.updateMany({ where: { id: purchaseId, customerId, status: { not: "ACTIVATED" } }, data: { status: "FAILED", paymentStatus: "FAILED" } })
}

// Customer cancels their own PENDING subscription request. Never touches an
// activated purchase (a paid membership is cancelled through its own lifecycle).
// Returns whether a pending row was actually cancelled so the caller can 404.
export async function cancelSubscriptionPurchase(purchaseId: string, customerId: string) {
  const r = await prisma.subscriptionPurchase.updateMany({
    where: { id: purchaseId, customerId, status: { in: ["INITIATED", "PAYMENT_PENDING"] } },
    data: { status: "CANCELLED", paymentStatus: "CANCELLED" },
  })
  return { ok: r.count > 0 }
}

export async function listSubscriptionPurchases(businessId: string, customerId: string) {
  const rows = await prisma.subscriptionPurchase.findMany({ where: { businessId, customerId }, orderBy: { createdAt: "desc" } })
  const planIds = [...new Set(rows.map((r) => r.planId))]
  const plans = await prisma.subscriptionPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
  const planMap = new Map(plans.map((p) => [p.id, p.name]))
  return rows.map((r) => ({
    id: r.id, planName: planMap.get(r.planId) || "Subscription", amount: r.amount, currency: r.currency,
    status: r.status, paymentStatus: r.paymentStatus, reference: r.paymentTransactionId || r.paymentReference,
    createdAt: r.createdAt, paidAt: r.paidAt, subscriptionId: r.customerSubscriptionId,
  }))
}
