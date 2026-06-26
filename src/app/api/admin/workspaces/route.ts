// ============================================================================
// GET  /api/admin/workspaces       — list all workspaces (paginated)
// POST /api/admin/workspaces       — create or sync workspace
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { logPlatformEvent } from '@/lib/platform-audit'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'workspaces:view',
})(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const skip = (page - 1) * limit

    // Optional filters
    const status = url.searchParams.get('status')
    const businessId = url.searchParams.get('businessId')
    const productCode = url.searchParams.get('productCode')

    const where: Record<string, any> = {}
    if (status) where.status = status
    if (businessId) where.businessId = businessId
    if (productCode) where.productCode = productCode

    const [workspaces, total] = await Promise.all([
      db.platformWorkspace.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.platformWorkspace.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: workspaces,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load workspaces'
    return createErrorResponse(message, 500)
  }
})

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'workspaces:manage',
})(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json() as Record<string, unknown>

    // Validate required fields
    const errors: Record<string, string> = {}
    if (!body.businessId || typeof body.businessId !== 'string') errors.businessId = 'Business ID is required'
    if (!body.productCode || typeof body.productCode !== 'string') errors.productCode = 'Product code is required'
    if (!body.workspaceUrl || typeof body.workspaceUrl !== 'string') errors.workspaceUrl = 'Workspace URL is required'

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 })
    }

    // Check if workspace already exists
    const existing = await db.platformWorkspace.findFirst({
      where: {
        businessId: body.businessId as string,
        productCode: body.productCode as string,
      },
    })

    if (existing) {
      // Update existing workspace (sync)
      const updated = await db.platformWorkspace.update({
        where: { id: existing.id },
        data: {
          workspaceUrl: body.workspaceUrl as string,
          currentVersion: body.currentVersion as string | undefined,
          status: body.status as string | undefined,
          storageAllocatedMB: typeof body.storageAllocatedMB === 'number'
            ? body.storageAllocatedMB
            : existing.storageAllocatedMB,
          storageUsedMB: typeof body.storageUsedMB === 'number'
            ? body.storageUsedMB
            : existing.storageUsedMB,
          subscriptionPlan: body.subscriptionPlan as string | undefined,
          websiteStatus: body.websiteStatus as string | undefined,
          websiteDomain: body.websiteDomain as string | undefined,
          featuresEnabled: typeof body.featuresEnabled === 'number'
            ? body.featuresEnabled
            : existing.featuresEnabled,
          healthStatus: body.healthStatus as string | undefined,
          notes: body.notes as string | undefined,
          lastSyncTime: new Date(),
        },
      })

      logPlatformEvent({
        userId: req.user?.id,
        userName: req.user?.name,
        email: req.user?.email,
        role: req.user?.role,
        module: 'WORKSPACES',
        action: 'UPDATE',
        description: `Workspace synced: ${updated.businessId} (${updated.productCode})`,
        newValues: updated,
        severity: 'INFO',
        req,
      })

      return NextResponse.json({ success: true, data: updated })
    }

    // Create new workspace
    const workspace = await db.platformWorkspace.create({
      data: {
        businessId: body.businessId as string,
        productCode: body.productCode as string,
        workspaceUrl: body.workspaceUrl as string,
        currentVersion: body.currentVersion as string | undefined,
        status: body.status as string | undefined,
        storageAllocatedMB: typeof body.storageAllocatedMB === 'number'
          ? body.storageAllocatedMB
          : 1048576,
        storageUsedMB: typeof body.storageUsedMB === 'number'
          ? body.storageUsedMB
          : 0,
        subscriptionPlan: body.subscriptionPlan as string | undefined,
        websiteStatus: body.websiteStatus as string | undefined,
        websiteDomain: body.websiteDomain as string | undefined,
        featuresEnabled: typeof body.featuresEnabled === 'number'
          ? body.featuresEnabled
          : 0,
        healthStatus: body.healthStatus as string | undefined,
        notes: body.notes as string | undefined,
        lastSyncTime: new Date(),
      },
    })

    logPlatformEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      module: 'WORKSPACES',
      action: 'CREATE',
      description: `Workspace created: ${workspace.businessId} (${workspace.productCode})`,
      newValues: workspace,
      severity: 'INFO',
      req,
    })

    return NextResponse.json({ success: true, data: workspace }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create/sync workspace'
    return createErrorResponse(message, 500)
  }
})
