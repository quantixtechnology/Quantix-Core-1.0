import { db } from '@/lib/db'

export const MIGRATION_KEY = 'migration:store_code_backfill_v3'

// ---- Types ------------------------------------------------------------------

export interface StoreCodeStatus {
  businessCode: string
  businessName: string
  storeName: string
  storeId: string
  isMainStore: boolean
  createdAt: Date
  storeSequence: number
  expectedStoreCode: string
  actualStoreCode: string | null
  status: 'OK' | 'INVALID'
}

export interface BackfillResult {
  alreadyCompleted: boolean
  storesUpdated: number
  errors: { businessCode: string; storeName: string; storeId: string; error: string }[]
  updated: {
    businessCode: string
    businessName: string
    storeName: string
    storeId: string
    isMainStore: boolean
    createdAt: Date
    storeSequence: number
    storeCode: string
  }[]
}

// ---- Helpers ----------------------------------------------------------------

function expectedCode(businessCode: string, seq: number): string {
  return `${businessCode}-${String(seq).padStart(3, '0')}`
}

// ---- Verify — read-only, full audit fields ----------------------------------

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
      // Main store always first (seq=1), then remaining by creation order
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, storeCode: true, isMainStore: true, createdAt: true },
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
        createdAt: store.createdAt,
        storeSequence: seq,
        expectedStoreCode: expected,
        actualStoreCode: store.storeCode,
        status: store.storeCode === expected ? 'OK' : 'INVALID',
      })
      seq++
    }
  }

  return results
}

// ---- Backfill — two-phase to eliminate unique-constraint collisions ----------
//
// Phase 1: SET all store codes to NULL for the business.
//          Removes ALL existing values atomically, so no value in the
//          business can conflict with what we assign in Phase 2.
//
// Phase 2: Assign expected codes sequentially (isMainStore DESC, createdAt ASC).
//          Main store is always seq=1 → businessCode-001.
//
// force=true bypasses the PlatformConfig lock.

export async function runStoreCodeBackfill(force = false): Promise<BackfillResult> {
  if (!force) {
    const lock = await db.platformConfig.findUnique({ where: { key: MIGRATION_KEY } })
    if (lock) {
      return { alreadyCompleted: true, storesUpdated: 0, errors: [], updated: [] }
    }
  }

  const businesses = await db.business.findMany({
    select: { id: true, name: true, businessCode: true },
    orderBy: { createdAt: 'asc' },
  })

  const updated: BackfillResult['updated'] = []
  const errors: BackfillResult['errors'] = []

  for (const business of businesses) {
    if (!business.businessCode) continue

    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isMainStore: true, createdAt: true },
    })

    if (stores.length === 0) continue

    // ── Phase 1: nullify all codes for this business ──────────────────────
    // Clears every storeCode so Phase 2 assignments can never conflict.
    await db.store.updateMany({
      where: { businessId: business.id },
      data: { storeCode: null },
    })

    // ── Phase 2: assign codes sequentially ───────────────────────────────
    let seq = 1
    for (const store of stores) {
      const code = expectedCode(business.businessCode, seq)
      try {
        await db.store.update({ where: { id: store.id }, data: { storeCode: code } })
        updated.push({
          businessCode: business.businessCode,
          businessName: business.name,
          storeName: store.name,
          storeId: store.id,
          isMainStore: store.isMainStore,
          createdAt: store.createdAt,
          storeSequence: seq,
          storeCode: code,
        })
      } catch (err) {
        errors.push({
          businessCode: business.businessCode,
          storeName: store.name,
          storeId: store.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      seq++
    }
  }

  await db.platformConfig.upsert({
    where: { key: MIGRATION_KEY },
    create: {
      key: MIGRATION_KEY,
      value: JSON.stringify({ completedAt: new Date().toISOString(), storesUpdated: updated.length }),
      description: 'Store code backfill v3 — {businessCode}-{pad3(seq)}, main store always seq=1',
    },
    update: {
      value: JSON.stringify({ completedAt: new Date().toISOString(), storesUpdated: updated.length }),
    },
  })

  return { alreadyCompleted: false, storesUpdated: updated.length, errors, updated }
}
