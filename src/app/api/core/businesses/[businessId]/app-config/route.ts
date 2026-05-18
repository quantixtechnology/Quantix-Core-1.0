// ============================================================================
// GET /api/core/businesses/[businessId]/app-config — Get app config
// PUT /api/core/businesses/[businessId]/app-config — Upsert app config
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

      const config = await db.appConfig.findUnique({ where: { businessId } })
      if (!config) return NextResponse.json({ success: true, data: null })

      return NextResponse.json({
        success: true,
        data: {
          ...config,
          theme:       JSON.parse(config.theme       || '{}') as Record<string, unknown>,
          social:      JSON.parse(config.social      || '{}') as Record<string, unknown>,
          contactInfo: JSON.parse(config.contactInfo || '{}') as Record<string, unknown>,
          seoConfig:   JSON.parse(config.seoConfig   || '{}') as Record<string, unknown>,
          analytics:   JSON.parse(config.analytics   || '{}') as Record<string, unknown>,
        },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get app config',
        500,
      )
    }
  },
)

export const PUT = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json()

    const config = await db.appConfig.upsert({
      where:  { businessId },
      create: {
        businessId,
        appName:     body.appName     ?? null,
        tagline:     body.tagline     ?? null,
        splashColor: body.splashColor ?? null,
        theme:       body.theme       ? JSON.stringify(body.theme)       : '{}',
        social:      body.social      ? JSON.stringify(body.social)      : '{}',
        contactInfo: body.contactInfo ? JSON.stringify(body.contactInfo) : '{}',
        seoConfig:   body.seoConfig   ? JSON.stringify(body.seoConfig)   : '{}',
        analytics:   body.analytics   ? JSON.stringify(body.analytics)   : '{}',
      },
      update: {
        ...(body.appName     !== undefined && { appName:     body.appName }),
        ...(body.tagline     !== undefined && { tagline:     body.tagline }),
        ...(body.splashColor !== undefined && { splashColor: body.splashColor }),
        ...(body.theme       !== undefined && { theme:       JSON.stringify(body.theme) }),
        ...(body.social      !== undefined && { social:      JSON.stringify(body.social) }),
        ...(body.contactInfo !== undefined && { contactInfo: JSON.stringify(body.contactInfo) }),
        ...(body.seoConfig   !== undefined && { seoConfig:   JSON.stringify(body.seoConfig) }),
        ...(body.analytics   !== undefined && { analytics:   JSON.stringify(body.analytics) }),
      },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update app config',
      500,
    )
  }
})
