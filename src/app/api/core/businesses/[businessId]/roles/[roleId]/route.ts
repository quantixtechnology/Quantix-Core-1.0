// ============================================================================
// PATCH /api/core/businesses/[businessId]/roles/[roleId]
// Update role name, description, permissions, or soft-delete
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER'],
})(async (req, ctx?: Ctx) => {
  try {
    const params = await ctx?.params
    const businessId = params?.businessId as string | undefined
    const roleId     = params?.roleId     as string | undefined
    if (!businessId || !roleId) return createErrorResponse('Missing params', 400)

    const role = await db.businessRole.findUnique({ where: { id: roleId } })
    if (!role || role.businessId !== businessId) return createErrorResponse('Role not found', 404)

    const body = await req.json() as {
      name?: string
      description?: string
      permissions?: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>
      isActive?: boolean
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined)        updateData.name        = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description
    if (body.permissions !== undefined) updateData.permissions = JSON.stringify(body.permissions)
    if (body.isActive !== undefined)    updateData.isActive    = body.isActive

    const updated = await db.businessRole.update({ where: { id: roleId }, data: updateData })

    await db.businessAuditLog.create({
      data: {
        businessId,
        actorId: req.user?.id || null,
        actorName: req.user?.name || null,
        action: 'ROLE_UPDATED',
        entityType: 'BusinessRole',
        entityId: roleId,
        details: JSON.stringify({ name: role.name, changes: Object.keys(updateData) }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update role'
    return createErrorResponse(msg, msg.includes('Unique') ? 409 : 500)
  }
})
