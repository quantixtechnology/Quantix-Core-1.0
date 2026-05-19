// ============================================================================
// GET   /api/core/businesses/[businessId]/permissions/[roleId] — Get role perms
// PATCH /api/core/businesses/[businessId]/permissions/[roleId] — Save role perms
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const params = await ctx?.params
      const businessId = params?.businessId as string | undefined
      const roleId     = params?.roleId     as string | undefined
      if (!businessId || !roleId) return createErrorResponse('Missing params', 400)

      const role = await db.businessRole.findUnique({ where: { id: roleId } })
      if (!role || role.businessId !== businessId) return createErrorResponse('Role not found', 404)

      let permissions: Record<string, unknown> = {}
      try { permissions = JSON.parse(role.permissions) } catch { /* ignore */ }

      return NextResponse.json({ success: true, data: { roleId, roleName: role.name, permissions } })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get permissions', 500,
      )
    }
  },
)

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
      permissions: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>
    }
    if (!body.permissions) return createErrorResponse('permissions required', 400)

    const oldPerms = role.permissions
    await db.businessRole.update({
      where: { id: roleId },
      data: { permissions: JSON.stringify(body.permissions) },
    })

    await db.businessAuditLog.create({
      data: {
        businessId,
        actorId: req.user?.id || null,
        actorName: req.user?.name || null,
        action: 'PERMISSIONS_UPDATED',
        entityType: 'BusinessRole',
        entityId: roleId,
        details: JSON.stringify({ roleName: role.name, oldPerms, newPerms: JSON.stringify(body.permissions) }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update permissions', 500,
    )
  }
})
