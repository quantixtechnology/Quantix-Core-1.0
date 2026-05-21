// ============================================================================
// MIGRATION: backfill-store-codes v3
//
// Assigns {businessCode}-{pad3(seq)} codes to ALL stores.
// Format is globally unique by construction.
//
//   Fresh Mart  (BUS-202605-0001): Main → BUS-202605-0001-001
//   Arbaz Chicken (BUS-202605-0002): Main → BUS-202605-0002-001
//
// verifyStoreCodes() — always runs on startup, even when lock is set.
//   Returns per-store status: OK | NEEDS_REPAIR
//   If any store needs repair → runStoreCodeBackfill(force=true) is called automatically.
//
// Lock: PlatformConfig key = migration:store_code_backfill_v3
// ============================================================================

import { db } from '@/lib/db'

export const MIGRATION_KEY = 'migration:store_code_backfill_v3'

// ---- Types ------------------------------------------------------------------

export interface StoreCodeStatus {
  businessCode: string
  businessName: string
  storeName: string
  storeId: string
  isMainStore: boolean
  currentStoreCode: string | null
  expectedStoreCode: string
  status: 'OK' | 'NEEDS_REPAIR'
}

export interface BackfillResult {
  alreadyCompleted: boolean
  storesChecked: number
  storesUpdated: number
  storesSkipped: number
  updated: { businessCode: string; businessName: string; storeName: string; oldCode: string | null; newCode: string }[]
  skipped: { businessCode: string; storeName: string; code: string }[]
}

// ---- Helpers ----------------------------------------------------------------

function expectedCode(businessCode: string, seq: number): string {
  return `${businessCode}-${String(seq).padStart(3, '0')}`
}

function isLegacyCode(code: string | null): boolean {
  if (!code) return true
  return code.startsWith('STR-') || code.startsWith('STO-')
}

// ---- Verify -----------------------------------------------------------------

/**
 * Computes expected store codes for every store across all businesses.
 * Does NOT write anything — read-only verification.
 */
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
        currentStoreCode: store.storeCode,
        expectedStoreCode: expected,
        status: store.storeCode === expected ? 'OK' : 'NEEDS_REPAIR',
      })
      seq++
    }
  }

  return results
}

// ---- Backfill ---------------------------------------------------------------

/**
 * Assigns correct store codes to all stores that are missing them or have
 * legacy codes (STR-* / STO-*). Idempotent — skips stores already correct.
 * force=true bypasses the PlatformConfig lock (used by self-heal and admin UI).
 */
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
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, storeCode: true, isMainStore: true },
    })

    let seq = 1
    for (const store of stores) {
      storesChecked++
      const expected = expectedCode(business.businessCode, seq)

      if (store.storeCode === expected) {
        skipped.push({ businessCode: business.businessCode, storeName: store.name, code: store.storeCode })
        seq++
        continue
      }

      await db.store.update({ where: { id: store.id }, data: { storeCode: expected } })
      updated.push({
        businessCode: business.businessCode,
        businessName: business.name,
        storeName: store.name,
        oldCode: store.storeCode,
        newCode: expected,
      })
      seq++
    }
  }

  // Update lock (sets completion timestamp for audit)
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
