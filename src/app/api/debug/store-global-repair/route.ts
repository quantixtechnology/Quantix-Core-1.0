// POST /api/debug/store-global-repair?businessCode=BUS-202605-0002
// Atomically repairs ALL legacy/invalid store codes across the DB.
// Covers: Store.storeCode (STR-000x, STO-*, BUS-*-001 patterns)
// Public — no auth. TEMP: remove after production confirmed clean.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { STORE_CODE_REGEX, isValidStoreCode, MIGRATION_KEY } from '@/lib/migrations/backfill-store-codes'

const LEGACY_PATTERNS = [/^STR-\d{3,}$/, /^STO-/, /^BUS-.*-\d{3}$/]

function isLegacyOrInvalid(code: string | null | undefined): boolean {
  if (!code) return true // NULL → needs assignment
  if (isValidStoreCode(code)) return false
  return true // any non-valid code needs repair
}

function expectedCode(businessCode: string, seq: number): string {
  return `STR-${businessCode}-${String(seq).padStart(3, '0')}`
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const filterCode = searchParams.get('businessCode')

  try {
    const businesses = await db.business.findMany({
      where: filterCode ? { businessCode: filterCode } : undefined,
      select: { id: true, name: true, businessCode: true },
      orderBy: { createdAt: 'asc' },
    })

    const repaired: {
      businessCode: string
      businessName: string
      storeName: string
      storeId: string
      isMainStore: boolean
      sequence: number
      oldCode: string | null
      newCode: string
    }[] = []

    const skipped: {
      businessCode: string
      storeName: string
      storeId: string
      code: string
      reason: string
    }[] = []

    const errors: {
      businessCode: string
      error: string
    }[] = []

    for (const biz of businesses) {
      if (!biz.businessCode) continue

      const stores = await db.store.findMany({
        where: { businessId: biz.id },
        orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, storeCode: true, isMainStore: true },
      })

      if (stores.length === 0) continue

      // Determine if any store needs repair
      const needsRepair = stores.some((s, i) => {
        const exp = expectedCode(biz.businessCode!, i + 1)
        return isLegacyOrInvalid(s.storeCode) || s.storeCode !== exp
      })

      if (!needsRepair) {
        for (const s of stores) {
          skipped.push({
            businessCode: biz.businessCode,
            storeName: s.name,
            storeId: s.id,
            code: s.storeCode ?? '(null)',
            reason: 'already_correct',
          })
        }
        continue
      }

      const businessRepaired: typeof repaired = []

      try {
        await db.$transaction(async (tx) => {
          // Phase 1: NULL all codes for this business (clears unique constraint)
          await tx.store.updateMany({
            where: { businessId: biz.id },
            data: { storeCode: null },
          })

          // Phase 2: assign expected codes sequentially
          let seq = 1
          for (const store of stores) {
            const code = expectedCode(biz.businessCode!, seq)
            await tx.store.update({
              where: { id: store.id },
              data: { storeCode: code },
            })
            businessRepaired.push({
              businessCode: biz.businessCode!,
              businessName: biz.name,
              storeName: store.name,
              storeId: store.id,
              isMainStore: store.isMainStore,
              sequence: seq,
              oldCode: store.storeCode,
              newCode: code,
            })
            seq++
          }
        })

        repaired.push(...businessRepaired)
      } catch (err) {
        errors.push({
          businessCode: biz.businessCode,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Force-update the migration lock so startup won't fight with this
    await db.platformConfig.upsert({
      where: { key: MIGRATION_KEY },
      create: {
        key: MIGRATION_KEY,
        value: JSON.stringify({
          completedAt: new Date().toISOString(),
          storesUpdated: repaired.length,
          source: 'global-repair-endpoint',
        }),
        description: 'Store code backfill v4 — forced via global repair endpoint',
      },
      update: {
        value: JSON.stringify({
          completedAt: new Date().toISOString(),
          storesUpdated: repaired.length,
          source: 'global-repair-endpoint',
        }),
      },
    })

    // Verify final state
    const verification = await Promise.all(
      businesses
        .filter((b) => b.businessCode)
        .map(async (biz) => {
          const stores = await db.store.findMany({
            where: { businessId: biz.id },
            orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
            select: { id: true, name: true, storeCode: true, isMainStore: true },
          })
          return stores.map((s, i) => ({
            businessCode: biz.businessCode!,
            storeName: s.name,
            storeId: s.id,
            isMainStore: s.isMainStore,
            storeCode: s.storeCode,
            expectedCode: expectedCode(biz.businessCode!, i + 1),
            verified: s.storeCode === expectedCode(biz.businessCode!, i + 1),
          }))
        })
    )

    const flat = verification.flat()
    const allVerified = flat.every((v) => v.verified)

    return NextResponse.json({
      success: errors.length === 0,
      filter: filterCode ?? 'all',
      summary: {
        repaired: repaired.length,
        skipped: skipped.length,
        errors: errors.length,
        allVerified,
      },
      repaired,
      skipped,
      errors,
      verification: flat,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
