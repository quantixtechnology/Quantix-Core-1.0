// ============================================================================
// Storage reconciliation — CLI.
//
//   npx tsx scripts/reconcile-storage.ts            # report only, writes nothing
//   npx tsx scripts/reconcile-storage.ts --apply    # insert the missing rows
//
// All logic lives in src/lib/storage-reconcile.ts, which the Super Admin
// endpoint calls too — so the CLI and the endpoint can never disagree about
// what is on disk. This file only prints.
//
// It is deliberately a script, not a page: reconciliation must never run on a
// page load. Normal usage reads the ledger only.
// ============================================================================
import { PrismaClient } from "@prisma/client"
import { reconcileStorage } from "../src/lib/storage-reconcile"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(2)} MB`

async function main() {
  const r = await reconcileStorage({ apply: APPLY })

  console.log(`\nUPLOAD_ROOT = ${r.uploadRoot}`)
  console.log(APPLY ? "MODE: APPLY (inserting missing rows)\n" : "MODE: REPORT ONLY (no writes)\n")

  console.log(`Files discovered:         ${r.filesDiscovered}`)
  console.log(`Files classifiable:       ${r.filesClassifiable}`)
  console.log(`Files unclassifiable:     ${r.filesUnclassifiable}`)
  console.log(`Total bytes on disk:      ${mb(r.totalBytes)}`)
  console.log(`Already in the ledger:    ${r.alreadyInLedger}`)
  console.log(`Files that would insert:  ${r.wouldInsert} (${mb(r.bytesToInsert)})`)
  if (APPLY) console.log(`Rows inserted:            ${r.inserted}`)

  console.log("\nBytes by business:")
  if (!r.byBusiness.length) console.log("  (nothing to insert)")
  for (const b of r.byBusiness) console.log(`  ${b.name}: +${b.files} files, +${mb(b.bytes)}`)

  console.log("\nBytes by category:")
  if (!r.byCategory.length) console.log("  (nothing to insert)")
  for (const c of r.byCategory) console.log(`  ${c.category}: ${c.files} files, ${mb(c.bytes)}`)

  if (r.manualReview.length) {
    console.log(`\nRequiring manual review (${r.manualReview.length}) — left alone:`)
    for (const u of r.manualReview.slice(0, 20)) console.log(`  ${u.path} — ${u.reason}`)
    if (r.manualReview.length > 20) console.log(`  … and ${r.manualReview.length - 20} more`)
  }

  if (!APPLY) {
    console.log("\nReport only. Re-run with --apply to insert the missing rows.\n")
  } else {
    console.log(`\nInserted ${r.inserted} ledger rows. No file was modified or deleted.\n`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
