// ============================================================================
// Laundry Subscription — SERVER apply + ledger (Parts 6/7/8/9/10/13).
//
// Applies an active customer subscription's KG/Piece allowance to an order that
// was ALREADY created at full regular price by the frozen Operations Engine.
// It never recomputes pricing and never touches the workflow — it only writes
// the append-only allowance ledger, decrements balances, and records how much
// of the existing order charge the subscription covered (the uncovered
// remainder stays payable).
// ============================================================================
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { computeCoverage, type SubForCoverage, type CoverLine, type AllowanceMode } from "@/lib/laundry-subscription-consumption"

const r2 = (n: number) => Math.round(n * 100) / 100
type Tx = Prisma.TransactionClient

// The unit a subscription consumes when covering an order. A cloth plan grants
// pieces (allowancePieces), a KG plan grants kg — that GRANT (not the current
// balance) is what fixes the unit, so an exhausted piece plan still bills its
// overflow at the per-KG price rather than silently switching to KG coverage.
export function coverageUnitOf(s: { allowancePieces: number; allowanceKg: number }): AllowanceMode {
  return (s.allowancePieces || 0) > 0 ? "PER_PIECE" : "PER_KG"
}

export type LedgerType = "OPENING" | "CONSUMPTION" | "ADJUSTMENT" | "RENEWAL" | "EXPIRY" | "MANUAL_ADJUSTMENT" | "CLOSING"

export async function writeLedger(tx: Tx, e: {
  subscriptionId: string; businessId: string; entryType: LedgerType; unit: "KG" | "PIECE"
  delta: number; balanceAfter: number; orderId?: string | null; orderItemId?: string | null; note?: string | null; actorName?: string | null
}) {
  return tx.subscriptionLedgerEntry.create({ data: {
    subscriptionId: e.subscriptionId, businessId: e.businessId, entryType: e.entryType, unit: e.unit,
    delta: r2(e.delta), balanceAfter: r2(e.balanceAfter), orderId: e.orderId ?? null, orderItemId: e.orderItemId ?? null,
    note: e.note ?? null, actorName: e.actorName ?? null,
  } })
}

// Grant a cycle's allowance onto a subscription and open the ledger (Part 7/8).
// Used on activation and renewal. Writes OPENING entries for each granted unit.
export async function grantAllowance(tx: Tx, sub: { id: string; businessId: string }, plan: { allowanceKg: number | null; allowancePieces: number | null }, opts: { entryType: "OPENING" | "RENEWAL"; actorName?: string | null; note?: string | null }) {
  const kg = plan.allowanceKg && plan.allowanceKg > 0 ? r2(plan.allowanceKg) : 0
  const pieces = plan.allowancePieces && plan.allowancePieces > 0 ? Math.floor(plan.allowancePieces) : 0
  await tx.customerSubscription.update({ where: { id: sub.id }, data: {
    allowanceKg: kg, usedKg: 0, remainingKg: kg, allowancePieces: pieces, usedPieces: 0, remainingPieces: pieces,
  } })
  if (kg > 0) await writeLedger(tx, { subscriptionId: sub.id, businessId: sub.businessId, entryType: opts.entryType, unit: "KG", delta: kg, balanceAfter: kg, note: opts.note ?? "Cycle allowance granted", actorName: opts.actorName })
  if (pieces > 0) await writeLedger(tx, { subscriptionId: sub.id, businessId: sub.businessId, entryType: opts.entryType, unit: "PIECE", delta: pieces, balanceAfter: pieces, note: opts.note ?? "Cycle allowance granted", actorName: opts.actorName })
  return { kg, pieces }
}

// Subscription eligibility is defined ONCE in the Pricing Matrix, never per plan.
// A garment is covered when LaundryGarment.subscriptionIncluded = true; its
// PER_KG / PER_PIECE mode comes from the garment×service pricing rule. Returns the
// coverage rules in the exact shape computeCoverage consumes. Keyed by the
// LaundryBusiness id (garments + pricing rules live there).
export async function subscriptionCoverageRules(laundryBusinessId: string): Promise<{ serviceId: string; garmentId: string | null; mode: AllowanceMode }[]> {
  const eligible = await prisma.laundryGarment.findMany({ where: { businessId: laundryBusinessId, subscriptionIncluded: true }, select: { id: true } })
  if (eligible.length === 0) return []
  const gIds = eligible.map((g) => g.id)
  const rules = await prisma.laundryPricingRule.findMany({ where: { businessId: laundryBusinessId, garmentId: { in: gIds } }, select: { serviceId: true, garmentId: true, pricingType: true } })
  const seen = new Set<string>()
  const out: { serviceId: string; garmentId: string | null; mode: AllowanceMode }[] = []
  for (const r of rules) {
    if (!r.serviceId || !r.garmentId || seen.has(`${r.serviceId}|${r.garmentId}`)) continue
    seen.add(`${r.serviceId}|${r.garmentId}`)
    out.push({ serviceId: r.serviceId, garmentId: r.garmentId, mode: r.pricingType === "PER_KG" ? "PER_KG" : "PER_PIECE" })
  }
  return out
}

export interface ApplyResult {
  ok: boolean
  error?: string
  alreadyApplied?: boolean
  coveredAmount: number
  extraAmount: number
  lines: { itemId: string; subscriptionId: string | null; mode: AllowanceMode | null; coveredKg: number; coveredPieces: number; coveredAmount: number; extraAmount: number }[]
  order?: { balanceDue: number; paymentStatus: string; subscriptionCoveredAmount: number }
}

// Apply subscription coverage to a created order. Idempotent (a re-run detects
// existing CONSUMPTION ledger rows and no-ops). Mixed orders are handled
// naturally: only eligible garments with remaining allowance are covered.
export async function applySubscriptionToOrder(orderId: string, opts: { actorName?: string | null; force?: boolean } = {}): Promise<ApplyResult> {
  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, businessId: true, customerId: true, grandTotal: true, amountPaid: true, subscriptionCoveredAmount: true,
      items: { select: { id: true, serviceId: true, garmentId: true, pricingType: true, quantity: true, weightKg: true, unitPrice: true, lineAmount: true } },
    },
  })
  if (!order) return { ok: false, error: "Order not found", coveredAmount: 0, extraAmount: 0, lines: [] }
  const fullExtra = { ok: true as const, coveredAmount: 0, extraAmount: r2(order.grandTotal), lines: [] }
  if (!order.customerId) return fullExtra // walk-in / no customer → nothing to cover

  // Idempotency: coverage already applied → no-op, unless force (edit) which
  // first RELEASES the current consumption so we never double-consume.
  if (order.subscriptionCoveredAmount > 0) {
    if (!opts.force) {
      return { ok: true, alreadyApplied: true, coveredAmount: r2(order.subscriptionCoveredAmount), extraAmount: r2(order.grandTotal - order.subscriptionCoveredAmount), lines: [], order: undefined }
    }
    await releaseSubscriptionFromOrder(orderId, { actorName: opts.actorName, reason: "Re-applied on order edit" })
    const fresh = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { amountPaid: true, subscriptionCoveredAmount: true } })
    order.amountPaid = fresh?.amountPaid ?? 0
    order.subscriptionCoveredAmount = fresh?.subscriptionCoveredAmount ?? 0
  }

  // The order carries the LaundryBusiness id; subscriptions are keyed by the
  // platform Business id.
  const lb = await prisma.laundryBusiness.findUnique({ where: { id: order.businessId }, select: { platformBusinessId: true } })
  const platformId = lb?.platformBusinessId || order.businessId

  const subs = await prisma.customerSubscription.findMany({
    where: { businessId: platformId, customerId: order.customerId, status: { in: ["ACTIVE", "GRACE"] } },
    orderBy: { createdAt: "asc" },
  })
  if (subs.length === 0) return fullExtra

  // Coverage eligibility comes from the Pricing Matrix (single source), applied to
  // EVERY active subscription — plans define allowance/limits, not garment lists.
  const matrixRules = await subscriptionCoverageRules(order.businessId)
  const subInputs: SubForCoverage[] = subs.map((s) => ({
    id: s.id, remainingKg: s.remainingKg, remainingPieces: s.remainingPieces, rules: matrixRules,
    // Consumption unit follows the plan's allowance: a cloth plan (pieces)
    // covers eligible garments by count even when they are priced per-KG.
    coverageUnit: coverageUnitOf(s),
  }))
  const lines: CoverLine[] = order.items.map((i) => ({
    itemId: i.id, serviceId: i.serviceId, garmentId: i.garmentId, quantity: i.quantity || 1,
    weightKg: i.weightKg || 0, unitPrice: i.unitPrice || 0, lineAmount: i.lineAmount || 0,
  }))

  const result = computeCoverage(subInputs, lines)
  if (result.coveredAmount <= 0) return fullExtra

  // Running balances per subscription for sequential ledger balanceAfter.
  const bal = new Map(subs.map((s) => [s.id, { kg: s.remainingKg, pieces: s.remainingPieces, usedKg: s.usedKg, usedPieces: s.usedPieces }]))

  await prisma.$transaction(async (tx) => {
    for (const line of result.lines) {
      if (!line.subscriptionId) continue
      const b = bal.get(line.subscriptionId)!
      if (line.coveredKg > 0) {
        b.kg = r2(b.kg - line.coveredKg); b.usedKg = r2(b.usedKg + line.coveredKg)
        await writeLedger(tx, { subscriptionId: line.subscriptionId, businessId: platformId, entryType: "CONSUMPTION", unit: "KG", delta: -line.coveredKg, balanceAfter: b.kg, orderId, orderItemId: line.itemId, note: `Covered ${line.coveredKg}kg (₹${line.coveredAmount})`, actorName: opts.actorName })
      }
      if (line.coveredPieces > 0) {
        b.pieces = b.pieces - line.coveredPieces; b.usedPieces = b.usedPieces + line.coveredPieces
        await writeLedger(tx, { subscriptionId: line.subscriptionId, businessId: platformId, entryType: "CONSUMPTION", unit: "PIECE", delta: -line.coveredPieces, balanceAfter: b.pieces, orderId, orderItemId: line.itemId, note: `Covered ${line.coveredPieces} pc (₹${line.coveredAmount})`, actorName: opts.actorName })
      }
    }
    // Persist decremented balances + a usage row per subscription touched.
    for (const [subId, b] of bal) {
      const touched = result.lines.some((l) => l.subscriptionId === subId)
      if (!touched) continue
      await tx.customerSubscription.update({ where: { id: subId }, data: { remainingKg: b.kg, usedKg: b.usedKg, remainingPieces: b.pieces, usedPieces: b.usedPieces } })
      const pcs = result.perSub[subId]?.consumedPieces || 0
      await tx.subscriptionUsage.create({ data: { subscriptionId: subId, orderId, creditsUsed: pcs, description: `Order coverage · ${r2(result.perSub[subId]?.consumedKg || 0)}kg / ${pcs}pc` } }).catch(() => {})
    }
    // The covered value is modelled as a SUBSCRIPTION payment against the order
    // so the FROZEN payment + delivery math (balanceDue = grandTotal −
    // amountPaid) settles the covered portion with zero changes to those
    // handlers. The customer still owes only the uncovered extra.
    const newCovered = r2(order.subscriptionCoveredAmount + result.coveredAmount)
    const newAmountPaid = r2(order.amountPaid + result.coveredAmount)
    const balanceDue = r2(Math.max(0, order.grandTotal - newAmountPaid))
    const cashPaid = order.amountPaid > 0
    const paymentStatus = balanceDue <= 0 ? (cashPaid ? "PAID" : "SUBSCRIPTION") : "PARTIAL"
    await tx.laundryPayment.create({ data: { orderId, businessId: order.businessId, method: "SUBSCRIPTION", amount: r2(result.coveredAmount), note: "Subscription allowance coverage", createdBy: opts.actorName || null } })
    await tx.laundryOrder.update({ where: { id: orderId }, data: { subscriptionCoveredAmount: newCovered, amountPaid: newAmountPaid, balanceDue, paymentStatus } })
  })

  const covered = r2(result.coveredAmount)
  const newCovered = r2(order.subscriptionCoveredAmount + covered)
  const newAmountPaid = r2(order.amountPaid + covered)
  const balanceDue = r2(Math.max(0, order.grandTotal - newAmountPaid))
  const paymentStatus = balanceDue <= 0 ? (order.amountPaid > 0 ? "PAID" : "SUBSCRIPTION") : "PARTIAL"
  return {
    ok: true, coveredAmount: covered, extraAmount: r2(order.grandTotal - newCovered),
    lines: result.lines, order: { balanceDue, paymentStatus, subscriptionCoveredAmount: newCovered },
  }
}

// Restore a subscription's allowance for an order (Parts 5/6): reverses the
// order's CURRENTLY-consumed allowance, writes reversal ADJUSTMENT ledger
// entries (never deletes history), removes the SUBSCRIPTION payment, and
// restores the order's payable. Net-aware — safe across repeated edit cycles
// (an order already reversed nets to zero → no-op). Used on order edit + cancel.
export async function releaseSubscriptionFromOrder(orderId: string, opts: { actorName?: string | null; reason?: string } = {}) {
  const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { id: true, grandTotal: true, amountPaid: true, subscriptionCoveredAmount: true } })
  if (!order) return { ok: false as const, error: "Order not found" }
  if (order.subscriptionCoveredAmount <= 0) return { ok: true as const, released: 0 } // nothing active to release

  // Net movement per (subscription, unit) for this order across CONSUMPTION and
  // any prior reversal ADJUSTMENTs. A negative net = still-consumed amount.
  const entries = await prisma.subscriptionLedgerEntry.findMany({ where: { orderId, entryType: { in: ["CONSUMPTION", "ADJUSTMENT"] } } })
  const net = new Map<string, { kg: number; pieces: number; businessId: string }>()
  for (const e of entries) {
    const cur = net.get(e.subscriptionId) || { kg: 0, pieces: 0, businessId: e.businessId }
    if (e.unit === "KG") cur.kg = r2(cur.kg + e.delta); else cur.pieces = cur.pieces + e.delta
    net.set(e.subscriptionId, cur)
  }

  let released = 0
  await prisma.$transaction(async (tx) => {
    for (const [subId, n] of net) {
      const restoreKg = n.kg < 0 ? r2(-n.kg) : 0
      const restorePieces = n.pieces < 0 ? -n.pieces : 0
      if (restoreKg === 0 && restorePieces === 0) continue
      const sub = await tx.customerSubscription.findUnique({ where: { id: subId }, select: { remainingKg: true, usedKg: true, remainingPieces: true, usedPieces: true } })
      if (!sub) continue
      let rk = sub.remainingKg, rp = sub.remainingPieces
      if (restoreKg > 0) { rk = r2(sub.remainingKg + restoreKg); await writeLedger(tx, { subscriptionId: subId, businessId: n.businessId, entryType: "ADJUSTMENT", unit: "KG", delta: restoreKg, balanceAfter: rk, orderId, note: opts.reason || "Allowance restored (order edit/cancel)", actorName: opts.actorName }) }
      if (restorePieces > 0) { rp = sub.remainingPieces + restorePieces; await writeLedger(tx, { subscriptionId: subId, businessId: n.businessId, entryType: "ADJUSTMENT", unit: "PIECE", delta: restorePieces, balanceAfter: rp, orderId, note: opts.reason || "Allowance restored (order edit/cancel)", actorName: opts.actorName }) }
      await tx.customerSubscription.update({ where: { id: subId }, data: { remainingKg: rk, usedKg: r2(Math.max(0, sub.usedKg - restoreKg)), remainingPieces: rp, usedPieces: Math.max(0, sub.usedPieces - restorePieces) } })
      released++
    }
    // Remove usage rows + the SUBSCRIPTION payment; restore the order's payable.
    await tx.subscriptionUsage.deleteMany({ where: { orderId } })
    const subPay = await tx.laundryPayment.findMany({ where: { orderId, method: "SUBSCRIPTION" }, select: { amount: true } })
    const paidBack = r2(subPay.reduce((s, p) => s + p.amount, 0))
    await tx.laundryPayment.deleteMany({ where: { orderId, method: "SUBSCRIPTION" } })
    const newAmountPaid = r2(Math.max(0, order.amountPaid - paidBack))
    const balanceDue = r2(Math.max(0, order.grandTotal - newAmountPaid))
    const paymentStatus = balanceDue <= 0 ? (newAmountPaid > 0 ? "PAID" : "UNPAID") : (newAmountPaid > 0 ? "PARTIAL" : "UNPAID")
    await tx.laundryOrder.update({ where: { id: orderId }, data: { subscriptionCoveredAmount: 0, amountPaid: newAmountPaid, balanceDue, paymentStatus } })
  })
  return { ok: true as const, released }
}

// Read a subscription's ledger + current balances (Part 8/12).
export async function subscriptionLedger(subscriptionId: string) {
  const [sub, entries] = await Promise.all([
    prisma.customerSubscription.findUnique({ where: { id: subscriptionId }, select: { id: true, status: true, allowanceKg: true, usedKg: true, remainingKg: true, allowancePieces: true, usedPieces: true, remainingPieces: true, currentPeriodStart: true, currentPeriodEnd: true, graceEndsAt: true } }),
    prisma.subscriptionLedgerEntry.findMany({ where: { subscriptionId }, orderBy: { createdAt: "asc" } }),
  ])
  return { sub, entries }
}
