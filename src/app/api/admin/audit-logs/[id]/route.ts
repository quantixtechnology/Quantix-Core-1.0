// ============================================================================
// GET /api/admin/audit-logs/[id]  — Full audit log detail (incl. old/new JSON)
//
// Access: QUANTIX_SUPER_ADMIN and PLATFORM_ADMIN only.
// Read-only — no mutation allowed.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const ALLOWED_ROLES = new Set(['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'])

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'platform:audit_logs',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const role = req.user?.role ?? ''
    if (!ALLOWED_ROLES.has(role)) {
      return createErrorResponse('Access denied', 403)
    }

    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing audit log id', 400)

    const log = await db.platformAuditLog.findUnique({ where: { id } })
    if (!log) return createErrorResponse('Audit log not found', 404)

    return NextResponse.json({ success: true, data: log })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit log'
    return createErrorResponse(message, 500)
  }
})
