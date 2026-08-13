// POST /api/debug/force-store-repair?businessCode=BUS-202605-0002
// Runs an atomic repair transaction directly via API (bypasses startup hook).
// Returns before/after state per store.
// TEMP: no auth — production debug only. Remove once store codes are confirmed.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformOnly } from "@/lib/platform-guard"

function expectedCode(businessCode: string, seq: number): string {
  return `STR-${businessCode}-${String(seq).padStart(3, '0')}`
}

async function auditBusiness(businessId: string, businessCode: string) {
  const rows = await db.store.findMany({
    where: { businessId },
    orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, storeCode: true, isMainStore: true, createdAt: true },
  })
  let seq = 1
  return rows.map(s => {
    const expected = expectedCode(businessCode, seq++)
    return {
      storeId: s.id,
      storeName: s.name,
      isMainStore: s.isMainStore,
      createdAt: s.createdAt,
      actualStoreCode: s.storeCode,
      expectedStoreCode: expected,
      status: s.storeCode === expected ? 'OK' : 'INVALID',
    }
  })
}

export async function POST(req: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(req)
  if (_denied) return _denied
  const { searchParams } = new URL(req.url)
  const businessCode = searchParams.get('businessCode')

  if (!businessCode) {
    return NextResponse.json({ success: false, error: 'businessCode query param required' }, { status: 400 })
  }

  try {
    const business = await db.business.findFirst({
      where: { businessCode },
      select: { id: true, name: true, businessCode: true },
    })

    if (!business || !business.businessCode) {
      return NextResponse.json({ success: false, error: `Business not found: ${businessCode}` }, { status: 404 })
    }

    // ── Before state ──────────────────────────────────────────────────────
    const before = await auditBusiness(business.id, business.businessCode)

    // ── Fetch stores for repair (capture old codes before transaction) ────
    const stores = await db.store.findMany({
      where: { businessId: business.id },
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isMainStore: true, createdAt: true, storeCode: true },
    })

    if (stores.length === 0) {
      return NextResponse.json({ success: false, error: 'No stores found for this business' }, { status: 404 })
    }

    // ── Atomic repair transaction ─────────────────────────────────────────
    const repaired: { storeId: string; storeName: string; isMainStore: boolean; oldCode: string | null; newCode: string }[] = []

    await db.$transaction(async (tx) => {
      // Phase 1: NULL all codes for this business atomically
      await tx.store.updateMany({
        where: { businessId: business.id },
        data: { storeCode: null },
      })

      // Phase 2: assign sequentially — no skips, unconditional
      let seq = 1
      for (const store of stores) {
        const code = expectedCode(business.businessCode!, seq)
        await tx.store.update({ where: { id: store.id }, data: { storeCode: code } })
        repaired.push({
          storeId: store.id,
          storeName: store.name,
          isMainStore: store.isMainStore,
          oldCode: store.storeCode,
          newCode: code,
        })
        seq++
      }
    })

    // ── After state ───────────────────────────────────────────────────────
    const after = await auditBusiness(business.id, business.businessCode)

    const stillInvalid = after.filter(s => s.status === 'INVALID')

    return NextResponse.json({
      success: true,
      businessCode: business.businessCode,
      businessName: business.name,
      repaired,
      before,
      after,
      stillInvalid: stillInvalid.length,
      healthy: stillInvalid.length === 0,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Repair failed',
    }, { status: 500 })
  }
}
