// ============================================================================
// Laundry Customer Management — profile metadata, statistics, timeline, merge.
// The Customer is the single source of truth (identity, addresses, tags,
// communication, order history). Read-only against the FROZEN order/subscription
// engines — it never mutates their logic.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { LIVE_PAYMENT_WHERE } from "@/lib/laundry-payment-correction"
import { getTransportModes, transportRefsForOrders } from "@/lib/laundry-transport-server"
import type { TransportRef } from "@/lib/laundry-transport"

const r2 = (n: number) => Math.round(n * 100) / 100

// ── Profile extras live in Customer.metadata (JSON) — additive, no schema bloat.
export interface CommPrefs { sms?: boolean; whatsapp?: boolean; email?: boolean; push?: boolean; marketing?: boolean }
export interface CustomerMeta { alternateMobile?: string; anniversary?: string; company?: string; reference?: string; comm?: CommPrefs }

export function parseMeta(raw: string | null | undefined): CustomerMeta { try { const o = JSON.parse(raw || "{}"); return o && typeof o === "object" ? o : {} } catch { return {} } }
export function parseTags(raw: string | null | undefined): string[] { try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? a.map(String) : [] } catch { return [] } }
export function mergeMeta(existing: string | null | undefined, patch: Partial<CustomerMeta>): string {
  const cur = parseMeta(existing)
  const next: CustomerMeta = { ...cur, ...patch, comm: { ...(cur.comm || {}), ...(patch.comm || {}) } }
  return JSON.stringify(next)
}

// ── Statistics (Part 8) — derived live from LaundryOrder + subscription. ─────
// Additive Customer-360 fields (memberSince, activeOrders, lastOrders,
// activeOrdersList) power the New Order lifecycle panel. Read-only; the frozen
// order/subscription engines are never mutated.
// Digits-only normalization; a valid mobile resolves to its last 10 digits so
// "+91 9876543210", "09876543210" and "9876543210" all match. Shorter/garbage
// values return < 10 chars and are treated as "no usable phone".
const normalizePhone = (p: string | null | undefined): string => {
  const d = (p || "").replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : ""
}

export async function customerStats(customerId: string) {
  const self = await prisma.customer.findUnique({ where: { id: customerId }, select: { createdAt: true, loyaltyTier: true, phone: true, businessId: true } })

  // ── Identity set: this customer + every OTHER customer in the same business
  //    with the same normalized mobile (legacy/duplicate records). A null/empty
  //    or sub-10-digit phone never merges — we fall back to this id alone.
  const selfNorm = normalizePhone(self?.phone)
  let matchingIds = [customerId]
  let memberSince = self?.createdAt ?? null
  if (selfNorm && self?.businessId) {
    const candidates = await prisma.customer.findMany({
      where: { businessId: self.businessId, phone: { contains: selfNorm } },
      select: { id: true, phone: true, createdAt: true },
    })
    const same = candidates.filter((c) => normalizePhone(c.phone) === selfNorm)
    if (same.length) {
      matchingIds = [...new Set([customerId, ...same.map((c) => c.id)])]
      // Customer Since = earliest membership across the merged records.
      memberSince = same.reduce<Date | null>((m, c) => (!m || c.createdAt < m ? c.createdAt : m), self?.createdAt ?? null)
    }
  }

  const orders = await prisma.laundryOrder.findMany({ where: { customerId: { in: matchingIds } }, select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, amountPaid: true, balanceDue: true, subscriptionCoveredAmount: true, createdAt: true }, orderBy: { createdAt: "desc" } })
  const active = orders.filter((o) => o.status !== "CANCELLED")
  const totalOrders = orders.length
  const completed = orders.filter((o) => o.status === "DELIVERED").length
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length
  // Operationally "active" = in-progress: neither delivered nor cancelled.
  const inProgress = orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED")
  const grossValue = r2(active.reduce((n, o) => n + o.grandTotal, 0))
  const collected = r2(active.reduce((n, o) => n + o.amountPaid, 0))
  const outstanding = r2(active.reduce((n, o) => n + o.balanceDue, 0))
  const subsidised = r2(active.reduce((n, o) => n + (o.subscriptionCoveredAmount || 0), 0))
  const lastOrderAt = orders.length ? orders[0].createdAt : null // orders are createdAt desc
  const avgOrderValue = active.length ? r2(grossValue / active.length) : 0
  const sub = await prisma.customerSubscription.findFirst({ where: { customerId: { in: matchingIds }, status: { in: ["ACTIVE", "GRACE"] } }, include: { plan: { select: { name: true } } }, orderBy: { createdAt: "desc" } })
  const slim = (o: (typeof orders)[number]) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, grandTotal: o.grandTotal, createdAt: o.createdAt })
  return {
    memberSince,
    loyaltyTier: self?.loyaltyTier ?? null,
    totalOrders, completed, cancelled, activeOrders: inProgress.length,
    grossValue, collected, outstanding, subsidised, avgOrderValue, lastOrderAt,
    lastOrders: orders.slice(0, 5).map(slim),
    activeOrdersList: inProgress.map(slim),
    subscription: sub ? { planName: sub.plan.name, status: sub.status, remainingKg: sub.remainingKg, remainingPieces: sub.remainingPieces, expiry: sub.currentPeriodEnd } : null,
  }
}

// ── Timeline (Part 3) — orders + payments + subscriptions + activities. ──────
export interface TimelineEntry { at: Date; type: string; title: string; detail?: string | null; amount?: number | null; ref?: string | null }
export async function customerTimeline(customerId: string, limit = 100): Promise<TimelineEntry[]> {
  const orders = await prisma.laundryOrder.findMany({ where: { customerId }, select: { id: true, orderNumber: true, status: true, grandTotal: true, subscriptionCoveredAmount: true, businessId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })
  const orderIds = orders.map((o) => o.id)
  const [payments, subs, activities, events] = await Promise.all([
    orderIds.length ? prisma.laundryPayment.findMany({ where: { orderId: { in: orderIds }, ...LIVE_PAYMENT_WHERE }, select: { amount: true, method: true, createdAt: true, orderId: true }, orderBy: { createdAt: "desc" }, take: limit }) : Promise.resolve([] as { amount: number; method: string; createdAt: Date; orderId: string }[]),
    prisma.customerSubscription.findMany({ where: { customerId }, include: { plan: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.customerActivity.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: limit }),
    orderIds.length ? prisma.laundryOrderEvent.findMany({ where: { orderId: { in: orderIds } }, select: { action: true, actorName: true, note: true, createdAt: true, orderId: true }, orderBy: { createdAt: "desc" }, take: limit }) : Promise.resolve([] as { action: string; actorName: string | null; note: string | null; createdAt: Date; orderId: string }[]),
  ])
  const orderNo = new Map(orders.map((o) => [o.id, o.orderNumber]))
  // Transport reference for dispatch entries — bag or packet, per Transport
  // Setup, so a BAG-mode business never sees a PKT number in the timeline.
  const lbId = orders[0]?.businessId || null
  const transportMap: Map<string, TransportRef> = lbId
    ? await transportRefsForOrders(lbId, orderIds, (await getTransportModes(lbId)).storeToProcessing).catch(() => new Map<string, TransportRef>())
    : new Map<string, TransportRef>()
  const actionLabel = (a: string) => ({ PICKUP_REQUESTED: "Pickup Requested", PICKUP_ASSIGNED: "Pickup Assigned", PICKUP_ACCEPTED: "Pickup Accepted", PICKUP_COMPLETED: "Pickup Completed", PICKUP_CANCELLED: "Pickup Cancelled", DELIVERY_REQUESTED: "Delivery Requested", DELIVERY_ASSIGNED: "Delivery Assigned", DELIVERY_ACCEPTED: "Delivery Accepted", DELIVERY_CANCELLED: "Delivery Cancelled", MARK_DELIVERED: "Delivered", OUT_FOR_DELIVERY: "Out for Delivery" }[a] || a.replace(/_/g, " "))
  const entries: TimelineEntry[] = [
    ...orders.map((o) => ({ at: o.createdAt, type: "ORDER", title: `Order ${o.orderNumber}`, detail: o.status, amount: o.grandTotal, ref: o.orderNumber })),
    ...payments.map((p) => ({ at: p.createdAt, type: "PAYMENT", title: `Payment · ${p.method}`, detail: orderNo.get(p.orderId) || null, amount: p.amount, ref: p.orderId })),
    ...subs.map((s) => ({ at: s.createdAt, type: "SUBSCRIPTION", title: `${s.plan.name}`, detail: s.status, amount: null, ref: s.id })),
    ...activities.map((a) => ({ at: a.createdAt, type: a.type, title: a.title, detail: a.body, amount: null, ref: a.id })),
    ...events.map((e) => {
      const on = orderNo.get(e.orderId) || ""
      const ref = transportMap.get(e.orderId)?.code || on
      return { at: e.createdAt, type: "DISPATCH", title: `${ref ? `${ref} — ` : ""}${actionLabel(e.action)}`, detail: [e.note, e.actorName].filter(Boolean).join(" · "), amount: null, ref: ref || e.orderId }
    }),
  ]
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit)
}

// ── Merge (Part 10) — safely fold a duplicate into the primary. ──────────────
// Repoints every reference (orders, subscriptions, purchases, addresses, notes,
// activities, documents), recomputes the primary's cached stats from the real
// orders, records a MERGE timeline entry, and retires the duplicate (status
// MERGED, inactive). History is preserved on the primary; nothing is deleted.
export async function mergeCustomers(platformBusinessId: string, primaryId: string, duplicateId: string, actorName?: string | null) {
  if (primaryId === duplicateId) return { ok: false as const, error: "Cannot merge a customer into itself" }
  const [primary, dup] = await Promise.all([
    prisma.customer.findFirst({ where: { id: primaryId, businessId: platformBusinessId } }),
    prisma.customer.findFirst({ where: { id: duplicateId, businessId: platformBusinessId } }),
  ])
  if (!primary || !dup) return { ok: false as const, error: "Customer not found in this workspace" }
  if (dup.status === "MERGED") return { ok: false as const, error: "That customer has already been merged" }

  await prisma.$transaction([
    prisma.laundryOrder.updateMany({ where: { customerId: duplicateId }, data: { customerId: primaryId } }),
    prisma.customerSubscription.updateMany({ where: { customerId: duplicateId }, data: { customerId: primaryId } }),
    prisma.subscriptionPurchase.updateMany({ where: { customerId: duplicateId }, data: { customerId: primaryId } }),
    prisma.address.updateMany({ where: { customerId: duplicateId }, data: { customerId: primaryId } }),
    prisma.customerActivity.updateMany({ where: { customerId: duplicateId }, data: { customerId: primaryId } }),
    prisma.customerDocument.updateMany({ where: { customerId: duplicateId }, data: { customerId: primaryId } }),
    prisma.customerNote.updateMany({ where: { customerId: duplicateId }, data: { customerId: primaryId } }),
  ])

  // Authoritative recompute of the primary's order stats + carry balances.
  const agg = await prisma.laundryOrder.aggregate({ where: { customerId: primaryId, NOT: { status: "CANCELLED" } }, _sum: { grandTotal: true }, _count: { _all: true } })
  await prisma.customer.update({ where: { id: primaryId }, data: {
    totalOrders: agg._count._all, totalSpent: r2(agg._sum.grandTotal || 0),
    walletBalance: { increment: dup.walletBalance }, outstandingBalance: { increment: dup.outstandingBalance }, loyaltyPoints: { increment: dup.loyaltyPoints },
  } })
  await prisma.customerActivity.create({ data: { businessId: platformBusinessId, customerId: primaryId, type: "MERGE", title: `Merged ${dup.customerCode || dup.name}`, body: `${dup.name}${dup.phone ? ` (${dup.phone})` : ""} was merged into this profile`, actorName: actorName || null } })
  await prisma.customer.update({ where: { id: duplicateId }, data: { isActive: false, status: "MERGED" } })

  return { ok: true as const, primaryId, mergedId: duplicateId }
}
