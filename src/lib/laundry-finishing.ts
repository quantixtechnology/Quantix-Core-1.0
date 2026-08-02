// Container-based finishing workflow (after Quality Check).
//
// Garment barcodes are scanned through the cleaning stages and QC. QC is the
// final garment-barcode stage. From there on, Iron / Folding operate on
// the PROCESSING CONTAINER — the tenant's configured scan target. No new
// entities: the container IS the existing LaundryProcessingPackage; this module
// only extends its lifecycle.
//
// Lifecycle (Architectural Decisions 3 & 4):
//   CREATED (after Store Audit / auto) → PROCESSING (garments being worked) →
//   READY_FOR_FINISHING (automatically, once every garment inside the package
//   has passed QC) → READY (finishing complete) → PACKED (all garments packed) →
//   RELEASED (returned to the store / ready for delivery) → CLOSED (delivered /
//   cancelled). Forward-only — a package status never regresses.
//
// The package is created automatically — operators never create/print one.
import { prisma } from "@/lib/prisma"
import { generateProcessingPackageCode } from "@/lib/laundry-codes"
import { hasPassedQc } from "@/lib/laundry-processing"

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
  if (m === "REUSE_BAG") return { label: "Scan Bag QR", isBag: true, isPackage: false, hint: "BAG-… / PB-…" }
  if (m === "BOTH") return { label: "Scan Bag or Processing Package QR", isBag: true, isPackage: true, hint: "PKG-… / BAG-… / PB-…" }
  return { label: "Scan Processing Package QR", isBag: false, isPackage: true, hint: "PKG-…" }
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
    return "This workspace scans the bag, not the Processing Package — scan the bag QR instead."
  if (isBag && !target.isBag)
    return "This workspace scans the Processing Package — scan the package QR instead of the bag."
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
  const allPackedDone = items.every((i) => i.processingStage === "PACKED" && i.processingStatus === "DONE")
  const processingStarted = items.some(
    (i) => i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED"
      || (!!i.processingStage && i.processingStage !== "RECEIVED"),
  )

  let target = "CREATED"
  if (order.status === "DELIVERED" || order.status === "CANCELLED") target = "CLOSED"
  else if (order.status === "RETURN_IN_TRANSIT" || order.status === "READY_FOR_DELIVERY") target = "RELEASED"
  else if (allPackedDone) target = "PACKED"
  else if (allPassedQc && noneAtFinishing) target = "READY"
  else if (allPassedQc) target = "READY_FOR_FINISHING"
  else if (processingStarted || order.status === "PROCESSING" || order.status === "QC_PENDING") target = "PROCESSING"

  for (const pkg of packages) {
    if ((PACKAGE_RANK[pkg.status] ?? 0) < PACKAGE_RANK[target]) {
      await prisma.laundryProcessingPackage.update({ where: { id: pkg.id }, data: { status: target } }).catch(() => null)
    }
  }
}
