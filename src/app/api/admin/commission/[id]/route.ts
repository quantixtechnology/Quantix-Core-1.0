// ============================================================================
// DELETE /api/admin/commission/[id]  — hard delete (settings:edit only)
// GET    /api/admin/commission/[id]  — single record
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'commission:view',
})(async (_req: NextRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = Array.isArray(params?.id) ? params?.id[0] : params?.id
    if (!id) return createErrorResponse('id required', 400)

    const row = await db.commissionCalculation.findUnique({ where: { id } })
    if (!row) return createErrorResponse('Calculation not found', 404)

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch calculation'
    return createErrorResponse(message, 500)
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredPermission: 'settings:edit',
})(async (_req: NextRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = Array.isArray(params?.id) ? params?.id[0] : params?.id
    if (!id) return createErrorResponse('id required', 400)

    const row = await db.commissionCalculation.findUnique({ where: { id } })
    if (!row) return createErrorResponse('Calculation not found', 404)

    await db.commissionCalculation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete calculation'
    return createErrorResponse(message, 500)
  }
})
