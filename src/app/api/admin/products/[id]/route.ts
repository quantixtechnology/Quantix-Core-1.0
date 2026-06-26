// ============================================================================
// GET    /api/admin/products/[id]  — get single product
// PATCH  /api/admin/products/[id]  — update product
// DELETE /api/admin/products/[id]  — delete product (not allowed)
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
  'name', 'description', 'workspaceUrl', 'currentVersion',
  'supportedCoreVersion', 'status', 'isEnabled',
  'defaultStorageQuotaMB', 'brandingTemplate', 'defaultBrandColor',
  'defaultPlanId', 'metadata',
])

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'products:view',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing product id', 400)

    const product = await db.platformProduct.findUnique({
      where: { id },
    })

    if (!product) {
      return createErrorResponse('Product not found', 404)
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load product'
    return createErrorResponse(message, 500)
  }
})

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredPermission: 'products:edit',
})(async (req: AuthenticatedRequest, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return createErrorResponse('Missing product id', 400)

    // Verify product exists
    const existing = await db.platformProduct.findUnique({
      where: { id },
    })

    if (!existing) {
      return createErrorResponse('Product not found', 404)
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

    // Update product
    const updated = await db.platformProduct.update({
      where: { id },
      data: {
        ...data,
        updatedBy: req.user?.id,
      },
    })

    logPlatformEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      module: 'PRODUCTS',
      action: 'UPDATE',
      description: `Product updated: ${existing.name} (fields: ${Object.keys(data).join(', ')})`,
      oldValues: existing,
      newValues: updated,
      severity: 'INFO',
      req,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product'
    return createErrorResponse(message, 500)
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
})(async (req: AuthenticatedRequest) => {
  return createErrorResponse('Cannot delete products. Use PATCH to disable instead.', 403)
})
