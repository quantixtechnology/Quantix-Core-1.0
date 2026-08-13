// GET /api/debug/store-live?businessCode=BUS-202605-0002
// Returns runtime DATABASE_URL, resolved DB path, and live per-store audit.
// TEMP: no auth — production debug only. Remove auth once store codes are confirmed.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { platformOnly } from "@/lib/platform-guard"

function expectedCode(businessCode: string, seq: number): string {
  return `STR-${businessCode}-${String(seq).padStart(3, '0')}`
}

function resolveDbPath(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null
  const raw = databaseUrl.replace(/^file:/, '')
  return raw.startsWith('/') ? raw : resolve(process.cwd(), raw)
}

export async function GET(req: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(req)
  if (_denied) return _denied
  const { searchParams } = new URL(req.url)
  const filterCode = searchParams.get('businessCode')

  const databaseUrl = process.env.DATABASE_URL ?? null
  const resolvedDbPath = resolveDbPath(databaseUrl ?? undefined)

  try {
    const businesses = await db.business.findMany({
      where: filterCode ? { businessCode: filterCode } : {},
      select: { id: true, name: true, businessCode: true },
      orderBy: { createdAt: 'asc' },
    })

    const result: {
      businessCode: string
      businessName: string
      stores: {
        storeId: string
        storeName: string
        createdAt: Date
        updatedAt: Date
        isMainStore: boolean
        actualStoreCode: string | null
        expectedStoreCode: string
        status: 'OK' | 'INVALID' | 'MISSING'
      }[]
    }[] = []

    for (const business of businesses) {
      if (!business.businessCode) continue

      const rows = await db.store.findMany({
        where: { businessId: business.id },
        orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, storeCode: true, isMainStore: true, createdAt: true, updatedAt: true },
      })

      let seq = 1
      const stores = rows.map(s => {
        const expected = expectedCode(business.businessCode!, seq++)
        const status: 'OK' | 'INVALID' | 'MISSING' =
          s.storeCode === null ? 'MISSING' :
          s.storeCode === expected ? 'OK' : 'INVALID'
        return {
          storeId: s.id,
          storeName: s.name,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          isMainStore: s.isMainStore,
          actualStoreCode: s.storeCode,
          expectedStoreCode: expected,
          status,
        }
      })

      result.push({ businessCode: business.businessCode, businessName: business.name, stores })
    }

    const allStores = result.flatMap(b => b.stores)
    const invalid = allStores.filter(s => s.status !== 'OK')

    return NextResponse.json({
      success: true,
      databaseUrl,
      resolvedDbPath,
      dbExistsOnDisk: resolvedDbPath ? existsSync(resolvedDbPath) : false,
      cwd: process.cwd(),
      summary: {
        total: allStores.length,
        ok: allStores.filter(s => s.status === 'OK').length,
        invalid: allStores.filter(s => s.status === 'INVALID').length,
        missing: allStores.filter(s => s.status === 'MISSING').length,
        healthy: invalid.length === 0,
      },
      businesses: result,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      databaseUrl,
      resolvedDbPath,
      error: error instanceof Error ? error.message : 'Query failed',
    }, { status: 500 })
  }
}
