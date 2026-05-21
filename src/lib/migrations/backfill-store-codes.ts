// ============================================================================
// MIGRATION: backfill-store-codes v2
//
// Assigns STO-YYYYMM-NNNN codes per-business to stores that are missing them
// or have the old global STR-XXXXX format. The sequence is business-scoped:
//   BUS-202605-0001 → STO-202605-0001, STO-202605-0002
//   BUS-202605-0002 → STO-202605-0001, STO-202605-0002   ← same codes, different business
//
// This is safe because storeCode is now @@unique([businessId, storeCode]),
// not globally unique.
//
// Migration lock: PlatformConfig key = migration:store_code_backfill_v2
// Runs automatically on startup. Admin can force re-run via Ops Dashboard.
// ============================================================================

import { db } from '@/lib/db'

const MIGRATION_KEY = 'migration:store_code_backfill_v2'

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
    // Main store first (isMainStore desc), then by creation order.
    // This guarantees the primary store always receives sequence 0001.
    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, storeCode: true, isMainStore: true, createdAt: true },
    })

    // Per-business sequence: reset to 1 for every business.
    let seq = 1
    for (const store of stores) {
      storesChecked++

      // Already has a valid STO- code — skip and advance sequence counter.
      if (store.storeCode?.startsWith('STO-')) {
        skipped.push({
          businessCode: business.businessCode ?? business.id,
          storeName: store.name,
          code: store.storeCode,
        })
        seq++
        continue
      }

      // Use store's own createdAt for YYYYMM so the code reflects when it was made.
      const d = store.createdAt
      const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
      const newCode = `STO-${yyyymm}-${String(seq).padStart(4, '0')}`

      await db.store.update({ where: { id: store.id }, data: { storeCode: newCode } })

      updated.push({
        businessCode: business.businessCode ?? business.id,
        businessName: business.name,
        storeName: store.name,
        oldCode: store.storeCode,
        newCode,
      })
      seq++
    }
  }

  // Set v2 lock — v1 key is irrelevant; v2 runs independently.
  await db.platformConfig.upsert({
    where: { key: MIGRATION_KEY },
    create: {
      key: MIGRATION_KEY,
      value: JSON.stringify({ completedAt: new Date().toISOString(), storesUpdated: updated.length }),
      description: 'Store code backfill v2 — per-business STO-YYYYMM-NNNN sequence',
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
