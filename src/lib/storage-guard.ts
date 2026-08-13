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
import { resolveStorageLimitBytes, categoryFromFolder, NON_QUOTA_CATEGORIES } from "@/lib/laundry-storage"

export const STORAGE_LIMIT_CODE = "STORAGE_LIMIT"

export function storageLimitMessage(usedBytes: number, limitBytes: number): string {
  const gb = (n: number) => `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
  return `Storage limit reached. This business has used ${gb(usedBytes)} of its ${gb(limitBytes)} storage allocation. Delete unused files or contact Quantix to increase the storage limit.`
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
  const limitBytes = input.laundryBusinessId
    ? await resolveStorageLimitBytes(input.laundryBusinessId, input.platformBusinessId)
    : null
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
        category: categoryFromFolder(input.folder) ?? "documents",
        status: "COMPLETED",
      },
    })
    .catch((e) => console.error("[storage] ledger write failed (file was saved):", e))
}

/** Scratch space is not business data. */
export const isQuotaCategory = (category: string | null | undefined) =>
  !!category && !NON_QUOTA_CATEGORIES.has(category)
