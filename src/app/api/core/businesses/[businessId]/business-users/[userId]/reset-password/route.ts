// ============================================================================
// POST /api/core/businesses/[businessId]/business-users/[userId]/reset-password
//
// Owner-scoped password reset. A Business Owner (or Super Admin) resets the
// password of a user that belongs to THIS business only. The target user is
// forced to change it on next login (mustChangePassword=true). Managers are not
// permitted (restricted to CLIENT_OWNER / QUANTIX_SUPER_ADMIN).
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { hashPassword, generateTempPassword } from '@/lib/password-utils'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER'],
})(async (req, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const businessId = params?.businessId as string | undefined
    const userId = params?.userId as string | undefined
    if (!businessId || !userId) return createErrorResponse('Missing businessId or userId', 400)

    const requester = (req as unknown as { user?: { id?: string; role?: string; businessId?: string; isPlatformAdmin?: boolean } }).user

    // A non-platform owner may only act within their own business.
    if (!requester?.isPlatformAdmin && requester?.businessId !== businessId) {
      return createErrorResponse('You can only reset users within your own business', 403)
    }

    // The target user must belong to this business.
    const link = await db.businessUser.findFirst({ where: { businessId, userId } })
    if (!link) return createErrorResponse('User does not belong to this business', 404)

    // Owners cannot reset another owner (only Super Admin can).
    if (link.role === 'CLIENT_OWNER' && !requester?.isPlatformAdmin) {
      return createErrorResponse('Owners cannot reset another owner password', 403)
    }

    const body = (await req.json().catch(() => ({}))) as { newPassword?: string }
    const rawPassword = body.newPassword?.trim() || generateTempPassword()
    if (rawPassword.length < 6) return createErrorResponse('Password must be at least 6 characters', 400)

    const passwordHash = await hashPassword(rawPassword)
    await db.user.update({
      where: { id: userId },
      data: { passwordHash, authProvider: 'PASSWORD', hasPassword: true, mustChangePassword: true },
    })

    await db.activityLog.create({
      data: {
        businessId, action: 'business.user_password_reset', entity: 'User', entityId: userId,
        details: JSON.stringify({ resetBy: requester?.id ?? 'unknown' }),
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { userId, temporaryPassword: rawPassword, mustChangePassword: true } })
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Failed to reset password', 500)
  }
})
