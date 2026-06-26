// ============================================================================
// GET    /api/admin/workspaces/[id]  — get single workspace
// PATCH  /api/admin/workspaces/[id]  — update workspace status
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { logPlatformEvent } from '@/lib/platform-audit'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const PATCHABLE = new Set([
  'status', 'healthStatus', 'storageAllocatedMB', 'storageUsedMB',
  'subscriptionPlan', 'websiteStatus', 'websiteDomain', 'featuresEnabled',
  'notes', 'lastSyncTime',
])

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'workspaces:view',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing workspace id', 400)

    const workspace = await db.platformWorkspace.findUnique({
      where: { id },
    })

    if (!workspace) {
      return createErrorResponse('Workspace not found', 404)
    }

    return NextResponse.json({ success: true, data: workspace })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load workspace'
    return createErrorResponse(message, 500)
  }
})

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredPermission: 'workspaces:manage',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing workspace id', 400)

    // Verify workspace exists
    const existing = await db.platformWorkspace.findUnique({
      where: { id },
    })

    if (!existing) {
      return createErrorResponse('Workspace not found', 404)
    }

    const body = await req.json() as Record<string, unknown>

    // Only accept whitelisted fields
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body)) {
      if (PATCHABLE.has(k)) data[k] = v
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update workspace
    const updated = await db.platformWorkspace.update({
      where: { id },
      data,
    })

    logPlatformEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      module: 'WORKSPACES',
      action: 'UPDATE',
      description: `Workspace updated: ${existing.businessId} (fields: ${Object.keys(data).join(', ')})`,
      oldValues: existing,
      newValues: updated,
      severity: 'INFO',
      req,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update workspace'
    return createErrorResponse(message, 500)
  }
})
