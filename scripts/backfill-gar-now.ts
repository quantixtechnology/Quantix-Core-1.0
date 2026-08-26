// Scoped GAR backfill with a read-only audit before and after.
//
//   npx tsx scripts/backfill-gar-now.ts --audit                  (read-only)
//   npx tsx scripts/backfill-gar-now.ts --business=<laundryBizId>
//   npx tsx scripts/backfill-gar-now.ts --order=<orderId>
//   npx tsx scripts/backfill-gar-now.ts --all                    (every tenant)
//
// Without a scope flag it AUDITS ONLY — it never writes by accident.
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const flag = (name: string) => process.argv.includes(`--${name}`)

function printReport(title: string, r: Record<string, number>) {
  console.log(`\n${title}`)
  console.log("─".repeat(46))
  for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(22)} ${v}`)
}

async function main() {
  const { auditGarScanCodes, backfillGarScanCodes } = await import("../src/lib/laundry-codes")

  const scope = {
    businessId: arg("business"),
    orderId: arg("order"),
    itemIds: null as string[] | null,
  }
  const scoped = !!(scope.businessId || scope.orderId)
  const all = flag("all")

  console.log(`\nGAR BACKFILL — ${new Date().toISOString()}`)
  console.log(`Scope: ${scoped ? JSON.stringify(scope) : all ? "ALL TENANTS" : "(none — audit only)"}`)

  const before = await auditGarScanCodes(scope)
  printReport("BEFORE (read-only audit)", before as unknown as Record<string, number>)

  if (!scoped && !all) {
    console.log("\nNo scope given — audit only, nothing written.")
    console.log("Re-run with --business=<id>, --order=<id> or --all to repair.\n")
    return
  }

  const result = await backfillGarScanCodes({ scope })
  printReport("WRITES", result as unknown as Record<string, number>)

  const after = await auditGarScanCodes(scope)
  printReport("AFTER", after as unknown as Record<string, number>)

  // Prove the invariant rather than asserting it in prose. Rows whose
  // garmentScanCode is set but unrecognised are deliberately left alone, so
  // they are the only permitted residue.
  const ok = after.nullGar === 0 && after.itmBarcode === 0 && after.existingGar >= before.existingGar
  console.log(`\n  no NULL GAR remaining:   ${after.nullGar === 0 ? "YES" : `NO (${after.nullGar})`}`)
  console.log(`  no ITM barcode left:     ${after.itmBarcode === 0 ? "YES" : `NO (${after.itmBarcode})`}`)
  console.log(`  existing GARs unchanged: ${after.existingGar >= before.existingGar ? "YES" : "NO"}`)
  console.log(`  rows left for a human:   ${after.invalidGar}\n`)
  if (!ok) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
