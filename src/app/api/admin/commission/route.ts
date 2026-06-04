// ============================================================================
// GET  /api/admin/commission          — paginated list of saved calculations
// POST /api/admin/commission          — save a new commission calculation
//
// Both signup and renewal calculations are stored in the same table.
// Use ?calcType=signup or ?calcType=renewal to filter.
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

// ── GET — list ────────────────────────────────────────────────────────────────
export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'commission:view',
})(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
    const skip  = (page - 1) * limit

    const salesPersonId = searchParams.get('salesPersonId')
    const calcType      = searchParams.get('calcType')   // "signup" | "renewal" | null (all)

    const where = {
      ...(salesPersonId ? { salesPersonId } : {}),
      ...(calcType      ? { calcType }      : {}),
    }

    const [rows, total] = await Promise.all([
      db.commissionCalculation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.commissionCalculation.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load calculations'
    return createErrorResponse(message, 500)
  }
})

// ── POST — save ───────────────────────────────────────────────────────────────
export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'commission:edit',
})(async (req: NextRequest) => {
  try {
    const body = await req.json() as {
      salesPersonId:     string
      salesPersonName:   string
      month:             number
      year:              number
      lineItems:         string
      totalQty:          number
      totalValue:        number
      qualifiedSlab:     number
      totalCommission:   number
      notes?:            string
      calcType?:         string   // "signup" (default) | "renewal"
      eligibilityStatus?: string  // "RELEASE" | "HOLD" (renewal only)
    }

    if (!body.salesPersonId || !body.salesPersonName)
      return createErrorResponse('salesPersonId and salesPersonName are required', 400)
    if (!body.month || body.month < 1 || body.month > 12)
      return createErrorResponse('month must be 1–12', 400)
    if (!body.year || body.year < 2020)
      return createErrorResponse('Invalid year', 400)
    if (typeof body.totalQty !== 'number' || typeof body.totalValue !== 'number')
      return createErrorResponse('totalQty and totalValue are required numbers', 400)

    const row = await db.commissionCalculation.create({
      data: {
        salesPersonId:     body.salesPersonId,
        salesPersonName:   body.salesPersonName,
        month:             body.month,
        year:              body.year,
        lineItems:         body.lineItems,
        totalQty:          body.totalQty,
        totalValue:        body.totalValue,
        qualifiedSlab:     body.qualifiedSlab,
        totalCommission:   body.totalCommission,
        notes:             body.notes             ?? null,
        calcType:          body.calcType          ?? 'signup',
        eligibilityStatus: body.eligibilityStatus ?? null,
      },
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save calculation'
    return createErrorResponse(message, 500)
  }
})
