// ============================================================================
// GET  /api/admin/audit-logs        — List platform audit logs
// GET  /api/admin/audit-logs?export=csv  — Download as CSV
//
// Access: QUANTIX_SUPER_ADMIN and PLATFORM_ADMIN only.
// Logs are read-only through the API — no POST/PATCH/DELETE.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse, getPaginationParams } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

const ALLOWED_ROLES = new Set(['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'])

// ── GET ───────────────────────────────────────────────────────────────────────
export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'platform:audit_logs',
})(async (req: AuthenticatedRequest) => {
  try {
    // Restrict to Super Admin + Platform Admin only
    const role = req.user?.role ?? ''
    if (!ALLOWED_ROLES.has(role)) {
      return createErrorResponse('Access denied — Super Admin or Platform Admin required', 403)
    }

    const { searchParams } = new URL(req.url)
    const isExport  = searchParams.get('export') === 'csv'

    const search    = searchParams.get('search')   ?? ''
    const module    = searchParams.get('module')   ?? ''
    const action    = searchParams.get('action')   ?? ''
    const severity  = searchParams.get('severity') ?? ''
    const userId    = searchParams.get('userId')   ?? ''
    const dateFrom  = searchParams.get('dateFrom') ?? ''
    const dateTo    = searchParams.get('dateTo')   ?? ''

    const where: Record<string, unknown> = {}

    if (module)   where.module   = module
    if (action)   where.action   = action
    if (severity) where.severity = severity
    if (userId)   where.userId   = userId

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) }                            : {}),
        ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59.999Z`) }           : {}),
      }
    }

    if (search) {
      where.OR = [
        { userName:    { contains: search } },
        { email:       { contains: search } },
        { description: { contains: search } },
        { module:      { contains: search } },
        { action:      { contains: search } },
        { resourceType:{ contains: search } },
        { ipAddress:   { contains: search } },
      ]
    }

    if (isExport) {
      const logs = await db.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10_000,
      })
      const csv = toCsv(logs)
      const date = new Date().toISOString().split('T')[0]
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${date}.csv"`,
        },
      })
    }

    const { page, limit, skip } = getPaginationParams(req)

    const [total, logs] = await Promise.all([
      db.platformAuditLog.count({ where }),
      db.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id:             true,
          userId:         true,
          userName:       true,
          email:          true,
          role:           true,
          module:         true,
          action:         true,
          resourceType:   true,
          resourceId:     true,
          description:    true,
          severity:       true,
          ipAddress:      true,
          browser:        true,
          operatingSystem:true,
          deviceType:     true,
          createdAt:      true,
          // old/new values intentionally omitted from list — loaded on detail
        },
      }),
    ])

    // Stats counters (cheap, single DB round-trip each)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [todayCount, criticalCount] = await Promise.all([
      db.platformAuditLog.count({ where: { createdAt: { gte: today } } }),
      db.platformAuditLog.count({ where: { severity: 'CRITICAL' } }),
    ])

    return NextResponse.json({
      success: true,
      data: logs,
      stats: { todayCount, criticalCount },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit logs'
    return createErrorResponse(message, 500)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// CSV helper
// ─────────────────────────────────────────────────────────────────────────────

type AuditRow = {
  id: string; userId: string | null; userName: string | null; email: string | null
  role: string | null; module: string; action: string; resourceType: string | null
  resourceId: string | null; description: string; severity: string
  ipAddress: string | null; browser: string | null; operatingSystem: string | null
  deviceType: string | null; createdAt: Date
}

function csvCell(val: unknown): string {
  const s = val == null ? '' : String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function toCsv(rows: AuditRow[]): string {
  const header = [
    'ID', 'Timestamp', 'User', 'Email', 'Role',
    'Module', 'Action', 'Description', 'Severity',
    'Resource Type', 'Resource ID', 'IP Address', 'Browser', 'OS', 'Device',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      r.id,
      r.createdAt.toISOString(),
      r.userName, r.email, r.role,
      r.module, r.action, r.description, r.severity,
      r.resourceType, r.resourceId, r.ipAddress, r.browser, r.operatingSystem, r.deviceType,
    ].map(csvCell).join(','))
  }
  return lines.join('\n')
}
