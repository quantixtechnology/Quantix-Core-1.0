// ============================================================================
// PATCH /api/core/businesses/[businessId]/users/[userId]
// Update user: name, phone, role, stores, status, password reset
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password-utils'
type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const businessId = params?.businessId as string | undefined
    const businessUserId = params?.userId as string | undefined
    if (!businessId || !businessUserId) return createErrorResponse('Missing params', 400)

    const bu = await db.businessUser.findUnique({
      where: { id: businessUserId },
      include: { user: true },
    })
    if (!bu || bu.businessId !== businessId) return createErrorResponse('User not found', 404)

    const body = await req.json() as {
      name?: string
      phone?: string
      loginId?: string
      role?: string
      businessRoleId?: string
      storeIds?: string[]
      isActive?: boolean
      newPassword?: string
    }

    const actorId = req.user?.id

    await db.$transaction(async (tx) => {
      // Update User record
      const userUpdates: Record<string, unknown> = {}
      if (body.name)     userUpdates.name    = body.name
      if (body.phone)    userUpdates.phone   = body.phone
      if (body.loginId)  userUpdates.loginId = body.loginId
      if (body.newPassword) {
        userUpdates.passwordHash = await hashPassword(body.newPassword)
      }
      if (Object.keys(userUpdates).length > 0) {
        await tx.user.update({ where: { id: bu.userId }, data: userUpdates })
      }

      // Update BusinessUser record
      const buUpdates: Record<string, unknown> = {}
      if (body.role !== undefined)           buUpdates.role           = body.role
      if (body.businessRoleId !== undefined) buUpdates.businessRoleId = body.businessRoleId || null
      if (body.isActive !== undefined)       buUpdates.isActive       = body.isActive as boolean
      if (Object.keys(buUpdates).length > 0) {
        await tx.businessUser.update({ where: { id: businessUserId }, data: buUpdates })
      }

      // Replace store assignments
      if (body.storeIds !== undefined) {
        await tx.userStoreAssignment.deleteMany({ where: { businessUserId } })
        if (body.storeIds.length > 0) {
          await tx.userStoreAssignment.createMany({
            data: body.storeIds.map(storeId => ({ businessUserId, storeId })),
          })
        }
      }

      // Audit
      await tx.businessAuditLog.create({
        data: {
          businessId,
          actorId: actorId || null,
          actorName: req.user?.name || null,
          action: body.newPassword ? 'PASSWORD_RESET' : 'USER_UPDATED',
          entityType: 'BusinessUser',
          entityId: businessUserId,
          details: JSON.stringify({
            role: body.role,
            isActive: body.isActive,
            storeIds: body.storeIds,
            passwordReset: !!body.newPassword,
          }),
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update user', 500,
    )
  }
})
