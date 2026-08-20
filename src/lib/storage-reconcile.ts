// ============================================================================
// Storage reconciliation — the ONE scan of the upload directory.
//
// The FileUpload ledger only started being written on 2026-08-13. Every file
// uploaded before that — logos, favicons, audit photos — exists on disk and is
// invisible to Storage Usage. This walks UPLOAD_ROOT and backfills the missing
// rows.
//
// GUARANTEES
//   • Never deletes or modifies a file. It only reads sizes.
//   • Never updates an existing ledger row. Inserts only what is missing,
//     deduped on uploadPath, so running it twice cannot double-count.
//   • Only counts files it can tie to a real tenant. Anything else is reported
//     for manual review and left alone.
//   • Skips `temp` and platform-owned assets — neither is tenant storage.
//
// The logic lives here rather than in the script so the CLI and the Super Admin
// endpoint can never drift into two different definitions of "what is on disk".
// ============================================================================
import { readdir, stat } from "fs/promises"
import { join, extname } from "path"
import { prisma } from "@/lib/prisma"
import { UPLOAD_ROOT } from "@/lib/upload-root"
import { categoryFromFolder } from "@/lib/laundry-storage"

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".aac": "audio/aac",
}
const mimeOf = (f: string) => MIME[extname(f).toLowerCase()] || "application/octet-stream"

export interface ReconcileFile {
  platformBusinessId: string
  businessName: string
  uploadPath: string
  filename: string
  size: number
  category: string
  /** True when the path was keyed on a LaundryBusiness id, not a platform one. */
  viaLaundryId: boolean
}

export interface ReconcileReport {
  uploadRoot: string
  applied: boolean
  filesDiscovered: number
  filesClassifiable: number
  filesUnclassifiable: number
  totalBytes: number
  classifiableBytes: number
  alreadyInLedger: number
  wouldInsert: number
  inserted: number
  bytesToInsert: number
  byBusiness: { businessId: string; name: string; files: number; bytes: number }[]
  byCategory: { category: string; files: number; bytes: number }[]
  manualReview: { path: string; reason: string; size: number }[]
  /**
   * Every classifiable file with the tenant and category it resolved to.
   *
   * A dry run that only reports totals cannot be reviewed: "Brand Assets: 5
   * files" does not tell you whether THIS business's logo is one of them. The
   * per-file list is the thing an operator actually checks before applying.
   */
  files: {
    path: string
    businessId: string
    businessName: string
    size: number
    category: string
    viaLaundryId: boolean
    inLedger: boolean
  }[]
}

async function walk(dir: string, rel: string[] = []): Promise<{ abs: string; rel: string[] }[]> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const out: { abs: string; rel: string[] }[] = []
  for (const e of entries) {
    if (e.name.startsWith(".")) continue
    const abs = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(abs, [...rel, e.name])))
    else if (e.isFile()) out.push({ abs, rel: [...rel, e.name] })
  }
  return out
}

/**
 * Scan the upload directory and, when `apply` is set, insert the missing rows.
 *
 * Read-only by default: nothing is written unless `apply` is explicitly true.
 */
export async function reconcileStorage(opts: { apply?: boolean } = {}): Promise<ReconcileReport> {
  const apply = opts.apply === true

  const businesses = await prisma.business.findMany({
    select: { id: true, name: true, logo: true, favicon: true },
  })
  const byId = new Map(businesses.map((b) => [b.id, b]))

  // A CRM recording's directory is named with the LaundryBusiness id, not the
  // platform one. Without this map every recording would be reported as
  // "no tenant in path" and stay uncounted forever.
  const laundries = await prisma.laundryBusiness.findMany({
    select: { id: true, platformBusinessId: true },
  })
  const platformIdByLaundryId = new Map(
    laundries.filter((l) => l.platformBusinessId).map((l) => [l.id, l.platformBusinessId as string]),
  )

  // Brand assets are identified by the Business row that points at them, not by
  // their directory — a logo written to /uploads/products/ is still a logo.
  const brandAssetPaths = new Set<string>()
  for (const b of businesses) {
    if (b.logo) brandAssetPaths.add(b.logo)
    if (b.favicon) brandAssetPaths.add(b.favicon)
  }

  const files = await walk(UPLOAD_ROOT)
  const found: ReconcileFile[] = []
  const manualReview: { path: string; reason: string; size: number }[] = []
  let totalBytes = 0

  for (const f of files) {
    let size = 0
    try { size = (await stat(f.abs)).size } catch { continue }
    totalBytes += size

    // Three path shapes, tenant id in either of the first two segments:
    //   {businessId}/{folder}/file        — /api/uploads
    //   {folder}/{businessId}/file        — /api/core/upload and friends
    //   crm-recordings/{laundryId}/file   — CRM, keyed on the laundry id
    const [a, b] = f.rel
    let platformBusinessId: string | null = null
    let folder: string | null = null
    let viaLaundryId = false

    if (a && byId.has(a)) { platformBusinessId = a; folder = b ?? null }
    else if (b && byId.has(b)) { platformBusinessId = b; folder = a ?? null }
    else if (a && platformIdByLaundryId.has(a)) { platformBusinessId = platformIdByLaundryId.get(a)!; folder = b ?? null; viaLaundryId = true }
    else if (b && platformIdByLaundryId.has(b)) { platformBusinessId = platformIdByLaundryId.get(b)!; folder = a ?? null; viaLaundryId = true }

    const uploadPath = `/uploads/${f.rel.join("/")}`

    if (!platformBusinessId) {
      // Platform assets and anything not tied to a tenant are charged to
      // nobody. Reported for review, never counted, never touched.
      manualReview.push({ path: uploadPath, reason: "no tenant id in path", size })
      continue
    }
    if (folder === "temp" || categoryFromFolder(folder) === "temp") {
      manualReview.push({ path: uploadPath, reason: "temp (excluded from quota)", size })
      continue
    }

    found.push({
      platformBusinessId,
      businessName: byId.get(platformBusinessId)?.name ?? platformBusinessId,
      uploadPath,
      filename: f.rel[f.rel.length - 1],
      size,
      category: brandAssetPaths.has(uploadPath) ? "branding" : (categoryFromFolder(folder) ?? "documents"),
      viaLaundryId,
    })
  }

  // Idempotency: dedupe against what the ledger already holds. uploadPath is
  // unique in practice (timestamp + random suffix), so a second run inserts
  // nothing and the totals do not move.
  const existing = new Set(
    (await prisma.fileUpload.findMany({ select: { uploadPath: true } })).map((r) => r.uploadPath),
  )
  const missing = found.filter((f) => !existing.has(f.uploadPath))

  const bizAgg = new Map<string, { name: string; files: number; bytes: number }>()
  const catAgg = new Map<string, { files: number; bytes: number }>()
  for (const m of missing) {
    const b = bizAgg.get(m.platformBusinessId) || { name: m.businessName, files: 0, bytes: 0 }
    b.files++; b.bytes += m.size
    bizAgg.set(m.platformBusinessId, b)
    const c = catAgg.get(m.category) || { files: 0, bytes: 0 }
    c.files++; c.bytes += m.size
    catAgg.set(m.category, c)
  }

  let inserted = 0
  if (apply) {
    for (const m of missing) {
      try {
        await prisma.fileUpload.create({
          data: {
            businessId: m.platformBusinessId,
            originalName: m.filename,
            filename: m.filename,
            size: m.size,
            mimeType: mimeOf(m.filename),
            uploadPath: m.uploadPath,
            category: m.category,
            status: "COMPLETED",
          },
        })
        inserted++
      } catch (e) {
        manualReview.push({
          path: m.uploadPath,
          reason: `insert failed: ${e instanceof Error ? e.message : String(e)}`,
          size: m.size,
        })
      }
    }
  }

  return {
    uploadRoot: UPLOAD_ROOT,
    applied: apply,
    filesDiscovered: files.length,
    filesClassifiable: found.length,
    filesUnclassifiable: manualReview.length,
    totalBytes,
    classifiableBytes: found.reduce((s, f) => s + f.size, 0),
    alreadyInLedger: found.length - missing.length,
    wouldInsert: missing.length,
    inserted,
    bytesToInsert: missing.reduce((s, f) => s + f.size, 0),
    byBusiness: [...bizAgg.entries()]
      .map(([businessId, v]) => ({ businessId, ...v }))
      .sort((x, y) => y.bytes - x.bytes),
    byCategory: [...catAgg.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((x, y) => y.bytes - x.bytes),
    manualReview,
    files: found
      .map((f) => ({
        path: f.uploadPath,
        businessId: f.platformBusinessId,
        businessName: f.businessName,
        size: f.size,
        category: f.category,
        viaLaundryId: f.viaLaundryId,
        inLedger: existing.has(f.uploadPath),
      }))
      .sort((x, y) => y.size - x.size),
  }
}
