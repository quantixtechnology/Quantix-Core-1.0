// ============================================================================
// GET    /api/core/businesses/[businessId]/workflow-rules — List rules
// POST   /api/core/businesses/[businessId]/workflow-rules — Create rule
// PATCH  /api/core/businesses/[businessId]/workflow-rules — Update rule
// DELETE /api/core/businesses/[businessId]/workflow-rules?id=X — Delete rule
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { searchParams } = new URL(req.url)
      const storeId  = searchParams.get('storeId')  ?? undefined
      const trigger  = searchParams.get('trigger')  ?? undefined
      const isActive = searchParams.get('isActive')

      const where: Record<string, unknown> = { businessId }
      if (storeId)  where.storeId  = storeId
      if (trigger)  where.trigger  = trigger
      if (isActive !== null) where.isActive = isActive === 'true'

      const rules = await db.workflowRule.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      })

      return NextResponse.json({
        success: true,
        data: rules.map(r => ({
          ...r,
          conditions: JSON.parse(r.conditions || '[]') as unknown[],
          actions:    JSON.parse(r.actions    || '[]') as unknown[],
        })),
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list workflow rules',
        500,
      )
    }
  },
)

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { ruleKey, ruleName, trigger, storeId, conditions, actions, priority } = body

    if (!ruleKey || !ruleName || !trigger)
      return createErrorResponse('ruleKey, ruleName, and trigger are required', 400)

    const rule = await db.workflowRule.create({
      data: {
        businessId,
        storeId:    storeId   ?? null,
        ruleKey,
        ruleName,
        trigger,
        conditions: conditions ? JSON.stringify(conditions) : '[]',
        actions:    actions    ? JSON.stringify(actions)    : '[]',
        isActive:   body.isActive ?? true,
        priority:   priority  ?? 0,
      },
    })

    return NextResponse.json({ success: true, data: rule }, { status: 201 })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to create workflow rule',
      500,
    )
  }
})

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { id, ...rest } = body

    if (!id) return createErrorResponse('id is required for update', 400)

    const existing = await db.workflowRule.findFirst({ where: { id, businessId } })
    if (!existing) return createErrorResponse('Workflow rule not found', 404)

    const updated = await db.workflowRule.update({
      where: { id },
      data:  {
        ...(rest.ruleName  !== undefined && { ruleName:   rest.ruleName }),
        ...(rest.trigger   !== undefined && { trigger:    rest.trigger }),
        ...(rest.conditions !== undefined && { conditions: JSON.stringify(rest.conditions) }),
        ...(rest.actions   !== undefined && { actions:    JSON.stringify(rest.actions) }),
        ...(rest.isActive  !== undefined && { isActive:   Boolean(rest.isActive) }),
        ...(rest.priority  !== undefined && { priority:   Number(rest.priority) }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update workflow rule',
      500,
    )
  }
})

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return createErrorResponse('id query param is required', 400)

    const existing = await db.workflowRule.findFirst({ where: { id, businessId } })
    if (!existing) return createErrorResponse('Workflow rule not found', 404)

    await db.workflowRule.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Workflow rule deleted' })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete workflow rule',
      500,
    )
  }
})
