// Tenant storage management — plan limits, category resolution and usage
// computation from the FileUpload ledger (size + businessId are already tracked
// per tenant, so usage never walks the filesystem). Isolation is by businessId:
// uploads live under /uploads/{businessId}/... — one tenant never sees another.

import { prisma } from "@/lib/prisma"

export const STORAGE_CATEGORIES = [
  "customers", "orders", "garments", "audit", "processing", "delivery", "invoice", "documents", "branding", "temp",
] as const
export type StorageCategory = (typeof STORAGE_CATEGORIES)[number]

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

// `temp` is scratch space, not business data — it never counts toward the quota.
export const NON_QUOTA_CATEGORIES = new Set<string>(["temp"])

/**
 * The business's assigned storage limit, in bytes.
 *
 * PRIMARY: LaundryScalingLimit.storageLimitMB — the limit assigned at Business
 * Creation and editable by Super Admin. FALLBACK: the product plan's quota,
 * only when no scaling limit exists. There is no hardcoded table: the previous
 * PLAN_LIMITS_GB map is what put a fictional "10 GB" on every screen regardless
 * of what the business was actually sold.
 *
 * NOTE on ProductPlan.storageQuotaMB: despite the name its values are KB — the
 * existing UI divides by 1024*1024 to render GB (52428800 → "50 GB"). That
 * reading is preserved exactly; renaming or rescaling the column would change
 * businesses' assigned limits, which this work must not do.
 */
export async function resolveStorageLimitBytes(laundryBusinessId: string, platformBusinessId: string | null): Promise<number | null> {
  const scaling = await prisma.laundryScalingLimit.findUnique({
    where: { businessId: laundryBusinessId },
    select: { storageLimitMB: true },
  })
  if (scaling && scaling.storageLimitMB > 0) return scaling.storageLimitMB * MB

  if (platformBusinessId) {
    const business = await prisma.business.findUnique({
      where: { id: platformBusinessId },
      select: { productCode: true, subscriptionPlanCode: true },
    })
    if (business?.productCode && business.subscriptionPlanCode) {
      const plan = await prisma.productPlan.findUnique({
        where: { productCode_code: { productCode: business.productCode, code: business.subscriptionPlanCode } },
        select: { storageQuotaMB: true },
      })
      // Same unit reading as the plan-selection UI (value is KB).
      if (plan && plan.storageQuotaMB > 0) return plan.storageQuotaMB * 1024
    }
  }
  // No limit assigned anywhere — report unlimited rather than inventing one.
  return null
}

// Human-friendly label per category.
export const CATEGORY_LABELS: Record<string, string> = {
  customers: "Customer Photos",
  orders: "Order Files",
  garments: "Garment Images",
  audit: "Audit Images",
  processing: "Processing Images",
  delivery: "Delivery Proofs",
  invoice: "Invoices",
  documents: "Documents",
  branding: "Brand Assets",
  temp: "Temp",
  other: "Other",
}

/** Map any folder name to one of the real categories. */
export function categoryFromFolder(folder: string | null | undefined): string | null {
  if (!folder) return null
  const s = folder.toLowerCase()
  if (STORAGE_CATEGORIES.includes(s as StorageCategory)) return s
  if (s.includes("brand") || s === "logo" || s === "logos" || s === "favicons") return "branding"
  if (s.includes("invoice")) return "invoice"
  if (s.includes("garment") || s === "product" || s === "products") return "garments"
  if (s.includes("audit")) return "audit"
  if (s.includes("customer")) return "customers"
  if (s.includes("deliver")) return "delivery"
  if (s.includes("process")) return "processing"
  if (s === "document" || s === "documents") return "documents"
  return null
}

/**
 * Derive a category from a FileUpload row.
 *
 * TWO path shapes exist and both must resolve. /api/uploads writes
 * /uploads/{businessId}/{type}/{file} while /api/core/upload writes
 * /uploads/{folder}/{businessId}/{file} — the businessId and the folder swap
 * places. The previous code read segment [2] unconditionally, so a core/upload
 * path had its BUSINESS ID read as the category. Both segments are now tried
 * and whichever names a real category wins.
 */
export function resolveCategory(row: { category?: string | null; uploadPath?: string | null; mimeType?: string | null }): string {
  if (row.category && STORAGE_CATEGORIES.includes(row.category as StorageCategory)) return row.category
  const parts = (row.uploadPath || "").split("/").filter(Boolean) // ["uploads", a, b, file]
  return categoryFromFolder(parts[1]) || categoryFromFolder(parts[2]) || "documents"
}

export interface StorageUsage {
  usedBytes: number
  usedMB: number
  usedGB: number
  limitBytes: number | null
  limitGB: number | null
  remainingBytes: number | null
  percentUsed: number
  nearingLimit: boolean
  exceeded: boolean
  fileCount: number
  uploadsToday: number
  uploadsThisMonth: number
  byCategory: { category: string; label: string; bytes: number; mb: number; count: number }[]
}

export async function computeStorageUsage(platformBusinessId: string, limitBytes: number | null): Promise<StorageUsage> {
  const rows = await prisma.fileUpload.findMany({
    where: { businessId: platformBusinessId, status: "COMPLETED" },
    select: { size: true, category: true, uploadPath: true, mimeType: true, createdAt: true },
  })

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let usedBytes = 0, uploadsToday = 0, uploadsThisMonth = 0
  const cat = new Map<string, { bytes: number; count: number }>()
  let fileCount = 0
  for (const r of rows) {
    const c = resolveCategory(r)
    const agg = cat.get(c) || { bytes: 0, count: 0 }
    agg.bytes += r.size; agg.count += 1
    cat.set(c, agg)
    // Scratch space is shown in the breakdown but never charged to the quota.
    if (NON_QUOTA_CATEGORIES.has(c)) continue
    usedBytes += r.size
    fileCount++
    if (r.createdAt >= startOfDay) uploadsToday++
    if (r.createdAt >= startOfMonth) uploadsThisMonth++
  }

  const percentUsed = limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0
  const r2 = (n: number) => Math.round(n * 100) / 100

  return {
    usedBytes,
    usedMB: r2(usedBytes / MB),
    usedGB: r2(usedBytes / GB),
    limitBytes,
    limitGB: limitBytes ? r2(limitBytes / GB) : null,
    remainingBytes: limitBytes ? Math.max(0, limitBytes - usedBytes) : null,
    percentUsed,
    nearingLimit: !!limitBytes && percentUsed >= 90,
    exceeded: !!limitBytes && usedBytes >= limitBytes,
    fileCount,
    uploadsToday,
    uploadsThisMonth,
    byCategory: [...cat.entries()]
      .map(([category, v]) => ({ category, label: CATEGORY_LABELS[category] || category, bytes: v.bytes, mb: r2(v.bytes / MB), count: v.count }))
      .sort((a, b) => b.bytes - a.bytes),
  }
}

// ============================================================================
// Store usage — counted from the actual LaundryStore rows.
//
// LaundryScalingLimit.storesUsed is an incrementing counter: it is +1 on create
// and never decremented on delete, so it drifts permanently above reality.
// Counting rows cannot drift, and gives the per-type breakdown for free.
//
// EVERY location counts toward the ONE store limit — Retail, Processing Center
// and Both alike. There is no separate Processing Center quota.
// ============================================================================

export interface StoreUsage {
  used: number
  allowed: number | null
  remaining: number | null
  exceeded: boolean
  retail: number
  processingCenters: number
  both: number
}

export async function computeStoreUsage(laundryBusinessId: string): Promise<StoreUsage> {
  const [stores, scaling] = await Promise.all([
    prisma.laundryStore.findMany({ where: { laundryBusinessId }, select: { storeType: true } }),
    prisma.laundryScalingLimit.findUnique({ where: { businessId: laundryBusinessId }, select: { storesAllowed: true } }),
  ])
  // Active and inactive both occupy a slot: the existing create-time check
  // counts every row, and this must not change what a plan slot means.
  const retail = stores.filter((s) => s.storeType === "RETAIL_STORE").length
  const processingCenters = stores.filter((s) => s.storeType === "PROCESSING_CENTER").length
  const both = stores.filter((s) => s.storeType === "BOTH").length
  const used = stores.length
  const allowed = scaling?.storesAllowed ?? null
  return {
    used,
    allowed,
    remaining: allowed == null ? null : Math.max(0, allowed - used),
    exceeded: allowed != null && used >= allowed,
    retail,
    processingCenters,
    both,
  }
}

/**
 * THE shared usage snapshot. Workspace Settings and Super Admin both call this,
 * so the two can never disagree about what a business has consumed.
 */
export async function computeBusinessUsage(laundryBusinessId: string, platformBusinessId: string | null) {
  const limitBytes = await resolveStorageLimitBytes(laundryBusinessId, platformBusinessId)
  const [storage, stores] = await Promise.all([
    platformBusinessId
      ? computeStorageUsage(platformBusinessId, limitBytes)
      : Promise.resolve(null),
    computeStoreUsage(laundryBusinessId),
  ])
  return { storage, stores, calculatedAt: new Date().toISOString() }
}
