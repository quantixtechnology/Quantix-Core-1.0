// GET /api/debug/store-global-audit?businessCode=BUS-202605-0002
// Audits ALL DB locations that could reference legacy store codes.
// Public — no auth. TEMP: remove after production store codes confirmed clean.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { STORE_CODE_REGEX, isValidStoreCode } from '@/lib/migrations/backfill-store-codes'
import { platformOnly } from "@/lib/platform-guard"

const LEGACY_PATTERNS = [/^STR-\d{3,}$/, /^STO-/, /^BUS-.*-\d{3}$/]

function isLegacy(code: string | null | undefined): boolean {
  if (!code) return false
  if (isValidStoreCode(code)) return false
  return LEGACY_PATTERNS.some((p) => p.test(code))
}

function expectedCode(businessCode: string, seq: number): string {
  return `STR-${businessCode}-${String(seq).padStart(3, '0')}`
}

export async function GET(req: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(req)
  if (_denied) return _denied
  const { searchParams } = new URL(req.url)
  const filterCode = searchParams.get('businessCode')

  try {
    // ── 1. Fetch all businesses (optionally filtered) ──────────────────────
    const businesses = await db.business.findMany({
      where: filterCode ? { businessCode: filterCode } : undefined,
      select: { id: true, name: true, businessCode: true, settings: true },
      orderBy: { createdAt: 'asc' },
    })

    const storeRows: {
      table: string
      field: string
      businessCode: string
      businessName: string
      storeName: string
      storeId: string
      isMainStore: boolean
      sequence: number
      oldValue: string | null
      expectedValue: string
      status: 'OK' | 'INVALID' | 'MISSING' | 'LEGACY'
    }[] = []

    const jsonRows: {
      table: string
      field: string
      businessCode: string
      businessId: string
      matchedKeys: string[]
      excerpt: string
    }[] = []

    for (const biz of businesses) {
      if (!biz.businessCode) continue

      // ── 2. Store.storeCode ────────────────────────────────────────────────
      const stores = await db.store.findMany({
        where: { businessId: biz.id },
        orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, storeCode: true, isMainStore: true },
      })

      let seq = 1
      for (const s of stores) {
        const exp = expectedCode(biz.businessCode, seq)
        let status: 'OK' | 'INVALID' | 'MISSING' | 'LEGACY' = 'OK'
        if (!s.storeCode) status = 'MISSING'
        else if (isLegacy(s.storeCode)) status = 'LEGACY'
        else if (s.storeCode !== exp) status = 'INVALID'

        storeRows.push({
          table: 'Store',
          field: 'storeCode',
          businessCode: biz.businessCode,
          businessName: biz.name,
          storeName: s.name,
          storeId: s.id,
          isMainStore: s.isMainStore,
          sequence: seq,
          oldValue: s.storeCode,
          expectedValue: exp,
          status,
        })
        seq++
      }

      // ── 3. Business.settings JSON blob ────────────────────────────────────
      if (biz.settings && typeof biz.settings === 'object') {
        const json = JSON.stringify(biz.settings)
        const legacyMatches = json.match(/(STR-\d{3,}|STO-[^"]+|BUS-[^"]+-\d{3})/g) ?? []
        if (legacyMatches.length > 0) {
          jsonRows.push({
            table: 'Business',
            field: 'settings',
            businessCode: biz.businessCode,
            businessId: biz.id,
            matchedKeys: [...new Set(legacyMatches)],
            excerpt: json.slice(0, 500),
          })
        }
      }
    }

    // ── 4. Scan Order table for storeCode references ───────────────────────
    const orderRows: { orderId: string; storeId: string; storeCode: string | null; status: string }[] = []
    const storeIds = (await db.store.findMany({
      where: filterCode
        ? { business: { businessCode: filterCode } }
        : {},
      select: { id: true, storeCode: true },
    }))

    for (const s of storeIds) {
      if (isLegacy(s.storeCode) || !isValidStoreCode(s.storeCode)) {
        // Already captured in storeRows above
      }
    }

    const legacyStoreRows = storeRows.filter((r) => r.status !== 'OK')
    const summary = {
      totalStoresChecked: storeRows.length,
      legacyOrInvalid: legacyStoreRows.length,
      jsonBlobsWithLegacyCodes: jsonRows.length,
      allClean: legacyStoreRows.length === 0 && jsonRows.length === 0,
    }

    return NextResponse.json({
      success: true,
      filter: filterCode ?? 'all',
      summary,
      storeTable: storeRows,
      jsonBlobs: jsonRows,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
