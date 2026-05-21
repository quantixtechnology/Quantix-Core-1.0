// ============================================================================
// MIGRATION: backfill-store-codes v3
//
// Assigns {businessCode}-{pad3(seq)} codes to ALL stores (replaces any
// prior STO-* or STR-* codes). Format is globally unique by construction.
//
// Examples:
//   Fresh Mart  (BUS-202605-0001): Main → BUS-202605-0001-001, 2nd → BUS-202605-0001-002
//   Arbaz Chicken (BUS-202605-0002): Main → BUS-202605-0002-001, 2nd → BUS-202605-0002-002
//
// Rules:
//   - Per-business sequence, starts at 001.
//   - isMainStore=true always sorted first → always gets -001.
//   - Idempotent: skips stores whose code already matches {businessCode}-NNN pattern.
//   - Lock: PlatformConfig key = migration:store_code_backfill_v3
// ============================================================================

import { db } from '@/lib/db'

const MIGRATION_KEY = 'migration:store_code_backfill_v3'

export interface BackfillResult {
  alreadyCompleted: boolean
  storesChecked: number
  storesUpdated: number
  storesSkipped: number
  updated: { businessCode: string; businessName: string; storeName: string; oldCode: string | null; newCode: string }[]
  skipped: { businessCode: string; storeName: string; code: string }[]
}

export async function runStoreCodeBackfill(force = false): Promise<BackfillResult> {
  if (!force) {
    const lock = await db.platformConfig.findUnique({ where: { key: MIGRATION_KEY } })
    if (lock) {
      return { alreadyCompleted: true, storesChecked: 0, storesUpdated: 0, storesSkipped: 0, updated: [], skipped: [] }
    }
  }

  const businesses = await db.business.findMany({
    select: { id: true, name: true, businessCode: true },
    orderBy: { createdAt: 'asc' },
  })

  const updated: BackfillResult['updated'] = []
  const skipped: BackfillResult['skipped'] = []
  let storesChecked = 0

  for (const business of businesses) {
    if (!business.businessCode) continue // skip unprovisioned businesses

    // Main store first, then by createdAt — guarantees main store = -001
    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, storeCode: true, isMainStore: true },
    })

    let seq = 1
    for (const store of stores) {
      storesChecked++
      const expectedCode = `${business.businessCode}-${String(seq).padStart(3, '0')}`

      // Already has the correct new-format code — skip
      if (store.storeCode === expectedCode) {
        skipped.push({ businessCode: business.businessCode, storeName: store.name, code: store.storeCode })
        seq++
        continue
      }

      await db.store.update({ where: { id: store.id }, data: { storeCode: expectedCode } })
      updated.push({
        businessCode: business.businessCode,
        businessName: business.name,
        storeName: store.name,
        oldCode: store.storeCode,
        newCode: expectedCode,
      })
      seq++
    }
  }

  await db.platformConfig.upsert({
    where: { key: MIGRATION_KEY },
    create: {
      key: MIGRATION_KEY,
      value: JSON.stringify({ completedAt: new Date().toISOString(), storesUpdated: updated.length }),
      description: 'Store code backfill v3 — {businessCode}-{pad3(seq)} format, globally unique',
    },
    update: {
      value: JSON.stringify({ completedAt: new Date().toISOString(), storesUpdated: updated.length }),
    },
  })

  return {
    alreadyCompleted: false,
    storesChecked,
    storesUpdated: updated.length,
    storesSkipped: skipped.length,
    updated,
    skipped,
  }
}
