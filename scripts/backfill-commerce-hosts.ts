// ============================================================================
// QUANTIX CORE — Backfill: Commerce tenant app hosts (customer / store / delivery)
//
// Provisions the dedicated per-tenant app hosts for EXISTING Commerce businesses
// that predate the store/delivery hosts — without recreating anything. Reuses the
// EXACT same engine as Laundry + new-business provisioning (provisionTenantApps →
// customer <domain> + store.<domain> + delivery.<domain>, via provisionProductHost:
// nginx vhost + server_names_hash fix + Let's Encrypt + HSTS). Idempotent — existing
// vhosts/certs are reused, so it is safe to run repeatedly. NO duplicate DNS/Nginx/
// SSL logic.
//
// MUST run on the server (it shells out to sudo nginx / sudo certbot).
//   npx tsx scripts/backfill-commerce-hosts.ts             # all COMMERCE tenants
//   npx tsx scripts/backfill-commerce-hosts.ts --dry-run   # list only
//   npx tsx scripts/backfill-commerce-hosts.ts <businessId> # one tenant
//   npx tsx scripts/backfill-commerce-hosts.ts --all-products  # every workspace
// ============================================================================
import { prisma } from "@/lib/prisma"
import { provisionTenantApps } from "@/lib/laundry-app-provisioning"

const DRY_RUN = process.argv.includes("--dry-run")
const ALL = process.argv.includes("--all-products")
const onlyId = process.argv.find((a) => !a.startsWith("-") && a.length > 20 && !a.includes("/"))

async function main() {
  const where: Record<string, unknown> = onlyId
    ? { id: onlyId }
    : (ALL ? {} : { productCode: "COMMERCE" })
  const businesses = await prisma.business.findMany({
    where: where as never,
    select: { id: true, name: true, slug: true, productCode: true },
    orderBy: { createdAt: "asc" },
  })
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}${businesses.length} ${ALL ? "" : "Commerce "}tenant(s) to backfill.\n`)

  let ok = 0, failed = 0
  for (const b of businesses) {
    if (DRY_RUN) { console.log(`  would provision: ${b.name} [${b.productCode}] (${b.id})`); continue }
    process.stdout.write(`• ${b.name} [${b.productCode}] (${b.slug}) … `)
    try {
      const r = await provisionTenantApps(b.id)
      if (!r.ok) { console.log(`SKIP — ${r.error}`); failed++; continue }
      console.log(`customer=${r.customer.ssl} store=${r.store.ssl} delivery=${r.executive.ssl}`)
      if (r.store.ssl === "failed" || r.executive.ssl === "failed") failed++; else ok++
    } catch (e) {
      console.log(`ERROR — ${e instanceof Error ? e.message : e}`); failed++
    }
  }
  console.log(`\nDone. ${ok} provisioned, ${failed} failed/skipped.`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
