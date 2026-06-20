import { prisma } from "@/lib/prisma"

// ─── Code Generators ────────────────────────────────────────────────────────
// All codes use human-readable formats, NOT database IDs.
// Format: PREFIX-YYYYMM-NNNN with zero-padded sequential numbers.
// ────────────────────────────────────────────────────────────────────────────

const CODES = {
  BUSINESS_PREFIX: "LND",
  STORE_PREFIX: "STR",
  PROCESSING_CENTER_PREFIX: "PC",
  ORDER_PREFIX: "ORD",
  GARMENT_TAG_PREFIX: "GT",
  TRANSPORT_BATCH_PREFIX: "TB",
} as const

function getMonthPrefix(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
}

async function getNextSequentialNumber(
  model: string,
  codeField: string,
  prefix: string,
): Promise<number> {
  const monthPrefix = getMonthPrefix()
  const searchPrefix = `${prefix}-${monthPrefix}-`

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

function padNumber(n: number, width = 4): string {
  return String(n).padStart(width, "0")
}

// ─── Business Code: LND-202606-0001 ─────────────────────────────────────────
export async function generateBusinessCode(): Promise<string> {
  const next = await getNextSequentialNumber("laundryBusiness", "businessCode", CODES.BUSINESS_PREFIX)
  return `${CODES.BUSINESS_PREFIX}-${getMonthPrefix()}-${padNumber(next)}`
}

// ─── Store Code: STR-LND-202606-0001-001 ────────────────────────────────────
export async function generateStoreCode(businessCode: string): Promise<string> {
  const prefix = `${CODES.STORE_PREFIX}-${businessCode}`
  const next = await getNextSequentialNumber("laundryStore", "storeCode", prefix)
  return `${prefix}-${padNumber(next, 3)}`
}

// ─── Processing Center Code: PC-BUSINESSCODE-001 ────────────────────────────
export async function generateProcessingCenterCode(businessCode: string): Promise<string> {
  const prefix = `${CODES.PROCESSING_CENTER_PREFIX}-${businessCode}`
  const next = await getNextSequentialNumber("laundryProcessingCenter", "centerCode", prefix)
  return `${prefix}-${padNumber(next, 3)}`
}

// ─── Order Number: ORD-BUSINESSCODE-202606-0001 ─────────────────────────────
export async function generateOrderNumber(businessCode: string): Promise<string> {
  const prefix = `${CODES.ORDER_PREFIX}-${businessCode}`
  const next = await getNextSequentialNumber("laundryOrder", "orderNumber", prefix)
  return `${prefix}-${getMonthPrefix()}-${padNumber(next)}`
}

// ─── Garment Tag Number: GT-BUSINESSCODE-202606-0001 ────────────────────────
export async function generateGarmentTagNumber(businessCode: string): Promise<string> {
  const prefix = `${CODES.GARMENT_TAG_PREFIX}-${businessCode}`
  const next = await getNextSequentialNumber("laundryGarmentTag", "tagNumber", prefix)
  return `${prefix}-${getMonthPrefix()}-${padNumber(next)}`
}

// ─── Transport Batch Number: TB-BUSINESSCODE-202606-0001 ────────────────────
export async function generateTransportBatchNumber(businessCode: string): Promise<string> {
  const prefix = `${CODES.TRANSPORT_BATCH_PREFIX}-${businessCode}`
  const next = await getNextSequentialNumber("laundryTransportBatch", "batchNumber", prefix)
  return `${prefix}-${getMonthPrefix()}-${padNumber(next)}`
}

// ─── Examples ───────────────────────────────────────────────────────────────
// Business Code:        LND-202606-0001
// Store Code:           STR-LND-202606-0001-001
// Processing Center:    PC-LND-202606-0001-001
// Order Number:         ORD-LND-202606-0001-202606-0001
// Garment Tag Number:   GT-LND-202606-0001-202606-0001
// Transport Batch:      TB-LND-202606-0001-202606-0001
