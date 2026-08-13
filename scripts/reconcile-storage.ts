// ============================================================================
// One-time storage reconciliation.
//
// Files uploaded through /api/core/upload were written to disk and recorded
// nowhere, so the storage ledger under-reports history. This walks the upload
// directory ONCE and backfills the missing FileUpload rows.
//
//   npx tsx scripts/reconcile-storage.ts            # report only, writes nothing
//   npx tsx scripts/reconcile-storage.ts --apply    # insert the missing rows
//
// GUARANTEES
//   • Never deletes or modifies a file. It only reads sizes.
//   • Never updates an existing ledger row — inserts only what is missing,
//     deduped on uploadPath, so it is safe to run more than once.
//   • Only counts files it can tie to a real Business id. Anything else is
//     reported as unclassifiable and left alone.
//   • Skips `temp` and any path outside a business scope (platform assets).
//
// It is deliberately a script, not an endpoint: this must never run on a page
// load. Normal usage reads the ledger only.
// ============================================================================
import { readdir, stat } from "fs/promises"
import { join, extname } from "path"
import { PrismaClient } from "@prisma/client"
import { UPLOAD_ROOT } from "../src/lib/upload-root"
import { categoryFromFolder } from "../src/lib/laundry-storage"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf",
}
const mimeOf = (f: string) => MIME[extname(f).toLowerCase()] || "application/octet-stream"

interface Found {
  businessId: string
  folder: string | null
  uploadPath: string
  filename: string
  size: number
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

async function main() {
  console.log(`\nUPLOAD_ROOT = ${UPLOAD_ROOT}`)
  console.log(APPLY ? "MODE: APPLY (inserting missing rows)\n" : "MODE: REPORT ONLY (no writes)\n")

  const businesses = await prisma.business.findMany({ select: { id: true, name: true } })
  const businessIds = new Set(businesses.map((b) => b.id))
  const nameById = new Map(businesses.map((b) => [b.id, b.name]))

  const files = await walk(UPLOAD_ROOT)
  const found: Found[] = []
  const unclassifiable: { path: string; reason: string; size: number }[] = []

  for (const f of files) {
    // Two shapes, businessId in either position:
    //   {businessId}/{folder}/file   — /api/uploads
    //   {folder}/{businessId}/file   — /api/core/upload
    const [a, b] = f.rel
    let businessId: string | null = null
    let folder: string | null = null
    if (a && businessIds.has(a)) { businessId = a; folder = b ?? null }
    else if (b && businessIds.has(b)) { businessId = b; folder = a ?? null }

    let size = 0
    try { size = (await stat(f.abs)).size } catch { continue }

    if (!businessId) {
      // Platform assets and anything not tied to a business are NOT charged to
      // any tenant. Reported, never counted, never touched.
      unclassifiable.push({ path: f.rel.join("/"), reason: "no Business id in path", size })
      continue
    }
    if (categoryFromFolder(folder) === "temp" || folder === "temp") {
      unclassifiable.push({ path: f.rel.join("/"), reason: "temp (excluded from quota)", size })
      continue
    }
    found.push({ businessId, folder, uploadPath: `/uploads/${f.rel.join("/")}`, filename: f.rel[f.rel.length - 1], size })
  }

  // Dedupe against what the ledger already knows.
  const existing = new Set(
    (await prisma.fileUpload.findMany({ select: { uploadPath: true } })).map((r) => r.uploadPath),
  )
  const missing = found.filter((f) => !existing.has(f.uploadPath))

  const byBusiness = new Map<string, { files: number; bytes: number }>()
  for (const m of missing) {
    const agg = byBusiness.get(m.businessId) || { files: 0, bytes: 0 }
    agg.files++; agg.bytes += m.size
    byBusiness.set(m.businessId, agg)
  }

  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(2)} MB`
  console.log(`Files on disk:            ${files.length}`)
  console.log(`Tied to a Business:       ${found.length}`)
  console.log(`Already in the ledger:    ${found.length - missing.length}`)
  console.log(`Missing (to reconcile):   ${missing.length}`)
  console.log(`Unclassifiable / temp:    ${unclassifiable.length} (${mb(unclassifiable.reduce((s, u) => s + u.size, 0))}) — left alone\n`)

  for (const [bid, agg] of byBusiness) {
    console.log(`  ${nameById.get(bid) ?? bid}: +${agg.files} files, +${mb(agg.bytes)}`)
  }
  if (unclassifiable.length) {
    console.log("\nUnclassifiable sample:")
    for (const u of unclassifiable.slice(0, 10)) console.log(`  ${u.path} — ${u.reason}`)
  }

  if (!APPLY) {
    console.log("\nReport only. Re-run with --apply to insert the missing rows.\n")
    return
  }

  let inserted = 0
  for (const m of missing) {
    try {
      await prisma.fileUpload.create({
        data: {
          businessId: m.businessId,
          originalName: m.filename,
          filename: m.filename,
          size: m.size,
          mimeType: mimeOf(m.filename),
          uploadPath: m.uploadPath,
          category: categoryFromFolder(m.folder) ?? "documents",
          status: "COMPLETED",
        },
      })
      inserted++
    } catch (e) {
      console.error(`  failed: ${m.uploadPath}`, e instanceof Error ? e.message : e)
    }
  }
  console.log(`\nInserted ${inserted} ledger rows. No file was modified or deleted.\n`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
