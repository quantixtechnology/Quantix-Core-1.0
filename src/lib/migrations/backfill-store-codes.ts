import { db } from '@/lib/db'

export const MIGRATION_KEY = 'migration:store_code_backfill_v3'

// ---- Types ------------------------------------------------------------------

export interface StoreCodeStatus {
  businessCode: string
  businessName: string
  storeName: string
  storeId: string
  isMainStore: boolean
  storeCode: string | null
  storeSequence: number
  status: 'OK' | 'INVALID'
}

export interface BackfillResult {
  alreadyCompleted: boolean
  storesChecked: number
  storesUpdated: number
  storesSkipped: number
  updated: { businessCode: string; businessName: string; storeName: string; storeCode: string }[]
  skipped: { businessCode: string; storeName: string; storeCode: string }[]
}

// ---- Helpers ----------------------------------------------------------------

function expectedCode(businessCode: string, seq: number): string {
  return `${businessCode}-${String(seq).padStart(3, '0')}`
}

// ---- Verify -----------------------------------------------------------------

export async function verifyStoreCodes(): Promise<StoreCodeStatus[]> {
  const businesses = await db.business.findMany({
    select: { id: true, name: true, businessCode: true },
    orderBy: { createdAt: 'asc' },
  })

  const results: StoreCodeStatus[] = []

  for (const business of businesses) {
    if (!business.businessCode) continue

    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, name: true, storeCode: true, isMainStore: true },
    })

    let seq = 1
    for (const store of stores) {
      const expected = expectedCode(business.businessCode, seq)
      results.push({
        businessCode: business.businessCode,
        businessName: business.name,
        storeName: store.name,
        storeId: store.id,
        isMainStore: store.isMainStore,
        storeCode: store.storeCode,
        storeSequence: seq,
        status: store.storeCode === expected ? 'OK' : 'INVALID',
      })
      seq++
    }
  }

  return results
}

// ---- Backfill ---------------------------------------------------------------

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
    if (!business.businessCode) continue

    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, name: true, storeCode: true },
    })

    let seq = 1
    for (const store of stores) {
      storesChecked++
      const expected = expectedCode(business.businessCode, seq)

      if (store.storeCode === expected) {
        skipped.push({ businessCode: business.businessCode, storeName: store.name, storeCode: store.storeCode })
        seq++
        continue
      }

      await db.store.update({ where: { id: store.id }, data: { storeCode: expected } })
      updated.push({
        businessCode: business.businessCode,
        businessName: business.name,
        storeName: store.name,
        storeCode: expected,
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
