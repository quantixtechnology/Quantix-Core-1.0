// ============================================================================
// GET   /api/core/businesses/[businessId]/feature-flags — List all flags
// PATCH /api/core/businesses/[businessId]/feature-flags — Upsert a flag
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

      const flags = await db.featureFlag.findMany({
        where: { businessId },
        orderBy: { key: 'asc' },
      })

      return NextResponse.json({
        success: true,
        data: flags,
        map: Object.fromEntries(flags.map(f => [f.key, f.enabled])),
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to list feature flags',
        500,
      )
    }
  },
)

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()
    const { key, enabled, value } = body

    if (!key || enabled === undefined)
      return createErrorResponse('key and enabled are required', 400)

    const flag = await db.featureFlag.upsert({
      where:  { businessId_key: { businessId, key } },
      create: { businessId, key, enabled: Boolean(enabled), value: value ? JSON.stringify(value) : '{}' },
      update: {
        enabled: Boolean(enabled),
        ...(value !== undefined && { value: JSON.stringify(value) }),
      },
    })

    return NextResponse.json({ success: true, data: flag })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update feature flag',
      500,
    )
  }
})
