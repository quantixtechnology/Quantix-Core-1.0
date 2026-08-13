// ============================================================================
// One-time Store Limit backfill — existing Laundry businesses only.
//
// Laundry workspaces provisioned by the Super Admin path were created without a
// LaundryScalingLimit row at all, so storesAllowed was null and the store limit
// went unenforced. New businesses are seeded correctly as of 2d2c481; this
// gives the existing ones the row they never got.
//
//   npx tsx scripts/backfill-store-limits.ts            # report only, writes nothing
//   npx tsx scripts/backfill-store-limits.ts --apply    # create the missing rows
//
// GUARANTEES
//   • CREATE only. A business that already has a scaling row is SKIPPED —
//     whatever its storesAllowed value, it is never modified.
//   • storesAllowed comes from the EFFECTIVE store limit: the business's
//     Resource Allocation override when one is configured, otherwise the plan's
//     branchLimit. The plan value is only a DEFAULT — a STARTER business
//     explicitly granted 5 stores has 5. Resolved by the SAME function the
//     application uses, so there is one definition of "Store Limit".
//     No plan and no override → skipped, never given an invented number.
//   • Touches nothing else: no stores, store types, active flags, quotas,
//     subscriptions, customers or orders.
//   • No separate Processing Center quota. Retail, Processing Center and Both
//     each consume one slot of the same storesAllowed.
//   • Idempotent — a second run reports every business as SKIP.
// ============================================================================
import { PrismaClient } from "@prisma/client"
import { resolveEffectiveStoreLimit } from "../src/lib/laundry-scaling-limits"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

interface Row {
  laundryBusinessId: string
  name: string
  hasScalingRow: boolean
  currentAllowed: number | null
  planCode: string | null
  planDefault: number | null
  override: number | null
  effective: number | null
  actualStores: number
  action: "CREATE" | "SKIP"
  reason: string
}

async function main() {
  console.log(APPLY ? "\nMODE: APPLY (creating missing rows)\n" : "\nMODE: REPORT ONLY (no writes)\n")

  const businesses = await prisma.laundryBusiness.findMany({
    select: { id: true, businessName: true, platformBusinessId: true },
    orderBy: { createdAt: "asc" },
  })

  const rows: Row[] = []

  for (const lb of businesses) {
    const [scaling, storeCount] = await Promise.all([
      prisma.laundryScalingLimit.findUnique({ where: { businessId: lb.id }, select: { storesAllowed: true } }),
      // Every location type counts once toward the same limit.
      prisma.laundryStore.count({ where: { laundryBusinessId: lb.id } }),
    ])

    // The SAME resolver the application uses: override ?? plan default.
    const limit = await resolveEffectiveStoreLimit(lb.platformBusinessId)

    let action: Row["action"] = "CREATE"
    let reason = limit.override != null
      ? `no scaling row — will create from the business override (${limit.override})`
      : "no scaling row — will create from the plan default"
    if (scaling) { action = "SKIP"; reason = "scaling row exists — left untouched" }
    else if (limit.effective == null) { action = "SKIP"; reason = "no plan default and no override — not guessed" }

    rows.push({
      laundryBusinessId: lb.id,
      name: lb.businessName,
      hasScalingRow: !!scaling,
      currentAllowed: scaling?.storesAllowed ?? null,
      planCode: limit.planCode,
      planDefault: limit.planDefault,
      override: limit.override,
      effective: limit.effective,
      actualStores: storeCount,
      action,
      reason,
    })
  }

  // ── Report ───────────────────────────────────────────────────────────────
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n))
  const n = (v: number | null) => (v == null ? "—" : String(v))
  console.log(
    pad("Business", 28) + pad("Plan", 12) + pad("PlanDflt", 10) + pad("Override", 10) +
    pad("Effective", 11) + pad("Stores", 8) + pad("Remaining", 11) + pad("ScalingRow", 12) + "Action",
  )
  console.log("-".repeat(110))
  for (const r of rows) {
    const remaining = r.effective == null ? "—" : String(Math.max(0, r.effective - r.actualStores))
    console.log(
      pad(r.name, 28) + pad(r.planCode ?? "—", 12) + pad(n(r.planDefault), 10) + pad(n(r.override), 10) +
      pad(n(r.effective), 11) + pad(String(r.actualStores), 8) + pad(remaining, 11) +
      pad(r.hasScalingRow ? `yes (${r.currentAllowed})` : "none", 12) + r.action,
    )
  }
  const toCreate = rows.filter((r) => r.action === "CREATE")
  console.log(`\n${toCreate.length} to create · ${rows.length - toCreate.length} skipped`)
  for (const r of rows.filter((x) => x.action === "SKIP")) console.log(`  SKIP ${r.name}: ${r.reason}`)

  if (!APPLY) {
    console.log("\nReport only. Re-run with --apply once reviewed.\n")
    return
  }

  // ── Apply — CREATE only, never update ────────────────────────────────────
  let created = 0
  for (const r of toCreate) {
    try {
      // create(), deliberately not upsert(): if a row appeared since the report
      // this throws on the unique businessId and the existing row is preserved.
      await prisma.laundryScalingLimit.create({
        data: { businessId: r.laundryBusinessId, storesAllowed: r.effective! },
      })
      created++
      console.log(`  created ${r.name}: storesAllowed = ${r.effective}${r.override != null ? " (business override)" : " (plan default)"}`)
    } catch (e) {
      console.error(`  FAILED ${r.name} (left unchanged):`, e instanceof Error ? e.message : e)
    }
  }
  console.log(`\nCreated ${created} scaling rows. No existing row was modified.\n`)

  // ── Verify ───────────────────────────────────────────────────────────────
  console.log("Business | Plan | Allowed Stores | Actual Stores | Remaining")
  for (const r of rows) {
    const scaling = await prisma.laundryScalingLimit.findUnique({
      where: { businessId: r.laundryBusinessId }, select: { storesAllowed: true },
    })
    const allowed = scaling?.storesAllowed ?? null
    const remaining = allowed == null ? "—" : String(Math.max(0, allowed - r.actualStores))
    console.log(`${r.name} | ${r.planCode ?? "—"} | ${allowed ?? "—"} | ${r.actualStores} | ${remaining}`)
  }
  console.log()
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
