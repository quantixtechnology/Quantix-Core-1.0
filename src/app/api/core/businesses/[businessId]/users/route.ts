// ============================================================================
// GET  /api/core/businesses/[businessId]/users — List users with multi-store assignments
// POST /api/core/businesses/[businessId]/users — Create user + assign stores + role
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password-utils'
import type { Role } from '@prisma/client'
type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const businessUsers = await db.businessUser.findMany({
        where: { businessId, role: { not: 'CUSTOMER' } },
        include: {
          user: {
            select: {
              id: true, name: true, email: true, phone: true,
              loginId: true, isActive: true, lastLoginAt: true, createdAt: true,
            },
          },
          businessRole: { select: { id: true, name: true } },
          storeAssignments: {
            include: { store: { select: { id: true, name: true, storeCode: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Resolve creator names
      const creatorIds = [...new Set(businessUsers.map(bu => bu.createdBy).filter(Boolean))] as string[]
      const creators = creatorIds.length
        ? await db.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } })
        : []
      const creatorMap = Object.fromEntries(creators.map(c => [c.id, c.name]))

      return NextResponse.json({
        success: true,
        data: businessUsers.map(bu => ({
          id: bu.id,
          userId: bu.userId,
          role: bu.role,
          businessRoleId: bu.businessRoleId,
          businessRoleName: bu.businessRole?.name ?? null,
          isActive: bu.isActive,
          createdAt: bu.createdAt,
          createdByName: bu.createdBy ? (creatorMap[bu.createdBy] ?? 'Unknown') : 'System',
          user: bu.user,
          stores: bu.storeAssignments.map(sa => sa.store),
        })),
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list users', 500,
      )
    }
  },
)

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json() as {
      name: string
      loginId?: string
      email: string
      phone?: string
      password?: string
      role: string
      businessRoleId?: string
      storeIds?: string[]
      isActive?: boolean
    }

    const { name, email, phone, role, businessRoleId, storeIds = [], isActive = true } = body
    if (!name || !email || !role) {
      return createErrorResponse('name, email and role are required', 400)
    }

    const loginId = body.loginId?.trim() || email
    const rawPassword = body.password?.trim() || `User@${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const passwordHash = await hashPassword(rawPassword)

    // Check loginId uniqueness
    if (loginId !== email) {
      const loginConflict = await db.user.findUnique({ where: { loginId } })
      if (loginConflict) return createErrorResponse('Login ID already taken', 409)
    }

    const actorId = req.user?.id

    const result = await db.$transaction(async (tx) => {
      // Create or reuse User
      let user = await tx.user.findUnique({ where: { email } })
      if (user) {
        // Update password + loginId if creating fresh via this flow
        user = await tx.user.update({
          where: { id: user.id },
          data: { name, phone: phone || user.phone, loginId, passwordHash, isActive: true },
        })
      } else {
        user = await tx.user.create({
          data: {
            email, loginId, name,
            phone: phone || null,
            passwordHash,
            authProvider: 'PASSWORD',
            emailVerified: false,
            isActive: true,
            hasPassword: true,
            mustChangePassword: true, // force change on first login
          },
        })
      }

      // Check BusinessUser doesn't already exist
      const existingBU = await tx.businessUser.findUnique({
        where: { userId_businessId: { userId: user.id, businessId } },
      })
      if (existingBU) throw new Error('User already exists in this business')

      const bu = await tx.businessUser.create({
        data: {
          userId: user.id,
          businessId,
          role: role as Role,
          businessRoleId: businessRoleId || null,
          createdBy: actorId || null,
          isActive: isActive as boolean,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      })

      // Multi-store assignments
      if (storeIds.length > 0) {
        await tx.userStoreAssignment.createMany({
          data: storeIds.map(storeId => ({ businessUserId: bu.id, storeId })),
        })
      }

      // Audit log
      await tx.businessAuditLog.create({
        data: {
          businessId,
          actorId: actorId || null,
          actorName: req.user?.name || null,
          action: 'USER_CREATED',
          entityType: 'BusinessUser',
          entityId: bu.id,
          details: JSON.stringify({ email, role, storeIds }),
        },
      })

      return { user, bu, rawPassword }
    })

    return NextResponse.json({
      success: true,
      data: {
        businessUserId: result.bu.id,
        userId: result.user.id,
        email,
        loginId,
        role,
        storeIds,
        password: result.rawPassword,
      },
    }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create user'
    return createErrorResponse(msg, msg.includes('already exists') ? 409 : 500)
  }
})
