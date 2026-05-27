// ============================================================================
// GET  /api/core/businesses/[businessId]/branding — Get branding config
// PUT  /api/core/businesses/[businessId]/branding — Upsert branding config
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { resolveImageUrl } from '@/lib/image-url'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const branding = await db.businessBranding.findUnique({ where: { businessId } })
      if (!branding) return NextResponse.json({ success: true, data: null })
      return NextResponse.json({
        success: true,
        data: {
          ...branding,
          logo:        resolveImageUrl(branding.logo),
          favicon:     resolveImageUrl(branding.favicon),
          coverImage:  resolveImageUrl(branding.coverImage),
          appIcon:     resolveImageUrl(branding.appIcon),
        },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get branding',
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

    const branding = await db.businessBranding.upsert({
      where:  { businessId },
      create: {
        businessId,
        primaryColor:   body.primaryColor   ?? '#10B981',
        secondaryColor: body.secondaryColor ?? null,
        accentColor:    body.accentColor    ?? null,
        logo:           body.logo           ?? null,
        favicon:        body.favicon        ?? null,
        coverImage:     body.coverImage     ?? null,
        appIcon:        body.appIcon        ?? null,
        fontFamily:     body.fontFamily     ?? null,
        borderRadius:   body.borderRadius   ?? '8',
        darkMode:       body.darkMode       ?? false,
        customCss:      body.customCss      ?? null,
      },
      update: {
        ...(body.primaryColor   !== undefined && { primaryColor:   body.primaryColor }),
        ...(body.secondaryColor !== undefined && { secondaryColor: body.secondaryColor }),
        ...(body.accentColor    !== undefined && { accentColor:    body.accentColor }),
        ...(body.logo           !== undefined && { logo:           body.logo }),
        ...(body.favicon        !== undefined && { favicon:        body.favicon }),
        ...(body.coverImage     !== undefined && { coverImage:     body.coverImage }),
        ...(body.appIcon        !== undefined && { appIcon:        body.appIcon }),
        ...(body.fontFamily     !== undefined && { fontFamily:     body.fontFamily }),
        ...(body.borderRadius   !== undefined && { borderRadius:   body.borderRadius }),
        ...(body.darkMode       !== undefined && { darkMode:       Boolean(body.darkMode) }),
        ...(body.customCss      !== undefined && { customCss:      body.customCss }),
      },
    })

    // Keep Business.logo / Business.favicon in sync so store-context and
    // storefront picks up the latest branding without a separate upload step.
    const bizSync: Record<string, unknown> = {}
    if (body.logo     !== undefined) bizSync.logo    = body.logo    || null
    if (body.favicon  !== undefined) bizSync.favicon = body.favicon || null
    if (Object.keys(bizSync).length > 0) {
      await db.business.update({ where: { id: businessId }, data: bizSync })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...branding,
        logo:       resolveImageUrl(branding.logo),
        favicon:    resolveImageUrl(branding.favicon),
        coverImage: resolveImageUrl(branding.coverImage),
        appIcon:    resolveImageUrl(branding.appIcon),
      },
    })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update branding',
      500,
    )
  }
})
