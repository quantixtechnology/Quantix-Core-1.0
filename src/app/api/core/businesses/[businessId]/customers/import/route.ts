// ============================================================================
// POST /api/core/businesses/[businessId]/customers/import
// Bulk-import customers from a pre-parsed row payload.
// Duplicate strategy: "skip" | "update" | "create"
// Duplicate detection priority: phone → email → (name + area)
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

interface ImportRow {
  name?: string
  phone?: string
  email?: string
  address?: string
  area?: string
  pincode?: string
  city?: string
  state?: string
  loyaltyTier?: string
  walletBalance?: number | string
  notes?: string
  gst?: string
  tags?: string
  status?: string
}

type DuplicateStrategy = 'skip' | 'update' | 'create'

const VALID_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json() as {
      rows: ImportRow[]
      duplicateStrategy?: DuplicateStrategy
    }
    const rows = body.rows ?? []
    const strategy: DuplicateStrategy = body.duplicateStrategy ?? 'skip'

    if (!Array.isArray(rows) || rows.length === 0) {
      return createErrorResponse('No rows to import', 400)
    }

    type RowResult = {
      row: number
      status: 'created' | 'updated' | 'skipped' | 'error'
      name?: string
      reason?: string
    }
    const results: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const name = String(row.name ?? '').trim()

      if (!name) {
        results.push({ row: i + 1, status: 'skipped', reason: 'Missing customer name' })
        continue
      }

      try {
        const phone = row.phone ? String(row.phone).trim() : null
        const email = row.email ? String(row.email).trim().toLowerCase() : null

        const tierRaw = String(row.loyaltyTier ?? '').toUpperCase()
        const loyaltyTier = VALID_TIERS.includes(tierRaw) ? tierRaw : 'BRONZE'

        const tags = row.tags
          ? row.tags.split(',').map(t => t.trim()).filter(Boolean)
          : []
        const tagsJson = JSON.stringify(tags)

        const walletBalance = row.walletBalance ? Number(row.walletBalance) || 0 : 0
        const meta = JSON.stringify({
          walletBalance,
          ...(row.area ? { area: row.area } : {}),
        })

        const isActive = String(row.status ?? '').toLowerCase() !== 'inactive'
        const notes = String(row.notes ?? '')

        // ── Duplicate detection ────────────────────────────────────────────
        let existing: { id: string; name: string } | null = null

        if (phone) {
          existing = await db.customer.findUnique({
            where: { businessId_phone: { businessId, phone } },
            select: { id: true, name: true },
          })
        }
        if (!existing && email) {
          existing = await db.customer.findFirst({
            where: { businessId, email },
            select: { id: true, name: true },
          })
        }

        if (existing) {
          if (strategy === 'skip') {
            results.push({ row: i + 1, status: 'skipped', name, reason: 'Duplicate — skipped' })
            continue
          }

          if (strategy === 'update') {
            await db.customer.update({
              where: { id: existing.id },
              data: {
                name,
                ...(phone  ? { phone  } : {}),
                ...(email  ? { email  } : {}),
                loyaltyTier,
                notes: notes || undefined,
                tags: tagsJson,
                isActive,
                metadata: meta,
                gstNumber: row.gst ? String(row.gst) : undefined,
              },
            })
            results.push({ row: i + 1, status: 'updated', name })
            continue
          }
          // strategy === 'create' falls through to create a new record
        }

        // ── Create customer ────────────────────────────────────────────────
        const customer = await db.customer.create({
          data: {
            businessId,
            name,
            phone:      phone  ?? undefined,
            email:      email  ?? undefined,
            gstNumber:  row.gst ? String(row.gst) : undefined,
            loyaltyTier,
            notes,
            tags:      tagsJson,
            isActive,
            metadata:  meta,
          },
          select: { id: true },
        })

        // ── Create address if any address field present ────────────────────
        const hasAddress = row.address || row.city || row.pincode
        if (hasAddress) {
          await db.address.create({
            data: {
              customerId:   customer.id,
              addressLine1: String(row.address ?? row.area ?? ''),
              addressLine2: row.area  ? String(row.area)  : undefined,
              city:         String(row.city    ?? ''),
              state:        String(row.state   ?? ''),
              pincode:      String(row.pincode ?? ''),
              country:      'India',
              isDefault:    true,
            },
          })
        }

        results.push({ row: i + 1, status: 'created', name })
      } catch (err) {
        results.push({
          row: i + 1,
          status: 'error',
          name,
          reason: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const created  = results.filter(r => r.status === 'created').length
    const updated  = results.filter(r => r.status === 'updated').length
    const skipped  = results.filter(r => r.status === 'skipped').length
    const errors   = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: true,
      results,
      summary: { total: rows.length, created, updated, skipped, errors },
    })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Import failed',
      500,
    )
  }
})
