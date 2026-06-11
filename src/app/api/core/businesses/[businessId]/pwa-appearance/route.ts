// ============================================================================
// GET  /api/core/businesses/[businessId]/pwa-appearance
// PUT  /api/core/businesses/[businessId]/pwa-appearance
//
// Reads/writes pwaAppearance inside Business.settings.ecommerceConfig.
// No Prisma migration needed — Business.settings is an existing JSON column.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import {
  type PwaAppearance,
  PWA_APPEARANCE_DEFAULTS,
} from '@/lib/pwa-appearance'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

function parseSettings(raw: string | null): Record<string, unknown> {
  try { return JSON.parse(raw || '{}') as Record<string, unknown> }
  catch { return {} }
}

function extractPwaAppearance(settings: Record<string, unknown>): PwaAppearance {
  const eco = (settings.ecommerceConfig as Record<string, unknown>) ?? {}
  const saved = (eco.pwaAppearance as Partial<PwaAppearance>) ?? {}
  return {
    headerTheme:      saved.headerTheme      ?? PWA_APPEARANCE_DEFAULTS.headerTheme,
    categoryStyle:    saved.categoryStyle    ?? PWA_APPEARANCE_DEFAULTS.categoryStyle,
    productCardStyle: saved.productCardStyle ?? PWA_APPEARANCE_DEFAULTS.productCardStyle,
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const biz = await db.business.findUnique({
        where:  { id: businessId },
        select: { settings: true },
      })
      if (!biz) return createErrorResponse('Business not found', 404)

      const settings      = parseSettings(biz.settings)
      const pwaAppearance = extractPwaAppearance(settings)
      return NextResponse.json({ success: true, data: pwaAppearance })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get PWA appearance',
        500,
      )
    }
  },
)

// ── PUT ───────────────────────────────────────────────────────────────────────

export const PUT = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = (await req.json()) as Partial<PwaAppearance>

    const biz = await db.business.findUnique({
      where:  { id: businessId },
      select: { settings: true },
    })
    if (!biz) return createErrorResponse('Business not found', 404)

    const settings = parseSettings(biz.settings)
    const eco      = (settings.ecommerceConfig as Record<string, unknown>) ?? {}
    const current  = (eco.pwaAppearance as Partial<PwaAppearance>) ?? {}

    const updated: PwaAppearance = {
      headerTheme:      body.headerTheme      ?? current.headerTheme      ?? PWA_APPEARANCE_DEFAULTS.headerTheme,
      categoryStyle:    body.categoryStyle    ?? current.categoryStyle    ?? PWA_APPEARANCE_DEFAULTS.categoryStyle,
      productCardStyle: body.productCardStyle ?? current.productCardStyle ?? PWA_APPEARANCE_DEFAULTS.productCardStyle,
    }

    const newSettings = {
      ...settings,
      ecommerceConfig: { ...eco, pwaAppearance: updated },
    }

    await db.business.update({
      where: { id: businessId },
      data:  { settings: JSON.stringify(newSettings) },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update PWA appearance',
      500,
    )
  }
})
