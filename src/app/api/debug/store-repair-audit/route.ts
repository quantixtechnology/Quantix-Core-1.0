// GET /api/debug/store-repair-audit?businessCode=BUS-202605-0002
// Per-store SQL audit: actual code, expected code, sequence, mismatch flag.
// TEMP: no auth — production debug only. Remove once store codes are confirmed.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

function expectedCode(businessCode: string, seq: number): string {
  return `STR-${businessCode}-${String(seq).padStart(3, '0')}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filterCode = searchParams.get('businessCode')

  try {
    const businesses = await db.business.findMany({
      where: filterCode ? { businessCode: filterCode } : {},
      select: { id: true, name: true, businessCode: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const rows: {
      businessCode: string
      businessName: string
      storeId: string
      storeName: string
      isMainStore: boolean
      createdAt: Date
      storeSequence: number
      actualStoreCode: string | null
      expectedStoreCode: string
      status: 'OK' | 'INVALID' | 'MISSING'
    }[] = []

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
        const status: 'OK' | 'INVALID' | 'MISSING' =
          store.storeCode === null ? 'MISSING' :
          store.storeCode === expected ? 'OK' : 'INVALID'
        rows.push({
          businessCode: business.businessCode,
          businessName: business.name,
          storeId: store.id,
          storeName: store.name,
          isMainStore: store.isMainStore,
          createdAt: store.createdAt,
          storeSequence: seq,
          actualStoreCode: store.storeCode,
          expectedStoreCode: expected,
          status,
        })
        seq++
      }
    }

    const invalid = rows.filter(r => r.status !== 'OK')

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        ok: rows.filter(r => r.status === 'OK').length,
        invalid: rows.filter(r => r.status === 'INVALID').length,
        missing: rows.filter(r => r.status === 'MISSING').length,
        healthy: invalid.length === 0,
      },
      data: rows,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
