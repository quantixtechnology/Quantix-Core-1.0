// ============================================================================
// GET  /api/core/businesses/[businessId]/roles — List roles (seeds defaults if empty)
// POST /api/core/businesses/[businessId]/roles — Create custom role
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

type ModulePerms = { view: boolean; create: boolean; edit: boolean; delete: boolean }
type PermMatrix = Record<string, ModulePerms>

const BLANK: ModulePerms = { view: false, create: false, edit: false, delete: false }

function makeMatrix(overrides: Record<string, Partial<ModulePerms>>): PermMatrix {
  const MODULES = [
    'dashboard', 'orders', 'products', 'inventory', 'delivery_zones', 'stores',
    'customers', 'categories', 'product_import', 'customer_import', 'tax',
    'payment_gateways', 'reports', 'settings', 'pos', 'user_creation', 'user_management',
  ]
  return Object.fromEntries(
    MODULES.map(m => [m, { ...BLANK, ...(overrides[m] ?? {}) }])
  )
}

const SYSTEM_DEFAULTS: Record<string, PermMatrix> = {
  'Store Manager': makeMatrix({
    dashboard: { view: true }, orders: { view: true, create: true, edit: true },
    products: { view: true, create: true, edit: true },
    inventory: { view: true, create: true, edit: true },
    delivery_zones: { view: true }, stores: { view: true },
    customers: { view: true, create: true, edit: true },
    categories: { view: true, create: true, edit: true },
    product_import: { view: true, create: true },
    customer_import: { view: true, create: true },
    tax: { view: true }, reports: { view: true },
    pos: { view: true, create: true, edit: true },
  }),
  'Store Operator': makeMatrix({
    dashboard: { view: true }, orders: { view: true, create: true, edit: true },
    products: { view: true }, inventory: { view: true, create: true, edit: true },
    customers: { view: true, create: true, edit: true },
    categories: { view: true }, reports: { view: true },
    pos: { view: true, create: true, edit: true },
  }),
  'POS User': makeMatrix({
    dashboard: { view: true }, orders: { view: true, create: true },
    products: { view: true }, customers: { view: true, create: true },
    categories: { view: true }, pos: { view: true, create: true, edit: true },
  }),
  'Inventory User': makeMatrix({
    dashboard: { view: true }, orders: { view: true, edit: true },
    products: { view: true, create: true, edit: true },
    inventory: { view: true, create: true, edit: true },
    customers: { view: true, create: true, edit: true },
    categories: { view: true },
    product_import: { view: true, create: true }, reports: { view: true },
  }),
  'Delivery Manager': makeMatrix({
    dashboard: { view: true }, orders: { view: true, edit: true },
    delivery_zones: { view: true, create: true, edit: true },
    stores: { view: true }, customers: { view: true }, reports: { view: true },
  }),
  'Delivery Agent': makeMatrix({
    orders: { view: true },
  }),
  'Customer Support': makeMatrix({
    dashboard: { view: true }, orders: { view: true, edit: true },
    products: { view: true },
    customers: { view: true, create: true, edit: true },
    customer_import: { view: true, create: true }, reports: { view: true },
  }),
}

async function seedDefaultRoles(businessId: string, creatorId?: string) {
  for (const [name, perms] of Object.entries(SYSTEM_DEFAULTS)) {
    await db.businessRole.upsert({
      where: { businessId_name: { businessId, name } },
      create: {
        businessId, name, isSystem: true, isActive: true,
        createdBy: creatorId || null,
        permissions: JSON.stringify(perms),
      },
      update: {},
    })
  }
}

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const count = await db.businessRole.count({ where: { businessId } })
      if (count === 0) await seedDefaultRoles(businessId, req.user?.id)

      const roles = await db.businessRole.findMany({
        where: { businessId, isActive: true },
        include: { _count: { select: { users: true } } },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      })

      return NextResponse.json({
        success: true,
        data: roles.map(r => ({
          id: r.id, name: r.name, description: r.description,
          permissions: (() => { try { return JSON.parse(r.permissions) } catch { return {} } })(),
          isSystem: r.isSystem, isActive: r.isActive,
          userCount: r._count.users, createdAt: r.createdAt,
        })),
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list roles', 500,
      )
    }
  },
)

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER'],
})(async (req, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json() as { name: string; description?: string; permissions?: PermMatrix }
    if (!body.name?.trim()) return createErrorResponse('Role name is required', 400)

    const role = await db.businessRole.create({
      data: {
        businessId,
        name: body.name.trim(),
        description: body.description || null,
        permissions: JSON.stringify(body.permissions ?? makeMatrix({})),
        isSystem: false,
        isActive: true,
        createdBy: req.user?.id || null,
      },
    })

    await db.businessAuditLog.create({
      data: {
        businessId,
        actorId: req.user?.id || null,
        actorName: req.user?.name || null,
        action: 'ROLE_CREATED',
        entityType: 'BusinessRole',
        entityId: role.id,
        details: JSON.stringify({ name: role.name }),
      },
    })

    return NextResponse.json({ success: true, data: role }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create role'
    return createErrorResponse(msg, msg.includes('Unique') ? 409 : 500)
  }
})
