// The ONE storage-quota check, and the ONE ledger write.
//
// Enforcement lives at the upload endpoints and nowhere else: a business at its
// limit must still be able to log in, take orders, run Store Audit, process
// garments and collect payment. Only operations that would create MORE
// business-owned storage are refused.
//
// Both upload endpoints call these two helpers, so a file can never be written
// to disk without the ledger learning about it — which is exactly how the
// storage screen came to report 0 B while the business had files.

import { prisma } from "@/lib/prisma"
import { resolveStorageLimitBytes, categoryFromFolder, NON_QUOTA_CATEGORIES, STORAGE_CATEGORIES } from "@/lib/laundry-storage"

export const STORAGE_LIMIT_CODE = "STORAGE_LIMIT"

export function storageLimitMessage(usedBytes: number, limitBytes: number): string {
  const gb = (n: number) => `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
  return `Storage limit reached. This business has used ${gb(usedBytes)} of its ${gb(limitBytes)} storage allocation. Delete unused files or contact Quantix to increase the storage limit.`
}

/**
 * The tenant a file belongs to, from whatever id the caller happens to hold.
 *
 * FileUpload.businessId is ALWAYS the platform Business id — that is what the
 * usage query and the quota both key on. Call sites hold different ids: the
 * upload endpoints hold a platform id, CRM recordings hold a LaundryBusiness
 * id. Resolving in one place stops a LaundryBusiness id being written into the
 * ledger, where it would belong to no tenant and be counted for nobody.
 */
export async function resolveMeteringTarget(
  anyBusinessId: string | null | undefined,
): Promise<{ platformBusinessId: string; laundryBusinessId: string | null } | null> {
  if (!anyBusinessId) return null
  const laundry = await prisma.laundryBusiness.findFirst({
    where: { OR: [{ id: anyBusinessId }, { platformBusinessId: anyBusinessId }] },
    select: { id: true, platformBusinessId: true },
  })
  if (laundry?.platformBusinessId) {
    return { platformBusinessId: laundry.platformBusinessId, laundryBusinessId: laundry.id }
  }
  // Not a laundry workspace (or an unlinked one) — it must still be a real
  // platform business, or there is no tenant to charge.
  const business = await prisma.business.findUnique({ where: { id: anyBusinessId }, select: { id: true } })
  if (!business) return null
  return { platformBusinessId: business.id, laundryBusinessId: laundry?.id ?? null }
}

/**
 * May this business store `incomingBytes` more?
 *
 * `platformBusinessId` is the id the ledger is keyed on. A business with no
 * assigned limit is unlimited — it is not silently given a default.
 */
export async function checkStorageAllowance(input: {
  laundryBusinessId?: string | null
  platformBusinessId: string
  incomingBytes: number
}): Promise<{ ok: true } | { ok: false; error: string; code: string; usedBytes: number; limitBytes: number }> {
  // Resolved for EVERY tenant, not only laundry ones. The quota comes from the
  // platform business (override ?? plan default); the laundry id only selects
  // the legacy workspace fallback, so a Commerce business is quota'd too — it
  // used to upload without any limit at all because this skipped the lookup.
  const limitBytes = await resolveStorageLimitBytes(input.laundryBusinessId ?? null, input.platformBusinessId)
  if (limitBytes == null) return { ok: true }

  const agg = await prisma.fileUpload.aggregate({
    where: { businessId: input.platformBusinessId, status: "COMPLETED" },
    _sum: { size: true },
  })
  const usedBytes = agg._sum.size || 0
  if (usedBytes + input.incomingBytes > limitBytes) {
    return { ok: false, error: storageLimitMessage(usedBytes, limitBytes), code: STORAGE_LIMIT_CODE, usedBytes, limitBytes }
  }
  return { ok: true }
}

/**
 * Record a stored file in the ledger.
 *
 * Never throws: a bookkeeping failure must not lose a file the user has already
 * uploaded successfully. `uploadPath` is unique in practice (timestamp + random
 * suffix), and reconciliation dedupes on it.
 */
export async function recordUpload(input: {
  platformBusinessId: string
  originalName: string
  filename: string
  size: number
  mimeType: string
  uploadPath: string
  folder?: string | null
  /** Explicit category — wins over the folder, for callers that know better
   *  than their own directory name (a logo written to /uploads/products). */
  category?: string | null
}): Promise<void> {
  await prisma.fileUpload
    .create({
      data: {
        businessId: input.platformBusinessId,
        originalName: input.originalName,
        filename: input.filename,
        size: input.size,
        mimeType: input.mimeType,
        uploadPath: input.uploadPath,
        // Resolved from the folder so the breakdown is real, not guessed later.
        category: normalizeCategory(input.category) ?? categoryFromFolder(input.folder) ?? "documents",
        status: "COMPLETED",
      },
    })
    .catch((e) => console.error("[storage] ledger write failed (file was saved):", e))
}

/** Only a real category counts; anything else falls through to the folder. */
function normalizeCategory(c: string | null | undefined): string | null {
  return c && STORAGE_CATEGORIES.includes(c as (typeof STORAGE_CATEGORIES)[number]) ? c : null
}

/**
 * Forget a file that has been removed from disk.
 *
 * Deleting the bytes without deleting the row would charge a business forever
 * for storage it no longer uses. Never throws — a missing row is success, and a
 * bookkeeping failure must not fail the deletion the user asked for.
 */
export async function forgetUpload(uploadPath: string): Promise<void> {
  await prisma.fileUpload
    .deleteMany({ where: { uploadPath } })
    .catch((e) => console.error("[storage] ledger delete failed (file was removed):", e))
}

/** Scratch space is not business data. */
export const isQuotaCategory = (category: string | null | undefined) =>
  !!category && !NON_QUOTA_CATEGORIES.has(category)
