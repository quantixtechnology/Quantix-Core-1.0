import { prisma } from "@/lib/prisma"

// ─── Code Generators ────────────────────────────────────────────────────────
// All codes use human-readable formats, NOT database IDs.
// Sequential numbers reset per-prefix (per month for top-level entities,
// per parent for child entities).
// ────────────────────────────────────────────────────────────────────────────

const CODES = {
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

// ─── Business Code: LND-YYYYMM-NNNN ─────────────────────────────────────────
// Example: LND-202606-0001
export async function generateBusinessCode(): Promise<string> {
  const prefix = `${CODES.BUSINESS_PREFIX}-${getMonthPrefix()}-`
  const next = await getNextSequential("laundryBusiness", "businessCode", prefix)
  return `${prefix}${padNumber(next)}`
}

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

// ─── Store Code: STR-LND-YYYYMM-NNNN-NNN ────────────────────────────────────
// Example: STR-LND-202606-0001-001
export async function generateStoreCode(businessCode: string): Promise<string> {
  const prefix = `${CODES.STORE_PREFIX}-${businessCode}-`
  const next = await getNextSequential("laundryStore", "storeCode", prefix)
  return `${prefix}${padNumber(next, 3)}`
}

// ─── Processing Center Code: PC-LND-YYYYMM-NNNN-NNN ─────────────────────────
// Example: PC-LND-202606-0001-001
export async function generateProcessingCenterCode(businessCode: string): Promise<string> {
  const prefix = `${CODES.PROCESSING_CENTER_PREFIX}-${businessCode}-`
  const next = await getNextSequential("laundryProcessingCenter", "centerCode", prefix)
  return `${prefix}${padNumber(next, 3)}`
}

// ─── Order Number: ORD-STR-{storeCode}-NNNNNN ──────────────────────────────
// Example: ORD-STR-LND-202606-0001-001-000001
// Scoped per store — sequential within the store.
export async function generateOrderNumber(storeCode: string): Promise<string> {
  const prefix = `${CODES.ORDER_PREFIX}-${storeCode}-`
  const next = await getNextSequential("laundryOrder", "orderNumber", prefix)
  return `${prefix}${padNumber(next, 6)}`
}

// ─── Item / Garment Tag Number: ITM-{orderNumber}-NNNN ─────────────────────
// Example: ITM-ORD-STR-LND-202606-0001-001-000001-0001
// Scoped per order — sequential within the order.
export async function generateItemNumber(orderNumber: string): Promise<string> {
  const prefix = `${CODES.ITEM_PREFIX}-${orderNumber}-`
  const next = await getNextSequential("laundryOrderItem", "itemNumber", prefix)
  return `${prefix}${padNumber(next, 4)}`
}

// ─── Customer Code: CUS-{businessCode}-NNNNNN ──────────────────────────────
// Example: CUS-LND-202607-0001-000001  (sequential within the business)
export async function generateCustomerCode(businessCode: string): Promise<string> {
  const prefix = `${CODES.CUSTOMER_PREFIX}-${businessCode}-`
  const next = await getNextSequential("customer", "customerCode", prefix)
  return `${prefix}${padNumber(next, 6)}`
}

// ─── Packet Number: PKT-{orderNumber} ──────────────────────────────────────
// Example: PKT-ORD-STR-LND-202607-0001-001-000001  (QR opens the order)
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
export const generateReceiptNumber = () => monthScoped(CODES.RECEIPT_PREFIX, "laundryPayment", "receiptNumber")
export const generatePaymentNumber = () => monthScoped(CODES.PAYMENT_PREFIX, "laundryPayment", "paymentNumber")

// ─── Transport Batch Number: TB-LND-YYYYMM-NNNN-NNNNNN ────────────────────
// Example: TB-LND-202606-0001-000001
// Scoped per business.
export async function generateTransportBatchNumber(businessCode: string): Promise<string> {
  const prefix = `${CODES.TRANSPORT_BATCH_PREFIX}-${businessCode}-`
  const next = await getNextSequential("laundryTransportBatch", "batchNumber", prefix)
  return `${prefix}${padNumber(next, 6)}`
}

// ─── Examples ───────────────────────────────────────────────────────────────
// Business Code:        LND-202606-0001
// Store Code:           STR-LND-202606-0001-001
// Processing Center:    PC-LND-202606-0001-001
// Order Number:         ORD-STR-LND-202606-0001-001-000001
// Item / Garment Tag:   ITM-ORD-STR-LND-202606-0001-001-000001-0001
// Transport Batch:      TB-LND-202606-0001-000001
