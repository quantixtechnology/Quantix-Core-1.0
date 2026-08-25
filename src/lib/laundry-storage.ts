// Tenant storage management — plan limits, category resolution and usage
// computation from the FileUpload ledger (size + businessId are already tracked
// per tenant, so usage never walks the filesystem). Isolation is by businessId:
// uploads live under /uploads/{businessId}/... — one tenant never sees another.

import { prisma } from "@/lib/prisma"
// One reader for the per-business overrides Resource Allocation writes — the
// same helper the store-limit resolver uses. No second parsing of that field.
import { parseResourceOverrides, resolveEffectiveStoreLimit } from "@/lib/laundry-scaling-limits"

export const STORAGE_CATEGORIES = [
  "customers", "orders", "garments", "audit", "processing", "delivery", "invoice", "documents", "branding", "temp",
] as const
export type StorageCategory = (typeof STORAGE_CATEGORIES)[number]

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

// `temp` is scratch space, not business data — it never counts toward the quota.
export const NON_QUOTA_CATEGORIES = new Set<string>(["temp"])

/** Where an effective storage limit came from. */
export type StorageLimitSource = "override" | "plan" | "workspace" | "none"

export interface StorageLimitResolution {
  /** ProductPlan.storageQuotaMB for the business's plan, in bytes. */
  planDefaultBytes: number | null
  /** settings.resourceOverrides.storageGB for THIS business, in bytes. */
  overrideBytes: number | null
  /** override ?? plan default — what the business is actually entitled to. */
  effectiveBytes: number | null
  source: StorageLimitSource
  planCode: string | null
}

/**
 * THE effective storage limit for one business: Super Admin override first,
 * plan default second. Resolved from the businessId and nothing else.
 *
 * THE BUG THIS FIXES: LaundryScalingLimit.storageLimitMB used to be read FIRST.
 * That column has a schema default of 500 and is never seeded from the plan
 * (ensureScalingLimitForNewBusiness writes only storesAllowed), so every laundry
 * workspace carried a defaulted 500 that shadowed BOTH the plan default and the
 * per-business allocation. A business whose plan gives 10 GB and whose Resource
 * Allocation override grants 15 GB still read "500 MB" on Storage Usage.
 *
 * Resolution order — identical in shape to resolveEffectiveStoreLimit():
 *   1. Business.settings.resourceOverrides.storageGB — what Business Management
 *      → Resource Allocation persists. An explicit allocation is the customer's
 *      real entitlement and always wins.
 *   2. ProductPlan.storageQuotaMB — the plan DEFAULT, used when no override.
 *   3. LaundryScalingLimit.storageLimitMB — last resort, and ONLY for a legacy
 *      workspace with no platform allocation at all (no business row, or no
 *      product/plan and no override). It can no longer shadow a real one.
 *
 * 500 MB can therefore only appear if 500 MB is genuinely what the business was
 * allocated — never as an unrelated hardcoded fallback.
 *
 * NOTE on ProductPlan.storageQuotaMB: despite the name its values are KB — the
 * existing UI divides by 1024*1024 to render GB (52428800 → "50 GB"). That
 * reading is preserved exactly; renaming or rescaling the column would change
 * businesses' assigned limits, which this work must not do. The override is
 * stored in the same GB convention the Resource Allocation UI writes.
 */
export async function resolveStorageLimit(
  laundryBusinessId: string | null,
  platformBusinessId: string | null,
): Promise<StorageLimitResolution> {
  let planDefaultBytes: number | null = null
  let overrideBytes: number | null = null
  let planCode: string | null = null

  if (platformBusinessId) {
    const business = await prisma.business.findUnique({
      where: { id: platformBusinessId },
      select: { productCode: true, subscriptionPlanCode: true, settings: true },
    })
    if (business) {
      planCode = business.subscriptionPlanCode ?? null

      // Same guard the Resource Allocation screen applies: blank/invalid/<1 is
      // not an override, it means "use the plan default".
      const ov = parseResourceOverrides(business.settings).storageGB
      if (typeof ov === "number" && Number.isFinite(ov) && ov >= 1) overrideBytes = Math.floor(ov) * GB

      if (business.productCode && business.subscriptionPlanCode) {
        const plan = await prisma.productPlan.findUnique({
          where: { productCode_code: { productCode: business.productCode, code: business.subscriptionPlanCode } },
          select: { storageQuotaMB: true },
        })
        // Same unit reading as the plan-selection UI (value is KB).
        if (plan && plan.storageQuotaMB > 0) planDefaultBytes = plan.storageQuotaMB * 1024
      }
    }
  }

  const effectiveBytes = overrideBytes ?? planDefaultBytes
  if (effectiveBytes != null) {
    return { planDefaultBytes, overrideBytes, effectiveBytes, source: overrideBytes != null ? "override" : "plan", planCode }
  }

  // Nothing allocated at platform level — a laundry-only workspace. Its own
  // scaling row is the only business-specific number that exists. A business
  // with no laundry workspace at all (Commerce) has no such row to fall to.
  if (laundryBusinessId) {
    const scaling = await prisma.laundryScalingLimit.findUnique({
      where: { businessId: laundryBusinessId },
      select: { storageLimitMB: true },
    })
    if (scaling && scaling.storageLimitMB > 0) {
      return { planDefaultBytes, overrideBytes, effectiveBytes: scaling.storageLimitMB * MB, source: "workspace", planCode }
    }
  }

  // No limit assigned anywhere — report unlimited rather than inventing one.
  return { planDefaultBytes, overrideBytes, effectiveBytes: null, source: "none", planCode }
}

/** The effective limit in bytes, or null for unlimited. */
export async function resolveStorageLimitBytes(laundryBusinessId: string | null, platformBusinessId: string | null): Promise<number | null> {
  return (await resolveStorageLimit(laundryBusinessId, platformBusinessId)).effectiveBytes
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
  // Catalog category artwork is catalogue imagery, not a document.
  if (s.startsWith("categor")) return "garments"
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
  /** Where `allowed` came from, so a surface can explain the number it shows. */
  source: "override" | "plan" | "workspace" | null
}

/**
 * Usage and entitlement for one workspace's store locations.
 *
 * THE BUG THIS FIXES: `allowed` was read straight from
 * LaundryScalingLimit.storesAllowed — a SNAPSHOT written once, when the
 * workspace was first materialised, and deliberately never updated afterwards
 * (ensureScalingLimitForNewBusiness returns early if a row exists). So a
 * business granted a Stores override in Business Management → Resource
 * Allocation kept enforcing the plan default it was seeded with: VASTRASUDHA
 * showed "Effective: 5" on the platform screen and "1 / 1 used · limit reached"
 * inside Laundry OS.
 *
 * The limit is now RESOLVED at read time, in the same order and by the same
 * resolver every other surface uses:
 *   1. Business.settings.resourceOverrides.stores — the per-business allocation
 *   2. ProductPlan.branchLimit — the plan DEFAULT, when no override exists
 *   3. LaundryScalingLimit.storesAllowed — last resort, and ONLY for a legacy
 *      workspace with no platform allocation at all. It can no longer shadow a
 *      real one, exactly as resolveStorageLimit() already guarantees for storage.
 *
 * Removing an override therefore falls straight back to the plan default, with
 * nothing to re-seed and no stale copy to correct.
 *
 * The platform business id is looked up when not supplied, so a caller cannot
 * accidentally get the stale number by forgetting to pass it — every one of the
 * four enforcement points (list, limit message, Add Store, create API) resolves
 * through here and therefore cannot disagree.
 */
export async function computeStoreUsage(
  laundryBusinessId: string,
  platformBusinessId?: string | null,
): Promise<StoreUsage> {
  const [stores, workspace] = await Promise.all([
    prisma.laundryStore.findMany({ where: { laundryBusinessId }, select: { storeType: true } }),
    platformBusinessId === undefined
      ? prisma.laundryBusiness.findUnique({ where: { id: laundryBusinessId }, select: { platformBusinessId: true } }).catch(() => null)
      : Promise.resolve(null),
  ])
  const platformId = platformBusinessId === undefined ? workspace?.platformBusinessId ?? null : platformBusinessId

  const resolution = await resolveEffectiveStoreLimit(platformId).catch(() => null)
  let allowed = resolution?.effective ?? null
  let source: StoreUsage["source"] = allowed == null ? null : resolution?.override != null ? "override" : "plan"

  // Nothing allocated at platform level — a laundry-only workspace. Its own
  // scaling row is then the only business-specific number that exists.
  if (allowed == null) {
    const scaling = await prisma.laundryScalingLimit
      .findUnique({ where: { businessId: laundryBusinessId }, select: { storesAllowed: true } })
      .catch(() => null)
    if (scaling?.storesAllowed != null) { allowed = scaling.storesAllowed; source = "workspace" }
  }

  // Active and inactive both occupy a slot: the existing create-time check
  // counts every row, and this must not change what a plan slot means.
  const retail = stores.filter((s) => s.storeType === "RETAIL_STORE").length
  const processingCenters = stores.filter((s) => s.storeType === "PROCESSING_CENTER").length
  const both = stores.filter((s) => s.storeType === "BOTH").length
  const used = stores.length
  return {
    used,
    allowed,
    remaining: allowed == null ? null : Math.max(0, allowed - used),
    exceeded: allowed != null && used >= allowed,
    retail,
    processingCenters,
    both,
    source,
  }
}

/**
 * THE shared usage snapshot. Workspace Settings and Super Admin both call this,
 * so the two can never disagree about what a business has consumed.
 */
export async function computeBusinessUsage(laundryBusinessId: string, platformBusinessId: string | null) {
  // Quota and usage are resolved from the SAME businessId pair, so the limit
  // shown can only ever be this tenant's own allocation.
  const limit = await resolveStorageLimit(laundryBusinessId, platformBusinessId)
  const [storage, stores] = await Promise.all([
    platformBusinessId
      ? computeStorageUsage(platformBusinessId, limit.effectiveBytes)
      : Promise.resolve(null),
    computeStoreUsage(laundryBusinessId, platformBusinessId),
  ])
  // `limit` is carried so both surfaces can say WHERE the number came from —
  // a custom allocation or the plan default.
  return { storage, stores, limit, calculatedAt: new Date().toISOString() }
}
