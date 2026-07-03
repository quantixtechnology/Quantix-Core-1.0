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

export interface CreatePurchaseInput { businessId: string; customerId: string; planId: string }

// Create a PENDING purchase. Never activates. Returns the purchase + whether an
// online gateway is available for this tenant so the UI can route to payment.
export async function createSubscriptionPurchase({ businessId, customerId, planId }: CreatePurchaseInput) {
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
      data: { businessId, customerId, planId, amount: plan.price, currency: "INR", status: "PAYMENT_PENDING", paymentStatus: "PENDING" },
    })
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

export async function markPurchaseFailed(purchaseId: string, customerId: string) {
  return prisma.subscriptionPurchase.updateMany({ where: { id: purchaseId, customerId, status: { not: "ACTIVATED" } }, data: { status: "FAILED", paymentStatus: "FAILED" } })
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
