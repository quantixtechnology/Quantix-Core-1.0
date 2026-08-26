import { prisma } from "@/lib/prisma"

// ─── Code Generators ────────────────────────────────────────────────────────
// All codes use human-readable formats, NOT database IDs.
// Sequential numbers reset per-prefix (per month for top-level entities,
// per parent for child entities).
// ────────────────────────────────────────────────────────────────────────────

const CODES = {
  // Laundry's DOCUMENT-SERIES namespace — INV-LND-…, RCT-LND-…, PAY-LND-…,
  // SUB-LND-…. It marks which product issued the document and carries no
  // business number, so it is not a business identity and never was one.
  // The business identity is the canonical Business Code, passed in.
  BUSINESS_PREFIX: "LND",
  STORE_PREFIX: "STR",
  PROCESSING_CENTER_PREFIX: "PC",
  CUSTOMER_PREFIX: "CUS",
  ORDER_PREFIX: "ORD",
  PACKET_PREFIX: "PKT",
  ITEM_PREFIX: "ITM",
  INVOICE_PREFIX: "INV",
  RECEIPT_PREFIX: "RCT",
  PAYMENT_PREFIX: "PAY",
  TRANSPORT_BATCH_PREFIX: "TB",
} as const

function getMonthPrefix(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
}

function padNumber(n: number, width = 4): string {
  return String(n).padStart(width, "0")
}

// ─── Generic sequential helper ──────────────────────────────────────────────
async function getNextSequential(
  model: string,
  codeField: string,
  searchPrefix: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaModel = (prisma as any)[model]
  if (!prismaModel) throw new Error(`Prisma model "${model}" not found`)

  const last = await prismaModel.findFirst({
    where: { [codeField]: { startsWith: searchPrefix } },
    orderBy: { [codeField]: "desc" },
    select: { [codeField]: true },
  })

  if (!last) return 1

  const parts = last[codeField].split("-")
  return parseInt(parts[parts.length - 1], 10) + 1
}

// ─── Business Code — REMOVED. There is no laundry business code. ────────────
//
// This module used to mint `LND-YYYYMM-NNNN` off a laundry-only sequence, and
// that value was written into the PLATFORM Business row as well as the laundry
// one — giving a tenant a second, competing business identity that read
// LND-202608-0002 where the platform had already issued BUS-202606-0005.
//
// The canonical Business Code has exactly one generator, for every product:
// allocateBusinessCode() in src/lib/business-code.ts. Laundry consumes it; it
// does not mint one. Every generator below takes a `businessCode` argument and
// is agnostic about which product the tenant runs — that is the whole point.
//
// Existing tenants keep the LND-… value already stored on LaundryBusiness: it
// is legacy/internal, their store, customer and order series embed it, and
// renumbering them would strand identifiers that are still in daily use.

// ─── Pickup Bag Code: PB-YYYYMM-NNNNNN ──────────────────────────────────────
// One physical pickup bag (one per booked service). QR at pickup.
export async function generatePickupBagCode(): Promise<string> {
  const prefix = `PB-${getMonthPrefix()}-`
  const next = await getNextSequential("laundryPickupBag", "code", prefix)
  return `${prefix}${padNumber(next, 6)}`
}

// ─── Processing Package Code: PKG-YYYYMM-NNNNNN ─────────────────────────────
// The operational QR generated after Store Audit (unless the tenant reuses the
// pickup bag QR).
export async function generateProcessingPackageCode(): Promise<string> {
  const prefix = `PKG-${getMonthPrefix()}-`
  const next = await getNextSequential("laundryProcessingPackage", "code", prefix)
  return `${prefix}${padNumber(next, 6)}`
}

// ─── Store Code: STR-{businessCode}-NNN ─────────────────────────────────────
// Example: STR-BUS-202606-0005-001
export async function generateStoreCode(businessCode: string): Promise<string> {
  const prefix = `${CODES.STORE_PREFIX}-${businessCode}-`
  const next = await getNextSequential("laundryStore", "storeCode", prefix)
  return `${prefix}${padNumber(next, 3)}`
}

// ─── Processing Center Code: PC-{businessCode}-NNN ──────────────────────────
// Example: PC-BUS-202606-0005-001
export async function generateProcessingCenterCode(businessCode: string): Promise<string> {
  const prefix = `${CODES.PROCESSING_CENTER_PREFIX}-${businessCode}-`
  const next = await getNextSequential("laundryProcessingCenter", "centerCode", prefix)
  return `${prefix}${padNumber(next, 3)}`
}

// ─── Order Number: ORD-STR-{storeCode}-NNNNNN ──────────────────────────────
// Example: ORD-STR-BUS-202606-0005-001-000001
// Scoped per store — sequential within the store.
export async function generateOrderNumber(storeCode: string): Promise<string> {
  const prefix = `${CODES.ORDER_PREFIX}-${storeCode}-`
  const liveNext = await getNextSequential("laundryOrder", "orderNumber", prefix)
  // Retired numbers (from permanently-deleted orders) are NEVER reissued — the
  // sequence only moves forward. Take the max of the live and the retired series.
  const retired = await prisma.laundryDeletedOrderLog.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  })
  const retiredNext = retired ? parseInt(retired.orderNumber.split("-").pop() || "0", 10) + 1 : 1
  const next = Math.max(liveNext, retiredNext)
  return `${prefix}${padNumber(next, 6)}`
}

// ─── Item / Garment Tag Number: ITM-{orderNumber}-NNNN ─────────────────────
// Example: ITM-ORD-STR-BUS-202606-0005-001-000001-0001
// Scoped per order — sequential within the order.
export async function generateItemNumber(orderNumber: string): Promise<string> {
  const prefix = `${CODES.ITEM_PREFIX}-${orderNumber}-`
  const next = await getNextSequential("laundryOrderItem", "itemNumber", prefix)
  return `${prefix}${padNumber(next, 4)}`
}

// ─── Customer Code — REMOVED. There is one generator, in customer-code.ts. ──
//
// This one took a code STRING, so whatever the caller was holding ended up
// inside a permanent customer identifier — a laundry workspace's own `LND-…`
// code, or a legacy `BIZ-{SLUG}-{Date.now()}`. It also numbered by scanning for
// the highest existing code, which reissues a number once the top customer is
// hard-deleted.
//
// generateCustomerCode(businessId) in src/lib/customer-code.ts resolves the
// canonical Business Code itself and draws from a monotonic counter.

// ─── Packet Number: PKT-{orderNumber} ──────────────────────────────────────
// Example: PKT-ORD-STR-BUS-202606-0005-001-000001  (QR opens the order)
export function generatePacketNumber(orderNumber: string): string {
  return `${CODES.PACKET_PREFIX}-${orderNumber}`
}

// ─── Invoice / Receipt / Payment: {PREFIX}-LND-YYYYMM-NNNNNN ───────────────
// Example: INV-LND-202607-000001 · RCT-LND-202607-000001 · PAY-LND-202607-000001
async function monthScoped(prefixCode: string, model: string, field: string): Promise<string> {
  const prefix = `${prefixCode}-${CODES.BUSINESS_PREFIX}-${getMonthPrefix()}-`
  const next = await getNextSequential(model, field, prefix)
  return `${prefix}${padNumber(next, 6)}`
}
export const generateInvoiceNumber = () => monthScoped(CODES.INVOICE_PREFIX, "laundryInvoice", "invoiceNumber")
// Membership ID — the permanent member identifier + QR payload. SUB-LND-YYYYMM-NNNNNN.
export const generateMembershipNumber = () => monthScoped("SUB", "customerSubscription", "membershipId")
export const generateReceiptNumber = () => monthScoped(CODES.RECEIPT_PREFIX, "laundryPayment", "receiptNumber")
export const generatePaymentNumber = () => monthScoped(CODES.PAYMENT_PREFIX, "laundryPayment", "paymentNumber")

// ─── Transport Batch Number: TB-{businessCode}-NNNNNN ──────────────────────
// Example: TB-BUS-202606-0005-000001
// Scoped per business.
export async function generateTransportBatchNumber(businessCode: string): Promise<string> {
  const prefix = `${CODES.TRANSPORT_BATCH_PREFIX}-${businessCode}-`
  const next = await getNextSequential("laundryTransportBatch", "batchNumber", prefix)
  return `${prefix}${padNumber(next, 6)}`
}

// ─── Global Garment Number (GAR) — platform-wide atomic sequence ────────────
// GAR000000000001, GAR000000000002, … GAR999999999999, GAR1000000000000, …
// Never per-business, never per-store, never reset, never recycled.
// Counter auto-extends when 12 digits are exhausted.
export async function nextGarScanCode(): Promise<string> {
  const { prisma } = await import("@/lib/prisma")
  const result = await prisma.laundryGarSequenceCounter.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", next: 2 },
    update: { next: { increment: 1 } },
  })
  const n = result.next - 1
  return `GAR${String(n).padStart(12, "0")}`
}

// Self-heal the GAR counter so it can NEVER re-issue an existing code.
//
// garmentScanCode is globally @unique. If the singleton counter ever drifts
// BEHIND the highest code already persisted (e.g. a DB restore reset the counter
// while the LaundryOrderItem rows survived), nextGarScanCode() starts handing
// back codes that already exist → every insert dies with P2002 and garments
// can't be saved. This jumps the counter forward to (maxUsed + 1) when — and
// only when — it is behind. Idempotent, forward-only (never lowers a healthy
// counter), and cheap (one indexed lookup). Call before generating GAR codes.
export async function healGarSequenceCounter(): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  // Highest GAR code in use. Codes are zero-padded to 12 digits, so below the
  // 12-digit ceiling lexical order == numeric order (matches the padding above).
  const top = await prisma.laundryOrderItem.findFirst({
    where: { garmentScanCode: { not: null } },
    orderBy: { garmentScanCode: "desc" },
    select: { garmentScanCode: true },
  })
  const maxN = top?.garmentScanCode ? parseInt(top.garmentScanCode.replace(/^GAR/, ""), 10) : 0
  if (!Number.isFinite(maxN) || maxN <= 0) return
  // nextGarScanCode() (update branch) issues the counter's CURRENT value, so to
  // issue maxN + 1 next, counter.next must equal maxN + 1.
  const target = maxN + 1
  const counter = await prisma.laundryGarSequenceCounter.findUnique({ where: { id: "singleton" } })
  if (!counter) {
    await prisma.laundryGarSequenceCounter.create({ data: { id: "singleton", next: target } })
  } else if (counter.next < target) {
    await prisma.laundryGarSequenceCounter.update({ where: { id: "singleton" }, data: { next: target } })
  }
}

// ─── GAR shape ──────────────────────────────────────────────────────────────
// A GAR is `GAR` + at least 12 digits (the counter auto-extends past 12, see
// nextGarScanCode). Anything else in garmentScanCode is NOT a GAR and is never
// treated as one — in particular it is never silently overwritten, because a
// value we don't recognise is a value we don't understand.
export const GAR_PATTERN = /^GAR\d{12,}$/
export const isGarScanCode = (v: string | null | undefined): v is string =>
  typeof v === "string" && GAR_PATTERN.test(v)

// The legacy per-order item number that used to be written into `barcode`
// before GAR existed: ITM-{orderNumber}-NNNN. It stays in `itemNumber` forever
// (old labels must keep scanning) — it just must not be the BARCODE any more.
export const isLegacyItmBarcode = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.startsWith(`${CODES.ITEM_PREFIX}-`)

// ─── Scope ──────────────────────────────────────────────────────────────────
// Every audit / backfill below is scoped, and an EMPTY scope means "every
// tenant". Callers touching production data are expected to name a business,
// an order, or an explicit set of items — one tenant's repair must never
// silently rewrite another's rows.
export interface GarScope {
  /** LaundryOrder.businessId (the LaundryBusiness id). */
  businessId?: string | null
  orderId?: string | null
  itemIds?: string[] | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scopeWhere(scope: GarScope): any {
  const where: Record<string, unknown> = {}
  if (scope.itemIds && scope.itemIds.length) where.id = { in: scope.itemIds }
  if (scope.orderId) where.orderId = scope.orderId
  if (scope.businessId) where.order = { businessId: scope.businessId }
  return where
}

export interface GarAuditReport {
  /** Items in scope. */
  total: number
  /** garmentScanCode IS NULL — needs a GAR minted. */
  nullGar: number
  /** garmentScanCode set but not GAR-shaped — reported, never rewritten. */
  invalidGar: number
  /** garmentScanCode is a valid GAR (whatever the barcode says). */
  existingGar: number
  /** barcode still holds the legacy ITM-… value. */
  itmBarcode: number
  /** Valid GAR AND barcode === that GAR. Nothing to do. */
  alreadyCorrect: number
  /** Rows a backfill would write to (nullGar + ITM/empty barcode with a GAR). */
  needsWork: number
}

/**
 * READ-ONLY. Counts the GAR state of a scoped population so a migration can be
 * baselined before it runs and proved after it runs. Writes nothing.
 */
export async function auditGarScanCodes(scope: GarScope = {}): Promise<GarAuditReport> {
  const { prisma } = await import("@/lib/prisma")
  const rows = await prisma.laundryOrderItem.findMany({
    where: scopeWhere(scope),
    select: { garmentScanCode: true, barcode: true },
  })
  const report: GarAuditReport = {
    total: rows.length, nullGar: 0, invalidGar: 0, existingGar: 0,
    itmBarcode: 0, alreadyCorrect: 0, needsWork: 0,
  }
  for (const r of rows) {
    const validGar = isGarScanCode(r.garmentScanCode)
    if (!r.garmentScanCode) report.nullGar++
    else if (!validGar) report.invalidGar++
    else report.existingGar++
    if (isLegacyItmBarcode(r.barcode)) report.itmBarcode++
    if (validGar && r.barcode === r.garmentScanCode) report.alreadyCorrect++
    // What a backfill would actually write: mint a missing GAR, or point a
    // legacy/empty barcode at the GAR the row already has.
    if (!r.garmentScanCode) report.needsWork++
    else if (validGar && r.barcode !== r.garmentScanCode && (!r.barcode || isLegacyItmBarcode(r.barcode))) report.needsWork++
  }
  return report
}

export interface GarBackfillResult {
  /** GAR codes minted for rows that had none. */
  filled: number
  /** Legacy/empty barcodes repointed at the row's GAR. */
  barcodesRewritten: number
  /** Rows whose garmentScanCode is set but not GAR-shaped — left untouched. */
  invalidGarSkipped: number
  /** Rows whose barcode is neither empty nor ITM-shaped — left untouched. */
  foreignBarcodeSkipped: number
  /** Rows examined. */
  scanned: number
}

/**
 * Bring a scoped population up to the GAR invariant: every garment carries a
 * globally-unique GAR, and `barcode` holds that GAR.
 *
 *   NULL garmentScanCode        → mint a GAR, point barcode at it
 *   valid GAR + ITM/empty barcode → point barcode at the EXISTING GAR
 *   valid GAR + matching barcode  → nothing
 *   garmentScanCode set but not GAR-shaped → SKIPPED and reported
 *   barcode that is neither empty nor ITM-  → SKIPPED and reported
 *
 * An existing GAR is never renumbered, never re-minted, never overwritten.
 * Idempotent — a second run reports zero work. `itemNumber` is never touched,
 * so old ITM labels keep resolving through the scan route.
 */
export async function backfillGarScanCodes(
  opts: { chunkSize?: number; scope?: GarScope } = {},
): Promise<GarBackfillResult> {
  const { prisma } = await import("@/lib/prisma")
  const chunkSize = opts.chunkSize ?? 50
  const scope = opts.scope ?? {}
  await healGarSequenceCounter() // never re-issue an existing code

  const out: GarBackfillResult = {
    filled: 0, barcodesRewritten: 0, invalidGarSkipped: 0, foreignBarcodeSkipped: 0, scanned: 0,
  }

  // Cursor pagination, not "re-query the unfixed set": rows we deliberately
  // SKIP stay in the filter, so a re-query loop would never terminate.
  let cursor: string | undefined
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await prisma.laundryOrderItem.findMany({
      where: scopeWhere(scope),
      select: { id: true, garmentScanCode: true, barcode: true },
      orderBy: { id: "asc" },
      take: chunkSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!rows.length) break
    cursor = rows[rows.length - 1].id

    for (const row of rows) {
      out.scanned++
      let gar = row.garmentScanCode

      if (!isGarScanCode(gar)) {
        if (gar) { out.invalidGarSkipped++; continue } // unrecognised — leave for a human
        gar = await nextGarScanCode()
        await prisma.laundryOrderItem.update({
          where: { id: row.id },
          data: { garmentScanCode: gar, barcode: gar },
        })
        out.filled++
        continue // barcode was set in the same write
      }

      // Valid GAR already present — preserve it, and only correct the barcode.
      if (row.barcode === gar) continue
      if (!row.barcode || isLegacyItmBarcode(row.barcode)) {
        await prisma.laundryOrderItem.update({ where: { id: row.id }, data: { barcode: gar } })
        out.barcodesRewritten++
      } else {
        out.foreignBarcodeSkipped++
      }
    }
  }
  return out
}

// ─── Examples ───────────────────────────────────────────────────────────────
// Every one of these embeds the CANONICAL Business Code, which the platform
// issues and laundry only consumes.
//
// Business Code:        BUS-202606-0005   ← src/lib/business-code.ts
// Store Code:           STR-BUS-202606-0005-001
// Processing Center:    PC-BUS-202606-0005-001
// Order Number:         ORD-STR-BUS-202606-0005-001-000001
// Item / Garment Tag:   ITM-ORD-STR-BUS-202606-0005-001-000001-0001
// Customer Code:        CUS-BUS-202606-0005-000001
// Transport Batch:      TB-BUS-202606-0005-000001
//
// Tenants provisioned before this correction embed the retired LND-… value and
// KEEP it — those identifiers are live and must stay resolvable.
