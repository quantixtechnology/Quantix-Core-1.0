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
    oldStoreCode: string | null
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

// ---- Backfill — atomic transaction per business -----------------------------
//
// Phase 1 (within transaction): SET all store codes to NULL for the business.
// Phase 2 (within transaction): Assign expected codes sequentially.
//
// Both phases run inside db.$transaction — if Phase 2 throws for any reason
// the entire business is rolled back atomically. No partial state possible.
//
// Sort: isMainStore DESC, createdAt ASC — main store always seq=1.
// No conditional skip. Every store is always rewritten unconditionally.
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

    // Fetch current codes BEFORE transaction (for old-value logging)
    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isMainStore: true, createdAt: true, storeCode: true },
    })

    if (stores.length === 0) continue

    const businessUpdated: BackfillResult['updated'] = []

    try {
      await db.$transaction(async (tx) => {
        // ── Phase 1: nullify all codes for this business ──────────────────
        await tx.store.updateMany({
          where: { businessId: business.id },
          data: { storeCode: null },
        })

        // ── Phase 2: assign codes sequentially — no skips, always overwrites
        let seq = 1
        for (const store of stores) {
          const code = expectedCode(business.businessCode!, seq)
          await tx.store.update({ where: { id: store.id }, data: { storeCode: code } })
          businessUpdated.push({
            businessCode: business.businessCode!,
            businessName: business.name,
            storeName: store.name,
            storeId: store.id,
            isMainStore: store.isMainStore,
            createdAt: store.createdAt,
            storeSequence: seq,
            oldStoreCode: store.storeCode,
            storeCode: code,
          })
          seq++
        }
      })

      updated.push(...businessUpdated)
    } catch (err) {
      for (const store of stores) {
        errors.push({
          businessCode: business.businessCode!,
          storeName: store.name,
          storeId: store.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
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
