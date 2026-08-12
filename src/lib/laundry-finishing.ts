// Container-based finishing workflow (after Quality Check).
//
// Garment barcodes are scanned through the cleaning stages and the merged Dry &
// Quality Check station (QC). QC is the final garment-barcode stage. Sorting is
// the permanent garment→bag transition: the operator scans every garment, then
// ONE laundry bag, binding the whole order to it (1 order = 1 bag) and retiring
// every garment barcode. From there on Iron / Folding / Transit operate on the
// PROCESSING CONTAINER — the tenant's configured scan target. No new entities:
// the container IS the existing LaundryProcessingPackage; this module only
// extends its lifecycle.
//
// Lifecycle (Architectural Decisions 3 & 4):
//   CREATED (after Store Audit / auto) → PROCESSING (garments being worked) →
//   READY_FOR_FINISHING (automatically, once every garment has passed QC, i.e.
//   reached Sorting) → READY (finishing complete) → PACKED (all garments packed) →
//   RELEASED (returned to the store / ready for delivery) → CLOSED (delivered /
//   cancelled). Forward-only — a package status never regresses.
//
// The package is created automatically — operators never create/print one.
import { prisma } from "@/lib/prisma"
import { generateProcessingPackageCode } from "@/lib/laundry-codes"
import { hasPassedQc, isProcessingTerminal } from "@/lib/laundry-processing"
import { assignBagToOrder } from "@/lib/laundry-bag-assign"

// Package lifecycle statuses. Additive — existing CREATED value is preserved.
export const PACKAGE_STATUS_FINISHING_READY = "READY_FOR_FINISHING"

const PACKAGE_RANK: Record<string, number> = {
  CREATED: 0, PROCESSING: 1, READY_FOR_FINISHING: 2, READY: 3, PACKED: 4, RELEASED: 5, CLOSED: 6,
}

// Workspace scan-mode → the label shown on the finishing workstations. Driven by
// the existing tenant setting processingPackageQrMode (never hardcoded):
//   GENERATE_NEW → the package carries a fresh PKG QR → operators scan the package.
//   REUSE_BAG    → the package reuses the pickup-bag QR    → operators scan the bag.
//   BOTH         → either scan target resolves the same processing batch.
export function finishingScanTarget(mode: string | null | undefined): {
  label: string
  isBag: boolean
  isPackage: boolean
  hint: string
} {
  const m = String(mode || "GENERATE_NEW")
  if (m === "REUSE_BAG") return { label: "Scan Laundry Bag", isBag: true, isPackage: false, hint: "BAG-… / PB-…" }
  if (m === "BOTH") return { label: "Scan Laundry Bag / Processing Packet", isBag: true, isPackage: true, hint: "PKG-… / BAG-… / PB-…" }
  return { label: "Scan Processing Packet", isBag: false, isPackage: true, hint: "PKG-…" }
}

// Acceptable code prefixes per scan mode (the system's own code formats):
//   Processing Package QR  → PKG-YYYYMM-NNNNNN
//   Reusable bag QR        → BAG-NNNNNN  ·  Pickup bag QR → PB-YYYYMM-NNNNNN
export function isProcessingPackageCode(code: string): boolean { return code.toUpperCase().startsWith("PKG-") }
export function isBagCode(code: string): boolean {
  const c = code.toUpperCase()
  return c.startsWith("BAG-") || c.startsWith("PB-")
}

// Pure scan-mode acceptance check for the finishing stations: does this code
// belong to the configured scan target? Returns an error string when the code
// is the WRONG kind for this workspace (operator guidance), null when allowed.
export function scanModeAcceptance(code: string, mode: string | null | undefined): string | null {
  const c = code.toUpperCase()
  const target = finishingScanTarget(mode)
  const isPkg = isProcessingPackageCode(c)
  const isBag = isBagCode(c)
  if (isPkg && !target.isPackage)
    return "This workspace scans the laundry bag, not a Processing Packet — scan the bag instead."
  if (isBag && !target.isBag)
    return "This workspace scans the Processing Packet — scan the packet QR instead of the bag."
  return null
}

// Garments belonging to a Processing Package: its OWN service only (a package
// created from a pickup bag is service-scoped), otherwise every garment on the
// order (walk-in / per-order package).
export function packageGarmentsWhere(pkg: { serviceId: string | null; orderId: string }) {
  return pkg.serviceId ? { orderId: pkg.orderId, serviceId: pkg.serviceId } : { orderId: pkg.orderId }
}

// Ensure the order has at least one Processing Package (its finishing container).
// Auto-created per-order the first time it is needed — operators are never asked
// to create/print one (Architectural Decision 4). Idempotent.
export async function ensureProcessingPackagesForOrder(orderId: string, businessId: string): Promise<void> {
  const existing = await prisma.laundryProcessingPackage.findFirst({ where: { orderId }, select: { id: true } })
  if (existing) return
  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, _count: { select: { items: true } } },
  })
  if (!order) return
  const code = await generateProcessingPackageCode()
  await prisma.laundryProcessingPackage.create({
    data: {
      code, qrValue: code, businessId, orderId, orderNumber: order.orderNumber,
      garmentCount: order._count.items, status: "CREATED",
    },
  }).catch(() => null)
}

// Finishing stages for the container lifecycle — the container stays
// READY_FOR_FINISHING until no garment is left at Iron / Folding.
const FINISHING = new Set<string>(["IRON", "FOLD"])

// Recompute the processing-package lifecycle for an order, FORWARD-ONLY
// (a package status never regresses). Call after every item-processing action
// and after order-level transitions (return dispatch, store receive, delivery).
// Self-healing: computes the target purely from the live order + garment state,
// so no container is ever orphaned — every status below derives from reality.
export async function syncPackageLifecycle(orderId: string, businessId: string): Promise<void> {
  const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { status: true } })
  if (!order) return
  await ensureProcessingPackagesForOrder(orderId, businessId)
  const packages = await prisma.laundryProcessingPackage.findMany({ where: { orderId }, select: { id: true, status: true } })
  if (!packages.length) return
  const items = await prisma.laundryOrderItem.findMany({
    where: { orderId },
    select: { processingStage: true, processingStatus: true },
  })
  if (!items.length) return

  const allPassedQc = items.every((i) => hasPassedQc(i.processingStage))
  const noneAtFinishing = items.every((i) => !FINISHING.has(i.processingStage || ""))
  const allTerminalDone = items.every((i) => isProcessingTerminal(i.processingStage) && i.processingStatus === "DONE")
  const processingStarted = items.some(
    (i) => i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED"
      || (!!i.processingStage && i.processingStage !== "RECEIVED"),
  )

  let target = "CREATED"
  if (order.status === "DELIVERED" || order.status === "CANCELLED") target = "CLOSED"
  else if (order.status === "RETURN_IN_TRANSIT" || order.status === "READY_FOR_DELIVERY") target = "RELEASED"
  else if (allTerminalDone) target = "PACKED"
  else if (allPassedQc && noneAtFinishing) target = "READY"
  else if (allPassedQc) target = "READY_FOR_FINISHING"
  else if (processingStarted || order.status === "PROCESSING" || order.status === "QC_PENDING") target = "PROCESSING"

  for (const pkg of packages) {
    if ((PACKAGE_RANK[pkg.status] ?? 0) < PACKAGE_RANK[target]) {
      await prisma.laundryProcessingPackage.update({ where: { id: pkg.id }, data: { status: target } }).catch(() => null)
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDER-BASED FINISHING BAG MODEL
// ══════════════════════════════════════════════════════════════════════════════
// One Order = exactly one finishing bag, assigned ONCE, at SORTING — the point
// where the operator has scanned every garment of the order and the scanned set
// equals the expected count. At that single moment the operator scans the
// configured container (Laundry Bag, Processing Package, or Both — per Workspace
// Scan Mode) and the WHOLE order is associated with it. Every garment barcode is
// then retired; Ironing/Folding/Transit operate only by scanning the container.
//
// Enforcements:
//   • one active finishing bag per order   — bagAssigned flips once (server re-checks)
//   • each finishing bag belongs to one order — the scanned code must resolve to
//     THIS order's package / bag (a bag linked to another order is rejected)
//   • no garment-barcode scanning after Sorting — barcodeRetired is set on every item
// ══════════════════════════════════════════════════════════════════════════════

// The container label + code hints for the bag-assignment prompt (Scan Mode).
// Alias of finishingScanTarget — the workspace setting decides the ONLY accepted
// scan target. Never hardcoded.
export function finishingBagTarget(mode: string | null | undefined) { return finishingScanTarget(mode) }

// Recompute the finishing-bag readiness for an order WITHOUT assigning anything.
// Returns the binding package when the order is (looking for) the ONE container to
// scan (every garment passed QC and none is bagAssigned yet), else null.
export async function awaitingFinishingBagAssignment(
  orderId: string, businessId: string,
): Promise<{ orderId: string; packageId: string; orderNumber: string | null; code: string; status: string } | null> {
  const order = await prisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, status: true },
  })
  if (!order) return null
  if (order.status === "CANCELLED" || order.status === "DELIVERED") return null
  const [items, packages] = await Promise.all([
    prisma.laundryOrderItem.findMany({ where: { orderId }, select: { processingStage: true } }),
    prisma.laundryProcessingPackage.findMany({ where: { orderId, bagAssigned: false }, select: { id: true, code: true, status: true } }),
  ])
  if (!items.length || !items.every((i) => hasPassedQc(i.processingStage))) return null
  const pkg = packages.find((p) => p.status === "READY_FOR_FINISHING") || packages[0]
  if (!pkg) return null
  return { orderId, orderNumber: order.orderNumber, packageId: pkg.id, code: pkg.code, status: pkg.status }
}

export type AssignBagResult =
  | { ok: true; packageId: string; code: string; bagCode: string; retired: number }
  | { ok: false; error: string; code: "INVALID" | "ORDER_NOT_FOUND" | "NOT_ELIGIBLE" | "ALREADY_ASSIGNED" | "WRONG_ORDER" }

// Bind the order-based finishing bag at Sorting. Scanning the configured
// container when the operator has scanned every garment of the order (scanned set
// equals the order) associates EVERY garment with the binder container and retires
// all garment barcodes. Pure + idempotent: re-scanning after success is a no-op
// guard (ALREADY_ASSIGNED), never a second bag. The caller (Sorting workstation)
// advances the garments past Sorting after a successful assignment.
export async function assignFinishingBag(opts: {
  orderId: string; businessId: string; code: string; mode: string; actorName?: string | null
}): Promise<AssignBagResult> {
  const { orderId, businessId, actorName } = opts
  const c = String(opts.code || "").trim()
  if (!c) return { ok: false, error: "Scan a container code to assign the finishing bag.", code: "INVALID" }

  const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { orderNumber: true, status: true } })
  if (!order) return { ok: false, error: "Order not found.", code: "ORDER_NOT_FOUND" }
  if (order.status === "CANCELLED" || order.status === "DELIVERED")
    return { ok: false, error: "This order is no longer in processing — bag cannot be assigned.", code: "NOT_ELIGIBLE" }

  const items = await prisma.laundryOrderItem.findMany({ where: { orderId }, select: { id: true, processingStage: true } })
  if (!items.length) return { ok: false, error: "This order has no garments.", code: "NOT_ELIGIBLE" }
  if (!items.every((i) => hasPassedQc(i.processingStage)))
    return { ok: false, error: "Assign the bag only after every garment in the order has passed Quality Check and reached Sorting.", code: "NOT_ELIGIBLE" }

  // Single active finishing bag per order — never a second.
  const already = await prisma.laundryProcessingPackage.findFirst({ where: { orderId, bagAssigned: true }, select: { code: true } })
  if (already) return { ok: false, error: `This order already has finishing bag ${already.code}.`, code: "ALREADY_ASSIGNED" }

  // Scan-mode gate (Bag / Processing Package / Both — Workspace setting, never hardcoded).
  const modeError = scanModeAcceptance(c, opts.mode)
  if (modeError) return { ok: false, error: modeError, code: "INVALID" }
  const target = finishingScanTarget(opts.mode)

  // The scanned code must belong to THIS order. An unassigned package is a
  // candidate; a bag QR must resolve to this order's bag (one bag → one order).
  const packages = await prisma.laundryProcessingPackage.findMany({
    where: { orderId, bagAssigned: false },
    select: { id: true, code: true, qrValue: true, serviceId: true },
  })
  if (!packages.length) return { ok: false, error: "No finishing container is available for this order.", code: "INVALID" }

  let targetPkg = packages.find((p) => p.code === c || p.qrValue === c) || null

  if (!targetPkg) {
    const bag = await prisma.laundryBag.findFirst({
      where: { businessId, OR: [{ bagNumber: c }, { qrValue: c }] },
      select: { id: true, bagNumber: true, currentOrderId: true, status: true },
    })
    if (bag) {
      // A bag is a reusable asset, not the property of an order. The only
      // question is whether it is occupied RIGHT NOW:
      //
      //   already on this order   → accept (re-scan)
      //   free                    → bind it to this order and accept
      //   on another live order   → refuse
      //
      // The old check compared currentOrderId to this order, which rejected an
      // AVAILABLE bag too (its currentOrderId is null), so a bag released at the
      // Processing Center could never be reused by the very order it had just
      // carried.
      if (bag.currentOrderId !== orderId) {
        // "Occupied" means occupied by a LIVE order. A pointer left behind by a
        // delivered or cancelled order is stale, not occupancy, and must not
        // keep a physical bag out of service.
        let occupied = bag.status !== "AVAILABLE"
        if (occupied && bag.currentOrderId) {
          const linked = await prisma.laundryOrder.findUnique({ where: { id: bag.currentOrderId }, select: { status: true } })
          if (!linked || linked.status === "DELIVERED" || linked.status === "CANCELLED") {
            await prisma.laundryBag.updateMany({
              where: { id: bag.id, currentOrderId: bag.currentOrderId },
              data: { status: "AVAILABLE", currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null },
            }).catch(() => null)
            occupied = false
          }
        }
        if (occupied) {
          return { ok: false, error: `Bag ${bag.bagNumber} is currently assigned to another active order. Please use another available bag.`, code: "WRONG_ORDER" }
        }
        const assigned = await assignBagToOrder({ lbId: businessId, code: bag.bagNumber, orderId })
        if (!assigned.ok) return { ok: false, error: assigned.error, code: "WRONG_ORDER" }
      }
      targetPkg = packages[0]
    } else {
      const pickupBag = await prisma.laundryPickupBag.findFirst({
        where: { businessId, OR: [{ code: c }, { qrValue: c }] },
        select: { orderId: true },
      })
      if (pickupBag) {
        if (pickupBag.orderId !== orderId)
          return { ok: false, error: "This pickup bag belongs to a different order.", code: "WRONG_ORDER" }
        targetPkg = packages[0]
      }
    }
  }

  if (!targetPkg)
    return {
      ok: false, code: "INVALID",
      error: `"${c}" is not this order's container — scan the ${target.isPackage ? "Processing Packet" : "laundry bag"} for ${order.orderNumber}.`,
    }

  await prisma.laundryProcessingPackage.update({
    where: { id: targetPkg.id },
    data: { bagAssigned: true, bagAssignedAt: new Date(), bagAssignedBy: actorName || null, bagCode: c, qrValue: c },
  })

  const retired = await prisma.laundryOrderItem.updateMany({ where: { orderId }, data: { barcodeRetired: true } }).then((r) => r.count)

  await prisma.laundryOrderEvent.create({
    data: {
      orderId, businessId, fromStatus: order.status, toStatus: order.status,
      action: "FINISHING_BAG_ASSIGNED", actorName: actorName || null,
      note: `Finishing bag ${c} assigned; ${retired} garment barcodes retired`,
    },
  }).catch(() => null)

  return { ok: true, packageId: targetPkg.id, code: targetPkg.code, bagCode: c, retired }
}

// Does this order still allow a garment-barcode scan? It does until its finishing
// bag is assigned (post-bag, garment barcodes are retired and Iron/Fold/Packing
// scan only the container). One guard, reused by the process + scan routes.
export async function finishingBagAssigned(orderId: string): Promise<boolean> {
  const p = await prisma.laundryProcessingPackage.findFirst({ where: { orderId, bagAssigned: true }, select: { id: true } })
  return !!p
}
