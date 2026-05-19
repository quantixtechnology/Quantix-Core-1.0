// ============================================================================
// GET   /api/core/businesses/[businessId]/store-users — List all store users
// POST  /api/core/businesses/[businessId]/store-users — Create store user
// PATCH /api/core/businesses/[businessId]/store-users — Update store user
// DELETE /api/core/businesses/[businessId]/store-users — Deactivate store user
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password-utils'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const user = req.user!
      if (!user.isPlatformAdmin && user.businessId !== businessId) {
        return createErrorResponse('Forbidden', 403)
      }

      const { searchParams } = new URL(req.url)
      const storeId = searchParams.get('storeId') || undefined

      const storeUsers = await db.businessUser.findMany({
        where: {
          businessId,
          storeId: storeId ? storeId : { not: null },
          role: { in: ['STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'DELIVERY_STAFF'] },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          store: {
            select: { id: true, name: true, slug: true, storeCode: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      return NextResponse.json({
        success: true,
        data: storeUsers.map((bu) => ({
          id: bu.id,
          userId: bu.userId,
          role: bu.role,
          storeId: bu.storeId,
          isActive: bu.isActive,
          createdAt: bu.createdAt,
          user: bu.user,
          store: bu.store,
        })),
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list store users',
        500,
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

    const body = await req.json()
    const { storeId, email, name, password, role, phone } = body

    if (!storeId || !email) return createErrorResponse('storeId and email are required', 400)

    const storeRole = role || 'STORE_MANAGER'
    const rawPassword = password || `Store@${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const passwordHash = await hashPassword(rawPassword)

    const storeUser = await db.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        phone: phone || null,
        passwordHash,
        authProvider: 'PASSWORD',
        isActive: true,
      },
    })

    const bu = await db.businessUser.create({
      data: {
        userId: storeUser.id,
        businessId,
        storeId,
        role: storeRole,
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    })

    await db.activityLog.create({
      data: {
        businessId,
        action: 'store.user_created',
        entity: 'BusinessUser',
        entityId: bu.id,
        details: JSON.stringify({ email, role: storeRole, storeId }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: storeUser.id,
        email,
        role: storeRole,
        storeId,
        password: rawPassword,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create store user'
    return createErrorResponse(message, message.includes('Unique') ? 409 : 500)
  }
})

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER'],
})(async (req, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { businessUserId, isActive, role } = body

    if (!businessUserId) return createErrorResponse('businessUserId is required', 400)

    const bu = await db.businessUser.findUnique({ where: { id: businessUserId } })
    if (!bu || bu.businessId !== businessId) return createErrorResponse('User not found', 404)

    const updateData: Record<string, unknown> = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (role !== undefined) updateData.role = role

    const updated = await db.businessUser.update({
      where: { id: businessUserId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update store user',
      500,
    )
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER'],
})(async (req, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const { searchParams } = new URL(req.url)
    const businessUserId = searchParams.get('businessUserId')
    if (!businessUserId) return createErrorResponse('businessUserId query param is required', 400)

    const bu = await db.businessUser.findUnique({ where: { id: businessUserId } })
    if (!bu || bu.businessId !== businessId) return createErrorResponse('User not found', 404)

    await db.businessUser.update({
      where: { id: businessUserId },
      data: { isActive: false },
    })

    await db.activityLog.create({
      data: {
        businessId,
        action: 'store.user_deactivated',
        entity: 'BusinessUser',
        entityId: businessUserId,
        details: JSON.stringify({ storeId: bu.storeId }),
      },
    })

    return NextResponse.json({ success: true, message: 'Store user deactivated' })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to deactivate store user',
      500,
    )
  }
})
