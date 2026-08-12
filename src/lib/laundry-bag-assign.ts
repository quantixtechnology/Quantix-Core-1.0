// Reusable-bag assignment ENGINE (shared). Extracted so both the Admin route
// (/api/laundry/bags/assign) and the Executive PWA use the exact same logic —
// a service may span MULTIPLE bags (unlimited), only an AVAILABLE bag can be
// assigned, the physical bag's permanent QR is reused (no per-order QR).
// Validation is unchanged: unknown bags, non-AVAILABLE bags (already assigned
// to another order), Damaged/Lost/Cleaning bags and concurrent assignments are
// all rejected — a bag can never be assigned twice or to two orders. No auth
// here; callers gate.
import { prisma } from "@/lib/prisma"

export type AssignResult =
  | { ok: true; bag: Awaited<ReturnType<typeof prisma.laundryBag.update>> }
  | { ok: false; status: number; error: string }

export interface ReleaseInput {
  lbId: string
  bagId: string
  code?: string
  storeId?: string | null
  releasedBy?: string | null
  releaseType: "QR_SCAN" | "MANUAL"
  reason?: string | null
}

// ── Assignment ────────────────────────────────────────────────────────────────

export async function assignBagToOrder(opts: {
  lbId: string
  code: string
  orderId: string
  serviceId?: string | null
  serviceName?: string
}): Promise<AssignResult> {
  const code = String(opts.code || "").trim()
  const orderId = String(opts.orderId || "").trim()
  if (!code || !orderId) return { ok: false, status: 400, error: "code and orderId are required" }

  const bag = await prisma.laundryBag.findFirst({ where: { businessId: opts.lbId, OR: [{ bagNumber: code }, { qrValue: code }] } })
  if (!bag) return { ok: false, status: 404, error: "Bag not found." }
  // Idempotent: this bag is already carrying this order (e.g. the pickup bag
  // re-scanned at Packing to confirm the transport identity). Nothing to do —
  // re-assigning would fail the AVAILABLE check and block the workflow.
  if (bag.currentOrderId === orderId) return { ok: true, bag }
  if (bag.status !== "AVAILABLE") {
    const msg = bag.status === "DAMAGED" ? "Bag marked as Damaged. Please use another bag."
      : bag.status === "LOST" ? "Bag is marked Lost."
      : bag.status === "CLEANING" ? "Bag is being cleaned. Please use another bag."
      : "Bag already assigned to another order."
    return { ok: false, status: 409, error: msg }
  }

  const order = await prisma.laundryOrder.findFirst({ where: { id: orderId, businessId: opts.lbId }, select: { id: true, orderNumber: true, customerId: true } })
  if (!order) return { ok: false, status: 404, error: "Order not found" }
  const customer = order.customerId ? await prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true } }) : null

  const serviceId = opts.serviceId ? String(opts.serviceId) : null
  const serviceName = String(opts.serviceName || "Laundry")

  let updated: Awaited<ReturnType<typeof prisma.laundryBag.update>>
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Atomic re-check: bag must still be AVAILABLE inside the transaction.
      const current = await tx.laundryBag.findUnique({ where: { id: bag.id }, select: { status: true } })
      if (!current || current.status !== "AVAILABLE") {
        throw Object.assign(new Error("Bag was taken by another assignment."), { code: "CONCURRENT_ASSIGNMENT", status: 409 })
      }
      // A service may span multiple bags — assign as many AVAILABLE bags as the
      // job needs. The same bag can still never be assigned twice (status check
      // above rejects it once it leaves AVAILABLE) nor to two orders at once.
      const bg = await tx.laundryBag.update({
        where: { id: bag.id },
        data: {
          status: "COLLECTED",
          currentOrderId: order.id, currentOrderNumber: order.orderNumber,
          currentServiceId: serviceId, currentServiceName: serviceName,
          currentCustomerId: order.customerId || null, currentCustomerName: customer?.name || null,
          lastUsedAt: new Date(),
        },
      })
      const assign = await tx.laundryBagAssignment.create({
        data: { bagId: bag.id, businessId: opts.lbId, orderId: order.id, orderNumber: order.orderNumber, serviceId, serviceName, customerId: order.customerId || null, customerName: customer?.name || null, status: "ASSIGNED" },
      })
      // Store the latest assignment ID on the bag for quick lookup on release.
      await tx.laundryBag.update({ where: { id: bag.id }, data: { lastAssignmentId: assign.id } })
      return bg
    })
  } catch (e) {
    // A thrown transaction error is a business-rule rejection (e.g. concurrent
    // assignment) when it carries a status — return it as a result instead of a
    // 500. Anything else is a genuine failure and re-thrown.
    const errStatus = (e as { status?: unknown })?.status
    if (typeof errStatus === "number" && errStatus >= 400) {
      return { ok: false, status: errStatus, error: e instanceof Error ? e.message : "Bag assignment failed" }
    }
    throw e
  }
  return { ok: true, bag: updated }
}

// ── Reusable-bag lifecycle release/advance ───────────────────────────────────
// A reusable bag is a company asset — reserved ONLY while carrying an order. When
// it is RELEASED it returns to AVAILABLE: cleared of the order links, ready for
// the next pickup. WHEN the release happens is CONFIGURABLE per laundry
// (reusableBagReleaseStage: PROCESSING_RECEIVE | AFTER_DELIVERY) — the release logic
// itself is identical. History is NEVER lost — it lives in LaundryBagAssignment
// (closed as RETURNED) and LaundryBagRelease (append-only audit). No manual
// reset.
const RELEASABLE = ["ASSIGNED", "COLLECTED", "RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING", "OUT_FOR_DELIVERY"] as const

/**
 * When a reusable bag goes back into circulation.
 *
 * PROCESSING_RECEIVE — the moment the Processing Center scans it in. This
 * matches the physical reality: the garments come out of the bag there, so the
 * bag is free long before the order is finished. It is the default.
 *
 * AFTER_DELIVERY — the bag travels with the order all the way to the customer.
 *
 * "STORE_RECEIVE" is the legacy stored value. It fired on store ARRIVAL, which
 * the name never conveyed, and its status set already included PROCESSING —
 * so it is read as PROCESSING_RECEIVE rather than migrated, keeping existing
 * tenants on the behaviour closest to what they had.
 */
export type BagReleaseStage = "PROCESSING_RECEIVE" | "AFTER_DELIVERY"

export async function getBagReleaseStage(lbId: string): Promise<BagReleaseStage> {
  const b = await prisma.laundryBusiness.findUnique({ where: { id: lbId }, select: { reusableBagReleaseStage: true } })
  return b?.reusableBagReleaseStage === "AFTER_DELIVERY" ? "AFTER_DELIVERY" : "PROCESSING_RECEIVE"
}

// Core: return one bag to AVAILABLE + close its open assignment (history).
async function releaseBagRow(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  bagId: string, orderId: string | null, now: Date
) {
  const bg = await tx.laundryBag.findUnique({ where: { id: bagId }, select: { bagNumber: true, lastAssignmentId: true } })
  await tx.laundryBag.update({
    where: { id: bagId },
    data: {
      status: "AVAILABLE",
      currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null,
      currentCustomerId: null, currentCustomerName: null,
      lastReturnedAt: now, totalUsageCount: { increment: 1 },
      releasedAt: now, releasedBy: null, releaseReason: null,
    },
  })
  // Close assignment by lastAssignmentId (precise) or fallback to orderId.
  if (bg?.lastAssignmentId) {
    await tx.laundryBagAssignment.update({ where: { id: bg.lastAssignmentId }, data: { status: "RETURNED", returnedAt: now } })
  } else if (orderId) {
    await tx.laundryBagAssignment.updateMany({ where: { bagId, orderId, status: "ASSIGNED" }, data: { status: "RETURNED", returnedAt: now } })
  }
}

// Write an append-only release audit record.
async function writeReleaseAudit(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: ReleaseInput & { previousStatus: string }
) {
  const bag = await tx.laundryBag.findUnique({ where: { id: input.bagId }, select: { bagNumber: true, currentOrderId: true, currentOrderNumber: true } })
  if (!bag) return
  await tx.laundryBagRelease.create({
    data: {
      bagId: input.bagId,
      bagNumber: bag.bagNumber,
      businessId: input.lbId,
      storeId: input.storeId || null,
      orderId: bag.currentOrderId,
      orderNumber: bag.currentOrderNumber,
      releaseType: input.releaseType,
      reason: input.reason || null,
      previousStatus: input.previousStatus,
      newStatus: "AVAILABLE",
      releasedBy: input.releasedBy || null,
    },
  })
}

// Release ONE bag by QR scan or manual action. Creates an audit trail.
export async function releaseBagWithAudit(input: ReleaseInput): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const bag = await prisma.laundryBag.findFirst({
    where: { id: input.bagId, businessId: input.lbId },
    select: { id: true, status: true, currentOrderId: true },
  })
  if (!bag) return { ok: false, status: 404, error: "Bag not found." }
  if (bag.status === "AVAILABLE") return { ok: false, status: 409, error: "Bag is already AVAILABLE." }
  if (!(RELEASABLE as readonly string[]).includes(bag.status)) {
    return { ok: false, status: 409, error: `Bag is ${bag.status} and cannot be released.` }
  }

  const previousStatus = bag.status
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await releaseBagRow(tx, bag.id, bag.currentOrderId, now)
    await writeReleaseAudit(tx, { ...input, previousStatus })
  })
  return { ok: true }
}

// Release ALL bags carrying an order (e.g. AFTER_DELIVERY policy).
export async function releaseBagsForOrder(lbId: string, orderId: string): Promise<number> {
  // Find the order's bags TWO ways. currentOrderId is the live pointer, but a
  // bag can carry an order through an open LaundryBagAssignment while that
  // pointer has already been moved or cleared — and a bag found only that way
  // is exactly the one that would otherwise stay occupied for ever.
  const [byPointer, openAssignments] = await Promise.all([
    prisma.laundryBag.findMany({ where: { businessId: lbId, currentOrderId: orderId, status: { in: [...RELEASABLE] } }, select: { id: true, status: true } }),
    prisma.laundryBagAssignment.findMany({ where: { businessId: lbId, orderId, status: "ASSIGNED" }, select: { bagId: true } }),
  ])
  const extraIds = openAssignments.map((a) => a.bagId).filter((id) => !byPointer.some((b) => b.id === id))
  const byAssignment = extraIds.length
    ? await prisma.laundryBag.findMany({ where: { id: { in: extraIds }, businessId: lbId, status: { in: [...RELEASABLE] } }, select: { id: true, status: true } })
    : []
  const bags = [...byPointer, ...byAssignment]
  if (!bags.length) return 0
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    for (const b of bags) {
      await releaseBagRow(tx, b.id, orderId, now)
      await writeReleaseAudit(tx, { lbId, bagId: b.id, releaseType: "QR_SCAN", previousStatus: b.status })
    }
  })
  return bags.length
}

// Release ONE bag by ID (used by scan-advance endpoint). No audit row (legacy).
export async function releaseBag(lbId: string, bagId: string): Promise<boolean> {
  const bag = await prisma.laundryBag.findFirst({ where: { id: bagId, businessId: lbId, status: { in: [...RELEASABLE] } }, select: { id: true, currentOrderId: true, status: true } })
  if (!bag) return false
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await releaseBagRow(tx, bag.id, bag.currentOrderId, now)
    await writeReleaseAudit(tx, { lbId, bagId, releaseType: "QR_SCAN", previousStatus: bag.status })
  })
  return true
}

// Advance the bags carrying an order to a mid-lifecycle status (e.g.
// READY_FOR_DELIVERY) as the order progresses — display accuracy only. Never
// touches released/lost/damaged bags. Never triggers release.
export async function advanceBagsForOrder(lbId: string, orderId: string, status: string): Promise<void> {
  await prisma.laundryBag.updateMany({
    where: { businessId: lbId, currentOrderId: orderId, status: { notIn: ["AVAILABLE", "LOST", "DAMAGED", "RETIRED"] } },
    data: { status },
  }).catch(() => {})
}

// ── Release History ───────────────────────────────────────────────────────────
export interface ReleaseHistoryRow {
  id: string
  bagNumber: string
  bagId: string
  orderNumber: string | null
  releaseType: string
  reason: string | null
  previousStatus: string
  releasedBy: string | null
  releasedAt: Date
}

export async function getReleaseHistory(lbId: string, opts: { bagId?: string; limit?: number } = {}): Promise<ReleaseHistoryRow[]> {
  const where: Record<string, unknown> = { businessId: lbId }
  if (opts.bagId) where.bagId = opts.bagId
  const rows = await prisma.laundryBagRelease.findMany({
    where,
    orderBy: { releasedAt: "desc" },
    take: opts.limit || 100,
  })
  return rows as ReleaseHistoryRow[]
}
