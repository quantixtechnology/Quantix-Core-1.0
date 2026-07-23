// ============================================================================
// QUANTIX CORE — Backfill: Store Admin (and all) tenant app hosts
//
// Provisions the dedicated per-tenant app hosts for EXISTING laundry businesses
// that predate the Store Admin host — without recreating anything. Reuses the
// exact same engine as new-business provisioning (provisionTenantApps →
// customer + delivery.<domain> + store.<domain>, via provisionProductHost:
// nginx vhost + server_names_hash fix + Let's Encrypt + HSTS). Idempotent —
// existing vhosts/certs are reused, so it is safe to run repeatedly.
//
// MUST run on the server (it shells out to sudo nginx / sudo certbot).
//   npx tsx scripts/backfill-store-hosts.ts            # provision all
//   npx tsx scripts/backfill-store-hosts.ts --dry-run  # list only
//   npx tsx scripts/backfill-store-hosts.ts <platformBusinessId>  # one business
// ============================================================================
import { prisma } from "@/lib/prisma"
import { provisionTenantApps } from "@/lib/laundry-app-provisioning"

const DRY_RUN = process.argv.includes("--dry-run")
const onlyId = process.argv.find((a) => !a.startsWith("-") && a.length > 20 && !a.includes("/"))

async function main() {
  const where = { platformBusinessId: onlyId ? onlyId : { not: null } }
  const businesses = await prisma.laundryBusiness.findMany({
    where: where as never,
    select: { platformBusinessId: true, businessName: true },
    orderBy: { createdAt: "asc" },
  })
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}${businesses.length} laundry business(es) to backfill.\n`)

  let ok = 0, failed = 0
  for (const b of businesses) {
    const pid = b.platformBusinessId!
    if (DRY_RUN) { console.log(`  would provision: ${b.businessName} (${pid})`); continue }
    process.stdout.write(`• ${b.businessName} (${pid}) … `)
    try {
      const r = await provisionTenantApps(pid)
      if (!r.ok) { console.log(`SKIP — ${r.error}`); failed++; continue }
      console.log(`customer=${r.customer.ssl} delivery=${r.executive.ssl} store=${r.store.ssl}`)
      if (r.store.ssl === "failed") { console.log(`    store error: ${r.store.error ?? "unknown"}`); failed++ } else ok++
    } catch (e) {
      console.log(`ERROR — ${e instanceof Error ? e.message : e}`); failed++
    }
  }
  console.log(`\nDone. ${ok} provisioned, ${failed} failed/skipped.`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
