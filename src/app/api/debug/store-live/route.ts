// GET /api/debug/store-live?businessCode=BUS-202605-0002
// Returns runtime DATABASE_URL, resolved DB path, cwd, and live store state.
// Use this to confirm the runtime is hitting the correct SQLite file.
// Requires QUANTIX_SUPER_ADMIN role.

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'
import { existsSync } from 'fs'
import { resolve } from 'path'

function expectedCode(businessCode: string, seq: number): string {
  return `${businessCode}-${String(seq).padStart(3, '0')}`
}

function resolveDbPath(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null
  // Strip leading "file:" prefix
  const raw = databaseUrl.replace(/^file:/, '')
  // Absolute path
  if (raw.startsWith('/')) return raw
  // Relative path — resolve from process.cwd()
  return resolve(process.cwd(), raw)
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req) => {
  const { searchParams } = new URL(req.url)
  const filterCode = searchParams.get('businessCode')

  const databaseUrl = process.env.DATABASE_URL
  const dbPath = resolveDbPath(databaseUrl)

  const runtime = {
    databaseUrl: databaseUrl ?? null,
    resolvedDbPath: dbPath,
    dbExistsOnDisk: dbPath ? existsSync(dbPath) : false,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV ?? null,
  }

  try {
    const businesses = await db.business.findMany({
      where: filterCode ? { businessCode: filterCode } : {},
      select: { id: true, name: true, businessCode: true },
      orderBy: { createdAt: 'asc' },
    })

    const stores: {
      businessCode: string
      storeId: string
      storeName: string
      isMainStore: boolean
      createdAt: Date
      storeSequence: number
      actualStoreCode: string | null
      expectedStoreCode: string
      status: 'OK' | 'INVALID'
    }[] = []

    for (const business of businesses) {
      if (!business.businessCode) continue

      const rows = await db.store.findMany({
        where: { businessId: business.id },
        orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, storeCode: true, isMainStore: true, createdAt: true },
      })

      let seq = 1
      for (const s of rows) {
        const expected = expectedCode(business.businessCode, seq)
        stores.push({
          businessCode: business.businessCode,
          storeId: s.id,
          storeName: s.name,
          isMainStore: s.isMainStore,
          createdAt: s.createdAt,
          storeSequence: seq,
          actualStoreCode: s.storeCode,
          expectedStoreCode: expected,
          status: s.storeCode === expected ? 'OK' : 'INVALID',
        })
        seq++
      }
    }

    const invalid = stores.filter(s => s.status === 'INVALID')

    return NextResponse.json({
      success: true,
      runtime,
      summary: {
        total: stores.length,
        ok: stores.length - invalid.length,
        invalid: invalid.length,
        healthy: invalid.length === 0,
      },
      stores,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      runtime,
      error: error instanceof Error ? error.message : 'Query failed',
    }, { status: 500 })
  }
})
