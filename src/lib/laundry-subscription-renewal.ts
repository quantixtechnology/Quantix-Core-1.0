// ============================================================================
// Laundry Subscription — RENEWAL & lifecycle (Part 11) + manual ledger
// adjustment (Part 8). History is never destroyed: a lapse/cancel writes CLOSING
// ledger entries and the subscription row + ledger are retained forever.
//
// States: ACTIVE → (lapse) → GRACE → EXPIRED ; ACTIVE ⇄ SUSPENDED ;
//         ACTIVE/GRACE/EXPIRED → (renew) → ACTIVE ; any → CANCELLED.
// Renewal may be AUTOMATIC (plan.autoRenew, via the due sweep) or MANUAL.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { cycleEnd } from "@/lib/laundry-subscription-purchase"
import { grantAllowance, writeLedger } from "@/lib/laundry-subscription-server"

const r2 = (n: number) => Math.round(n * 100) / 100

async function loadSub(subscriptionId: string) {
  return prisma.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: { select: { billingCycle: true, autoRenew: true, graceDays: true, allowanceKg: true, allowancePieces: true } } },
  })
}

// Close out the current balances (used on expiry/cancel) — write CLOSING ledger
// entries and zero the remaining allowance. Never overwrites history.
async function closeBalances(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], sub: { id: string; businessId: string; remainingKg: number; remainingPieces: number }, note: string, actorName?: string | null) {
  if (sub.remainingKg > 0) await writeLedger(tx, { subscriptionId: sub.id, businessId: sub.businessId, entryType: "CLOSING", unit: "KG", delta: -sub.remainingKg, balanceAfter: 0, note, actorName })
  if (sub.remainingPieces > 0) await writeLedger(tx, { subscriptionId: sub.id, businessId: sub.businessId, entryType: "CLOSING", unit: "PIECE", delta: -sub.remainingPieces, balanceAfter: 0, note, actorName })
  await tx.customerSubscription.update({ where: { id: sub.id }, data: { remainingKg: 0, remainingPieces: 0 } })
}

// Start a fresh cycle (manual or automatic). Grants the plan allowance again and
// writes RENEWAL ledger entries.
export async function renewSubscription(subscriptionId: string, opts: { actorName?: string | null; manual?: boolean } = {}) {
  const sub = await loadSub(subscriptionId)
  if (!sub) return { ok: false as const, error: "Subscription not found" }
  if (sub.status === "CANCELLED") return { ok: false as const, error: "A cancelled subscription cannot be renewed" }
  const start = new Date()
  const end = cycleEnd(sub.plan.billingCycle, start)
  await prisma.$transaction(async (tx) => {
    await tx.customerSubscription.update({ where: { id: sub.id }, data: {
      status: "ACTIVE", currentPeriodStart: start, currentPeriodEnd: end, nextBillingDate: end, graceEndsAt: null,
      lastPaymentAt: start, usedCredits: 0, remainingCredits: sub.totalCredits,
    } })
    await grantAllowance(tx, { id: sub.id, businessId: sub.businessId }, { allowanceKg: sub.plan.allowanceKg, allowancePieces: sub.plan.allowancePieces }, { entryType: "RENEWAL", actorName: opts.actorName, note: opts.manual ? "Manual renewal" : "Automatic renewal" })
  })
  return { ok: true as const, status: "ACTIVE", cycle: { start, end } }
}

// Evaluate a single subscription against the clock: auto-renew, enter grace, or
// expire. Safe to call repeatedly (idempotent per state).
export async function processExpiry(subscriptionId: string, opts: { actorName?: string | null; now?: Date } = {}) {
  const sub = await loadSub(subscriptionId)
  if (!sub) return { ok: false as const, error: "Subscription not found" }
  const now = opts.now || new Date()
  if (sub.status === "CANCELLED" || sub.status === "SUSPENDED") return { ok: true as const, status: sub.status, changed: false }
  if (now <= sub.currentPeriodEnd) return { ok: true as const, status: sub.status, changed: false } // still within cycle

  // Cycle has lapsed.
  if (sub.plan.autoRenew) { await renewSubscription(subscriptionId, { actorName: opts.actorName }); return { ok: true as const, status: "ACTIVE", changed: true, action: "AUTO_RENEWED" as const } }

  const graceDays = sub.plan.graceDays || 0
  const graceEnd = sub.graceEndsAt || new Date(sub.currentPeriodEnd.getTime() + graceDays * 86400000)
  if (graceDays > 0 && now < graceEnd) {
    if (sub.status !== "GRACE") await prisma.customerSubscription.update({ where: { id: sub.id }, data: { status: "GRACE", graceEndsAt: graceEnd } })
    return { ok: true as const, status: "GRACE", changed: sub.status !== "GRACE", action: "GRACE" as const }
  }
  // Grace exhausted (or none) → expire and close balances.
  await prisma.$transaction(async (tx) => {
    await closeBalances(tx, sub, "Cycle expired", opts.actorName)
    await tx.customerSubscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } })
  })
  return { ok: true as const, status: "EXPIRED", changed: true, action: "EXPIRED" as const }
}

export async function suspendSubscription(subscriptionId: string, actorName?: string | null) {
  const sub = await loadSub(subscriptionId)
  if (!sub) return { ok: false as const, error: "Subscription not found" }
  if (sub.status === "CANCELLED") return { ok: false as const, error: "Cannot suspend a cancelled subscription" }
  await prisma.customerSubscription.update({ where: { id: sub.id }, data: { status: "SUSPENDED" } })
  return { ok: true as const, status: "SUSPENDED" }
}

export async function resumeSubscription(subscriptionId: string) {
  const sub = await loadSub(subscriptionId)
  if (!sub) return { ok: false as const, error: "Subscription not found" }
  if (sub.status !== "SUSPENDED") return { ok: false as const, error: "Only a suspended subscription can be resumed" }
  await prisma.customerSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE" } })
  return { ok: true as const, status: "ACTIVE" }
}

export async function cancelSubscription(subscriptionId: string, actorName?: string | null) {
  const sub = await loadSub(subscriptionId)
  if (!sub) return { ok: false as const, error: "Subscription not found" }
  if (sub.status === "CANCELLED") return { ok: true as const, status: "CANCELLED" }
  await prisma.$transaction(async (tx) => {
    await closeBalances(tx, sub, "Subscription cancelled", actorName)
    await tx.customerSubscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", cancelledAt: new Date() } })
  })
  return { ok: true as const, status: "CANCELLED" }
}

// Manual allowance correction (Part 8) — never overwrites; writes a signed
// MANUAL_ADJUSTMENT ledger entry and updates the balance.
export async function manualAdjust(subscriptionId: string, input: { unit: "KG" | "PIECE"; delta: number; note?: string; actorName?: string | null }) {
  const sub = await loadSub(subscriptionId)
  if (!sub) return { ok: false as const, error: "Subscription not found" }
  const delta = input.unit === "KG" ? r2(input.delta) : Math.round(input.delta)
  const curr = input.unit === "KG" ? sub.remainingKg : sub.remainingPieces
  const after = input.unit === "KG" ? r2(Math.max(0, curr + delta)) : Math.max(0, curr + delta)
  await prisma.$transaction(async (tx) => {
    await writeLedger(tx, { subscriptionId: sub.id, businessId: sub.businessId, entryType: "MANUAL_ADJUSTMENT", unit: input.unit, delta, balanceAfter: after, note: input.note || "Manual adjustment", actorName: input.actorName })
    if (input.unit === "KG") await tx.customerSubscription.update({ where: { id: sub.id }, data: { remainingKg: after, allowanceKg: r2(Math.max(sub.allowanceKg, after)) } })
    else await tx.customerSubscription.update({ where: { id: sub.id }, data: { remainingPieces: after, allowancePieces: Math.max(sub.allowancePieces, after) } })
  })
  return { ok: true as const, unit: input.unit, balanceAfter: after }
}

// Sweep all of a tenant's subscriptions for due renewals/expiry (Part 11).
export async function processDueSubscriptions(platformBusinessId: string, opts: { actorName?: string | null; now?: Date } = {}) {
  const now = opts.now || new Date()
  const due = await prisma.customerSubscription.findMany({
    where: { businessId: platformBusinessId, status: { in: ["ACTIVE", "GRACE"] }, currentPeriodEnd: { lt: now } },
    select: { id: true },
  })
  const results: { id: string; action: string }[] = []
  for (const s of due) {
    const r = await processExpiry(s.id, { actorName: opts.actorName, now })
    if (r.ok && r.changed) results.push({ id: s.id, action: (r as { action?: string }).action || r.status })
  }
  return { processed: results.length, results }
}
