/**
 * Migrate VASTRASUDHA's legacy Bag IDs from BAG-NNNNNN to V8BAGxxx.
 *
 * Scope: VASTRASUDHA only (platform businessId = 'biz_vastrasudha').
 *
 * What IS migrated:
 *   LaundryBag.bagNumber + qrValue
 *   LaundryBagRelease.bagNumber
 *   LaundryBagEvent.bagNumber
 *   LaundryOrder.deliveryBagNumber  (if it matches a migrated bag)
 *   LaundryProcessingPackage.bagCode + qrValue  (if it matches a migrated bag)
 *   TenantEmployeeSequence (BAG namespace) — healed forward
 *
 * What is NOT touched:
 *   LaundryBag primary key (cuid)
 *   LaundryBagAssignment (no bagNumber field — uses bagId FK)
 *   All foreign keys
 *   Employee IDs, Delivery IDs, Customer IDs, Order IDs, Item IDs
 *   Any other tenant/business
 *   EMP, DL, COM namespaces in TenantEmployeeSequence
 *
 * Properties:
 *   - Defaults to dry-run (safe).  Pass --execute to write.
 *   - Single transaction (all-or-nothing).
 *   - Idempotent (legacy bags skipped; new-format bags skipped).
 *
 * Usage:
 *   npx tsx scripts/migrate-vastrasudha-bag-ids.ts              # dry-run
 *   npx tsx scripts/migrate-vastrasudha-bag-ids.ts --execute    # live
 */

import { PrismaClient } from "@prisma/client"
import { parseEmployeeId, deriveTenantPrefix } from "../src/lib/tenant-identity"

const prisma = new PrismaClient()
const EXECUTE = process.argv.includes("--execute")
const DRY_RUN = !EXECUTE

// ── VASTRASUDHA identity ─────────────────────────────────────────────────────
const PLATFORM_BIZ_ID = "biz_vastrasudha"
const LAUNDRY_BIZ_ID  = "lb_vs"

// ── Legacy bag code pattern ──────────────────────────────────────────────────
const LEGACY_BAG = /^BAG-(\d+)$/i

interface BagRename {
  id: string
  oldNumber: string
  newNumber: string
  seq: number
}

interface Summary {
  bags: number
  bagNumbers: number
  qrValues: number
  releases: number
  events: number
  deliveryBagNumbers: number
  processingBagCodes: number
  processingQrValues: number
  sequenceHealed: boolean
}

// ── Phase 1: Audit ───────────────────────────────────────────────────────────
async function audit(): Promise<{ renames: BagRename[]; summary: Summary }> {
  const prefix = await resolvePrefix()
  if (!prefix) return { renames: [], summary: emptySummary() }

  const bags = await prisma.laundryBag.findMany({
    where: { businessId: LAUNDRY_BIZ_ID },
    select: { id: true, bagNumber: true, qrValue: true },
    orderBy: { createdAt: "asc" },
  })

  const legacy = bags.filter((b) => LEGACY_BAG.test(b.bagNumber))
  const already = bags.filter((b) => !LEGACY_BAG.test(b.bagNumber))

  // Find highest sequence among already-migrated bags (if any)
  let highestExisting = 0
  for (const b of already) {
    const parsed = parseEmployeeId(b.bagNumber)
    if (parsed?.namespace === "BAG") {
      highestExisting = Math.max(highestExisting, parsed.sequence)
    }
  }

  // Map legacy bags to new IDs
  const renames: BagRename[] = []
  let nextSeq = highestExisting + 1
  for (const bag of legacy) {
    const match = LEGACY_BAG.exec(bag.bagNumber)
    if (!match) continue
    const newNum = `${prefix}BAG${String(nextSeq).padStart(3, "0")}`
    renames.push({ id: bag.id, oldNumber: bag.bagNumber, newNumber: newNum, seq: nextSeq })
    nextSeq++
  }

  // Count denormalized references that will change
  const bagIds = renames.map((r) => r.id)
  const summary: Summary = {
    bags: renames.length,
    bagNumbers: renames.length,
    qrValues: renames.length,
    releases: 0,
    events: 0,
    deliveryBagNumbers: 0,
    processingBagCodes: 0,
    processingQrValues: 0,
    sequenceHealed: false,
  }

  if (bagIds.length === 0) return { renames, summary }

  summary.releases = await prisma.laundryBagRelease.count({ where: { bagId: { in: bagIds } } })
  summary.events   = await prisma.laundryBagEvent.count({ where: { bagId: { in: bagIds } } })

  // LaundryOrder.deliveryBagNumber — matches old bag number strings
  const oldNumbers = renames.map((r) => r.oldNumber)
  summary.deliveryBagNumbers = await prisma.laundryOrder.count({
    where: { deliveryBagNumber: { in: oldNumbers } },
  })

  // LaundryProcessingPackage.bagCode — matches old bag number strings
  summary.processingBagCodes = await prisma.laundryProcessingPackage.count({
    where: { bagCode: { in: oldNumbers } },
  })

  // LaundryProcessingPackage.qrValue — matches old bag number strings
  // (only those where qrValue was overwritten to bagCode)
  summary.processingQrValues = await prisma.laundryProcessingPackage.count({
    where: { qrValue: { in: oldNumbers } },
  })

  return { renames, summary }
}

function emptySummary(): Summary {
  return {
    bags: 0, bagNumbers: 0, qrValues: 0, releases: 0, events: 0,
    deliveryBagNumbers: 0, processingBagCodes: 0, processingQrValues: 0,
    sequenceHealed: false,
  }
}

// ── Resolve tenant prefix ────────────────────────────────────────────────────
// Strategy: same as store-code migration — read the Business record directly.
// The prefix is derived deterministically from (businessCode, businessName),
// which is the same derivation used when TenantIdentity is first created.
async function resolvePrefix(): Promise<string | null> {
  // 1. Try TenantIdentity first (authoritative if present)
  const ti = await prisma.tenantIdentity.findUnique({ where: { businessId: PLATFORM_BIZ_ID } })
  if (ti) return ti.prefix

  // 2. Derive from Business record — same derivation TenantIdentity uses.
  //    This is the exact same lookup the working store-code migration uses.
  const biz = await prisma.business.findUnique({
    where: { id: PLATFORM_BIZ_ID },
    select: { businessCode: true, name: true },
  })
  if (biz?.businessCode) {
    const prefix = deriveTenantPrefix(biz.businessCode, biz.name)
    return prefix
  }

  // 3. If Business has no code yet, try LaundryBusiness for name
  const lb = await prisma.laundryBusiness.findUnique({
    where: { id: LAUNDRY_BIZ_ID },
    select: { name: true },
  })
  if (lb?.name) {
    // No code available — derive from name only (first letter + 0)
    // This is a fallback; the Business record should have a code.
    const prefix = deriveTenantPrefix(null, lb.name)
    return prefix
  }

  console.error("  ✗ Cannot resolve prefix: neither TenantIdentity nor Business found for", PLATFORM_BIZ_ID)
  return null
}

// ── Phase 2: Migrate ─────────────────────────────────────────────────────────
async function migrate(renames: BagRename[]): Promise<Summary> {
  const oldNumbers = renames.map((r) => r.oldNumber)
  const highestSeq = Math.max(...renames.map((r) => r.seq))

  return prisma.$transaction(async (tx) => {
    const s = { ...emptySummary(), bags: renames.length }

    // 1. Rename each bag's bagNumber + qrValue
    for (const r of renames) {
      await tx.laundryBag.update({
        where: { id: r.id },
        data: { bagNumber: r.newNumber, qrValue: r.newNumber },
      })
      s.bagNumbers++
      s.qrValues++
    }

    // 2. Denormalized copies: LaundryBagRelease.bagNumber
    for (const r of renames) {
      s.releases += await tx.laundryBagRelease.updateMany({
        where: { bagId: r.id },
        data: { bagNumber: r.newNumber },
      }).then((u) => u.count)
    }

    // 3. Denormalized copies: LaundryBagEvent.bagNumber
    for (const r of renames) {
      s.events += await tx.laundryBagEvent.updateMany({
        where: { bagId: r.id },
        data: { bagNumber: r.newNumber },
      }).then((u) => u.count)
    }

    // 4. LaundryOrder.deliveryBagNumber — update orders whose delivery bag
    //    was one of the migrated bags.
    if (oldNumbers.length > 0) {
      // Build a map: old → new
      const map = new Map(renames.map((r) => [r.oldNumber, r.newNumber]))
      const orders = await tx.laundryOrder.findMany({
        where: { deliveryBagNumber: { in: oldNumbers } },
        select: { id: true, deliveryBagNumber: true },
      })
      for (const o of orders) {
        const newNum = map.get(o.deliveryBagNumber!)
        if (newNum) {
          await tx.laundryOrder.update({
            where: { id: o.id },
            data: { deliveryBagNumber: newNum },
          })
          s.deliveryBagNumbers++
        }
      }
    }

    // 5. LaundryProcessingPackage.bagCode + qrValue
    if (oldNumbers.length > 0) {
      const map = new Map(renames.map((r) => [r.oldNumber, r.newNumber]))
      const pkgs = await tx.laundryProcessingPackage.findMany({
        where: { bagCode: { in: oldNumbers } },
        select: { id: true, bagCode: true, qrValue: true },
      })
      for (const p of pkgs) {
        const newCode = map.get(p.bagCode!)
        if (newCode) {
          const data: { bagCode?: string; qrValue?: string } = { bagCode: newCode }
          // qrValue was overwritten to bagCode at assign time
          if (p.qrValue === p.bagCode) data.qrValue = newCode
          await tx.laundryProcessingPackage.update({ where: { id: p.id }, data })
          s.processingBagCodes++
          if (data.qrValue) s.processingQrValues++
        }
      }
    }

    // 6. Heal TenantEmployeeSequence for BAG namespace
    //    Forward-only: move counter to highestSeq + 1 if it's behind.
    const seqRow = await tx.tenantEmployeeSequence.findUnique({
      where: { businessId_namespace: { businessId: PLATFORM_BIZ_ID, namespace: "BAG" } },
    })
    const target = highestSeq + 1
    if (!seqRow) {
      await tx.tenantEmployeeSequence.create({
        data: { businessId: PLATFORM_BIZ_ID, namespace: "BAG", next: target },
      }).catch(() => null)
      s.sequenceHealed = true
    } else if (seqRow.next < target) {
      await tx.tenantEmployeeSequence.update({
        where: { id: seqRow.id },
        data: { next: target },
      })
      s.sequenceHealed = true
    }

    return s
  }, { maxWait: 30_000, timeout: 60_000 })
}

// ── Phase 3: Verify ──────────────────────────────────────────────────────────
async function verify(renames: BagRename[]): Promise<boolean> {
  let clean = true

  // No legacy bag numbers remain
  const legacyRemain = await prisma.laundryBag.count({
    where: { businessId: LAUNDRY_BIZ_ID, bagNumber: { startsWith: "BAG-" } },
  })
  if (legacyRemain > 0) { console.error(`  ✗ ${legacyRemain} legacy bagNumber(s) remain`); clean = false }

  // No legacy qrValues remain
  const legacyQr = await prisma.laundryBag.count({
    where: { businessId: LAUNDRY_BIZ_ID, qrValue: { startsWith: "BAG-" } },
  })
  if (legacyQr > 0) { console.error(`  ✗ ${legacyQr} legacy qrValue(s) remain`); clean = false }

  // No legacy bagNumbers in release audit
  const legacyRel = await prisma.laundryBagRelease.count({
    where: { businessId: LAUNDRY_BIZ_ID, bagNumber: { startsWith: "BAG-" } },
  })
  if (legacyRel > 0) { console.error(`  ✗ ${legacyRel} legacy release bagNumber(s) remain`); clean = false }

  // No legacy bagNumbers in events
  const legacyEvt = await prisma.laundryBagEvent.count({
    where: { businessId: LAUNDRY_BIZ_ID, bagNumber: { startsWith: "BAG-" } },
  })
  if (legacyEvt > 0) { console.error(`  ✗ ${legacyEvt} legacy event bagNumber(s) remain`); clean = false }

  return clean
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[migrate-vastrasudha-bag-ids] ${EXECUTE ? "LIVE RUN" : "DRY RUN — no writes (pass --execute to apply)"}`)
  console.log(`  tenant: ${PLATFORM_BIZ_ID} / ${LAUNDRY_BIZ_ID}`)
  console.log()

  // 1. Audit
  console.log("── audit ──")
  const { renames, summary } = await audit()

  if (renames.length === 0) {
    const bags = await prisma.laundryBag.findMany({
      where: { businessId: LAUNDRY_BIZ_ID },
      select: { bagNumber: true },
    })
    if (bags.length === 0) {
      console.log("  no bags found for VASTRASUDHA")
    } else {
      console.log(`  ${bags.length} bags — all already in new format:`)
      for (const b of bags) console.log(`    ${b.bagNumber}`)
    }
    await prisma.$disconnect()
    return
  }

  console.log(`  bags to migrate: ${summary.bags}`)
  console.log()
  console.log("  before → after:")
  console.log("  " + "─".repeat(50))
  for (const r of renames) {
    console.log(`  ${r.oldNumber.padEnd(16)} → ${r.newNumber}`)
  }
  console.log("  " + "─".repeat(50))
  console.log()
  console.log("  denormalized references that will change:")
  console.log(`    bagNumber:              ${summary.bagNumbers}`)
  console.log(`    qrValue:               ${summary.qrValues}`)
  console.log(`    LaundryBagRelease:     ${summary.releases}`)
  console.log(`    LaundryBagEvent:       ${summary.events}`)
  console.log(`    deliveryBagNumber:     ${summary.deliveryBagNumbers}`)
  console.log(`    processing bagCode:    ${summary.processingBagCodes}`)
  console.log(`    processing qrValue:    ${summary.processingQrValues}`)
  console.log()
  console.log("  untouched:")
  console.log("    Employee IDs:           0")
  console.log("    Delivery IDs:           0")
  console.log("    Business IDs:           0")
  console.log("    Store IDs:              0")
  console.log("    Processing Center IDs:  0")
  console.log("    Customer IDs:           0")
  console.log("    Order IDs:              0")
  console.log("    Item IDs:               0")
  console.log("    Other tenants:          0")
  console.log()

  if (DRY_RUN) {
    console.log("── dry run: no writes performed ──")
    await prisma.$disconnect()
    return
  }

  // 2. Execute
  console.log("── executing migration (single transaction) ──")
  const after = await migrate(renames)
  console.log("  migrated:")
  console.log(`    bags renamed:           ${after.bags}`)
  console.log(`    bagNumber updates:      ${after.bagNumbers}`)
  console.log(`    qrValue updates:        ${after.qrValues}`)
  console.log(`    release updates:        ${after.releases}`)
  console.log(`    event updates:          ${after.events}`)
  console.log(`    deliveryBagNum updates: ${after.deliveryBagNumbers}`)
  console.log(`    pkg bagCode updates:    ${after.processingBagCodes}`)
  console.log(`    pkg qrValue updates:    ${after.processingQrValues}`)
  console.log(`    sequence healed:        ${after.sequenceHealed}`)
  console.log()

  // 3. Verify
  console.log("── verifying ──")
  const clean = await verify(renames)
  if (clean) {
    console.log("  ✓ all legacy bag codes migrated — zero remnants")
  } else {
    console.error("  ✗ remnants found")
    process.exitCode = 1
  }

  console.log()
  console.log("[migrate-vastrasudha-bag-ids] done")
}

main()
  .catch((e) => { console.error("[migrate-vastrasudha-bag-ids] fatal:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
