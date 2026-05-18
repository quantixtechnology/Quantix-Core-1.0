// ============================================================================
// GET  /api/core/businesses/[businessId]/categories — List categories
// POST /api/core/businesses/[businessId]/categories — Create category
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const params = await ctx?.params
      const businessId = params?.businessId as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { searchParams } = new URL(req.url)
      const storeId    = searchParams.get('storeId')    ?? undefined
      const parentId   = searchParams.get('parentId')   ?? undefined
      const isActive   = searchParams.get('isActive')
      const workflowType = searchParams.get('workflowType') ?? undefined

      const where: Record<string, unknown> = { businessId }
      if (storeId)       where.storeId     = storeId
      if (parentId)      where.parentId    = parentId
      if (workflowType)  where.workflowType = workflowType
      if (isActive !== null && isActive !== undefined)
        where.isActive = isActive === 'true'

      const categories = await db.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { products: true, children: true } },
        },
      })

      return NextResponse.json({ success: true, data: categories })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list categories',
        500,
      )
    }
  },
)

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { name, storeId, parentId, description, image, icon, workflowType, sortOrder } = body

    if (!name) return createErrorResponse('name is required', 400)

    const slug = (body.slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)

    const existing = await db.category.findFirst({
      where: { businessId, slug },
    })

    const category = await db.category.create({
      data: {
        businessId,
        storeId:      storeId      ?? null,
        parentId:     parentId     ?? null,
        name,
        slug:         existing ? `${slug}-${Date.now()}` : slug,
        description:  description  ?? null,
        image:        image        ?? null,
        icon:         icon         ?? null,
        workflowType: workflowType ?? 'ECOMMERCE',
        sortOrder:    sortOrder    ?? 0,
        isActive:     true,
      },
    })

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create category',
      500,
    )
  }
})
