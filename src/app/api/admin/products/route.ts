// ============================================================================
// GET  /api/admin/products        — list all products (paginated)
// POST /api/admin/products        — create new product (admin only)
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
  requiredPermission: 'products:view',
})(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      db.platformProduct.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.platformProduct.count(),
    ])

    // Attach each product's latest host-provisioning attempt (observability).
    // Best-effort: a logging/table issue must not break the products list.
    let data: Array<Record<string, unknown>> = products
    try {
      const codes = products.map((p) => p.code)
      const logs = codes.length
        ? await db.productHostProvisioningLog.findMany({
            where: { productCode: { in: codes } },
            orderBy: { createdAt: 'desc' },
          })
        : []
      const latestByCode = new Map<string, (typeof logs)[number]>()
      for (const l of logs) if (!latestByCode.has(l.productCode)) latestByCode.set(l.productCode, l)
      data = products.map((p) => ({ ...p, provisioning: latestByCode.get(p.code) ?? null }))
    } catch { /* observability is non-fatal */ }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load products'
    return createErrorResponse(message, 500)
  }
})

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'products:create',
})(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json() as Record<string, unknown>

    // Validate required fields
    const errors: Record<string, string> = {}
    if (!body.code || typeof body.code !== 'string') errors.code = 'Product code is required'
    if (!body.name || typeof body.name !== 'string') errors.name = 'Product name is required'
    if (!body.slug || typeof body.slug !== 'string') errors.slug = 'Product slug is required'
    if (!body.workspaceUrl || typeof body.workspaceUrl !== 'string') errors.workspaceUrl = 'Workspace URL is required'

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 })
    }

    // Check if code and slug are unique
    const [existingCode, existingSlug] = await Promise.all([
      db.platformProduct.findUnique({ where: { code: body.code as string } }),
      db.platformProduct.findUnique({ where: { slug: body.slug as string } }),
    ])

    if (existingCode) {
      return NextResponse.json(
        { success: false, error: 'Product code already exists' },
        { status: 409 }
      )
    }
    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: 'Product slug already exists' },
        { status: 409 }
      )
    }

    // Create product
    const product = await db.platformProduct.create({
      data: {
        code: body.code as string,
        name: body.name as string,
        slug: body.slug as string,
        description: body.description as string | undefined,
        productType: body.productType as string | undefined,
        workspaceUrl: body.workspaceUrl as string,
        currentVersion: body.currentVersion as string | undefined,
        supportedCoreVersion: body.supportedCoreVersion as string | undefined,
        status: body.status as string | undefined,
        isEnabled: body.isEnabled !== false,
        defaultStorageQuotaMB: typeof body.defaultStorageQuotaMB === 'number'
          ? body.defaultStorageQuotaMB
          : 1048576,
        brandingTemplate: body.brandingTemplate as string | undefined,
        defaultBrandColor: body.defaultBrandColor as string | undefined,
        defaultPlanId: body.defaultPlanId as string | undefined,
        metadata: typeof body.metadata === 'string' ? body.metadata : '{}',
        createdBy: req.user?.id,
      },
    })

    logPlatformEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      module: 'PRODUCTS',
      action: 'CREATE',
      description: `Product created: ${product.name} (${product.code})`,
      newValues: product,
      severity: 'INFO',
      req,
    })

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product'
    return createErrorResponse(message, 500)
  }
})
