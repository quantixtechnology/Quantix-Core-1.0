// ============================================================================
// GET    /api/core/businesses/[businessId]/categories — List categories
// POST   /api/core/businesses/[businessId]/categories — Create category
// PATCH  /api/core/businesses/[businessId]/categories — Update category (id in body)
// DELETE /api/core/businesses/[businessId]/categories?id=xxx — Delete category
//
// workflowType is ALWAYS derived from the business's enabledWorkflows (stored in
// Business.settings by Super Admin at provisioning). The client cannot override it:
//   • 1 enabled workflow  → auto-assigned, client value ignored
//   • 2+ enabled workflows → client value validated against allowed set, defaults to first
// ============================================================================

import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { ensureDir } from '@/lib/upload-root'
import type { NextRequest } from 'next/server'

const CAT_IMG_MAX = 2 * 1024 * 1024
const CAT_IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function uploadCategoryImage(file: File, businessId: string): Promise<string> {
  if (!CAT_IMG_TYPES.has(file.type)) throw new Error('Only JPEG, PNG, and WebP are allowed')
  if (file.size > CAT_IMG_MAX)       throw new Error('Image must be under 2 MB')
  const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const dir      = await ensureDir(join('categories', businessId))
  await writeFile(join(dir, safeName), Buffer.from(await file.arrayBuffer()))
  return `/uploads/categories/${businessId}/${safeName}`
}

// Parses POST/PATCH body from either multipart/form-data OR application/json.
// Returns a plain object of category fields.
async function parseBody(req: NextRequest) {
  const ct = req.headers.get('content-type') || ''
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    const imageEntry = fd.get('image')
    return {
      id:           (fd.get('id')           as string) || undefined,
      name:         (fd.get('name')         as string) || undefined,
      slug:         (fd.get('slug')         as string) || undefined,
      description:  (fd.get('description')  as string) || undefined,
      icon:         (fd.get('icon')         as string) || undefined,
      color:        (fd.get('color')        as string) || undefined,
      sortOrder:    fd.get('sortOrder') != null ? Number(fd.get('sortOrder')) : undefined,
      isActive:     fd.get('isActive') !== 'false',
      workflowType: (fd.get('workflowType') as string) || undefined,
      // imageFile: new File to upload; imageUrl: existing URL or '' to clear
      imageFile: imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null,
      imageUrl:  imageEntry instanceof File ? undefined : ((imageEntry as string) ?? undefined),
    }
  }
  const body = await req.json()
  return {
    id:           body.id,
    name:         body.name,
    slug:         body.slug,
    description:  body.description,
    icon:         body.icon,
    color:        body.color,
    sortOrder:    body.sortOrder,
    isActive:     body.isActive,
    workflowType: body.workflowType,
    imageFile:    null,
    imageUrl:     body.image,  // may be string | null | undefined
  }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const ALL_WORKFLOWS = new Set(['ECOMMERCE', 'PICKUP_DELIVERY', 'APPOINTMENT', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'])
const BUSINESS_TYPE_DEFAULT_WORKFLOWS: Record<string, string[]> = {
  GROCERY:       ['ECOMMERCE', 'PICKUP_DELIVERY'],
  ECOMMERCE:     ['ECOMMERCE'],
  FOOD_DELIVERY: ['ECOMMERCE', 'PICKUP_DELIVERY'],
  LAUNDRY:       ['ECOMMERCE', 'PICKUP_DELIVERY', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'],
  CAR_WASH:      ['ECOMMERCE', 'APPOINTMENT', 'SUBSCRIPTION', 'POST_SERVICE_BILLING'],
  PHARMACY:      ['ECOMMERCE', 'PICKUP_DELIVERY'],
  HOME_SERVICES: ['APPOINTMENT', 'POST_SERVICE_BILLING'],
  MEAT_DELIVERY: ['ECOMMERCE', 'PICKUP_DELIVERY'],
  COSMETICS:     ['ECOMMERCE'],
  FURNITURE:     ['ECOMMERCE'],
  DIRECTORY:     ['ECOMMERCE'],
}

async function getBusinessEnabledWorkflows(businessId: string): Promise<string[]> {
  const biz = await db.business.findUnique({
    where: { id: businessId },
    select: {
      settings: true,
      businessType: true,
      businessSubscription: { select: { plan: { select: { tier: true } } } },
    },
  })
  if (!biz) return ['ECOMMERCE']

  const planTier = biz.businessSubscription?.plan?.tier ?? 'STANDARD'
  if (planTier === 'STANDARD') return ['ECOMMERCE']

  const settings = JSON.parse(biz.settings || '{}') as Record<string, unknown>
  const fromSettings = settings.enabledWorkflows
  if (Array.isArray(fromSettings) && fromSettings.length > 0) {
    const filtered = (fromSettings as string[]).filter(w => ALL_WORKFLOWS.has(w))
    if (filtered.length > 0) return filtered
  }
  return BUSINESS_TYPE_DEFAULT_WORKFLOWS[biz.businessType] ?? ['ECOMMERCE']
}

function resolveWorkflowType(enabledWorkflows: string[], requested?: string | null): string {
  if (enabledWorkflows.length === 1) return enabledWorkflows[0]
  if (requested && enabledWorkflows.includes(requested)) return requested
  return enabledWorkflows[0]
}

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const params = await ctx?.params
      const businessId = params?.businessId as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { searchParams } = new URL(req.url)
      const storeId      = searchParams.get('storeId')      ?? undefined
      const parentId     = searchParams.get('parentId')     ?? undefined
      const isActive     = searchParams.get('isActive')
      const workflowType = searchParams.get('workflowType') ?? undefined

      const where: Record<string, unknown> = { businessId }
      if (storeId)       where.storeId      = storeId
      if (parentId)      where.parentId     = parentId
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

    const parsed = await parseBody(req)
    const { name, description, icon, color, sortOrder, isActive } = parsed

    if (!name) return createErrorResponse('name is required', 400)

    // Resolve image URL — upload file if provided, else use URL string
    let image: string | null = parsed.imageUrl ?? null
    if (parsed.imageFile) {
      image = await uploadCategoryImage(parsed.imageFile, businessId)
    }

    const enabledWorkflows = await getBusinessEnabledWorkflows(businessId)
    const workflowType = resolveWorkflowType(enabledWorkflows, parsed.workflowType ?? null)

    const slug = (parsed.slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)

    const existing = await db.category.findFirst({ where: { businessId, slug } })

    const category = await db.category.create({
      data: {
        businessId,
        name,
        slug:         existing ? `${slug}-${Date.now()}` : slug,
        description:  description  || null,
        image:        image        || null,
        icon:         icon         || null,
        color:        color        || null,
        workflowType: workflowType as import('@prisma/client').WorkflowType,
        sortOrder:    sortOrder    ?? 0,
        isActive:     isActive     !== false,
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

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const parsed = await parseBody(req)
    const { name, description, icon, color, sortOrder, isActive } = parsed
    const id = parsed.id

    if (!id) return createErrorResponse('id is required', 400)

    const existing = await db.category.findFirst({ where: { id, businessId } })
    if (!existing) return createErrorResponse('Category not found', 404)

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      updateData.name = name
      if (!parsed.slug) {
        const newSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 80)
        const slugConflict = await db.category.findFirst({
          where: { businessId, slug: newSlug, id: { not: id } },
        })
        updateData.slug = slugConflict ? `${newSlug}-${Date.now()}` : newSlug
      }
    }
    if (parsed.slug !== undefined)   updateData.slug        = parsed.slug
    if (description !== undefined)   updateData.description = description || null
    if (icon !== undefined)          updateData.icon        = icon        || null
    if (color !== undefined)         updateData.color       = color       || null
    if (sortOrder !== undefined)     updateData.sortOrder   = sortOrder
    if (isActive !== undefined)      updateData.isActive    = isActive

    // Image: upload new file, keep existing URL, or clear
    if (parsed.imageFile) {
      updateData.image = await uploadCategoryImage(parsed.imageFile, businessId)
    } else if (parsed.imageUrl !== undefined) {
      updateData.image = parsed.imageUrl || null
    }

    if (parsed.workflowType !== undefined) {
      const enabledWorkflows = await getBusinessEnabledWorkflows(businessId)
      updateData.workflowType = resolveWorkflowType(enabledWorkflows, parsed.workflowType ?? null)
    }

    const updated = await db.category.update({ where: { id }, data: updateData })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update category',
      500,
    )
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return createErrorResponse('id query param is required', 400)

    const existing = await db.category.findFirst({ where: { id, businessId } })
    if (!existing) return createErrorResponse('Category not found', 404)

    await db.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
    await db.category.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Category deleted' })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete category',
      500,
    )
  }
})
