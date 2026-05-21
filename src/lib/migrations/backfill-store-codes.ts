// ============================================================================
// MIGRATION: backfill-store-codes
//
// Assigns STO-YYYYMM-NNNN codes to stores that are missing them or have the
// old STR-XXXXX format. Per-business sequence starting at 0001 (main store
// always gets 0001). Uses PlatformConfig as a migration lock so it runs only
// once automatically. Pass force=true to re-run from the admin UI.
// ============================================================================

import { db } from '@/lib/db'

const MIGRATION_KEY = 'migration:store_code_backfill_v1'

export interface BackfillResult {
  alreadyCompleted: boolean
  storesChecked: number
  storesUpdated: number
  storesSkipped: number
  updated: { businessCode: string; businessName: string; storeName: string; oldCode: string | null; newCode: string }[]
  skipped: { businessCode: string; storeName: string; code: string }[]
}

export async function runStoreCodeBackfill(force = false): Promise<BackfillResult> {
  // Check migration lock — skip if already completed (unless forced via admin UI)
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
    // Sort: main store first, then by createdAt — guarantees 0001 always goes to primary
    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, storeCode: true, isMainStore: true, createdAt: true },
    })

    let seq = 1
    for (const store of stores) {
      storesChecked++

      // Already has a valid STO- code — skip but advance sequence
      if (store.storeCode?.startsWith('STO-')) {
        skipped.push({
          businessCode: business.businessCode ?? business.id,
          storeName: store.name,
          code: store.storeCode,
        })
        seq++
        continue
      }

      // Generate new code using store's creation date for YYYYMM
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

  // Set migration lock so it never auto-runs again
  await db.platformConfig.upsert({
    where: { key: MIGRATION_KEY },
    create: {
      key: MIGRATION_KEY,
      value: JSON.stringify({ completedAt: new Date().toISOString(), storesUpdated: updated.length }),
      description: 'Store code backfill v1 — assigns STO-YYYYMM-NNNN to all stores',
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
