// ============================================================================
// GET  /api/core/businesses/[businessId]/business-users — List business users
// POST /api/core/businesses/[businessId]/business-users — Create business user
// PATCH /api/core/businesses/[businessId]/business-users — Update user status/role
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

      const users = await db.businessUser.findMany({
        where: { businessId },
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
        data: users.map((bu) => ({
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
        error instanceof Error ? error.message : 'Failed to list business users',
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
    const { email, name, password, role, storeId, phone } = body

    if (!email || !role) return createErrorResponse('email and role are required', 400)

    const rawPassword = password || `User@${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const passwordHash = await hashPassword(rawPassword)

    const newUser = await db.user.create({
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
        userId: newUser.id,
        businessId,
        storeId: storeId || null,
        role,
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    })

    await db.activityLog.create({
      data: {
        businessId,
        action: 'business.user_created',
        entity: 'BusinessUser',
        entityId: bu.id,
        details: JSON.stringify({ email, role, storeId: storeId || null }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: newUser.id,
        email,
        role,
        storeId: storeId || null,
        password: rawPassword,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create business user'
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
      error instanceof Error ? error.message : 'Failed to update business user',
      500,
    )
  }
})
