// ============================================================================
// GET  /api/core/businesses/[businessId]/tax-settings — Read tax toggles + GSTIN
// PATCH /api/core/businesses/[businessId]/tax-settings — Persist tax toggles
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

interface TaxSettings {
  gstEnabled: boolean
  hsnEnabled: boolean
  inclusivePricing: boolean
  autoTaxCalculation: boolean
  categoryTaxMap: Record<string, { gstRate: number; hsnCode: string }>
}

const DEFAULT_TAX_SETTINGS: TaxSettings = {
  gstEnabled: true,
  hsnEnabled: false,
  inclusivePricing: false,
  autoTaxCalculation: true,
  categoryTaxMap: {},
}

function parseTaxSettings(settingsJson: string): TaxSettings {
  try {
    const parsed = JSON.parse(settingsJson)
    return { ...DEFAULT_TAX_SETTINGS, ...(parsed.taxSettings ?? {}) }
  } catch {
    return DEFAULT_TAX_SETTINGS
  }
}

export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, gstNumber: true, state: true, settings: true },
      })
      if (!business) return createErrorResponse('Business not found', 404)

      const taxSettings = parseTaxSettings(business.settings ?? '{}')

      return NextResponse.json({
        success: true,
        data: {
          businessName: business.name,
          gstNumber: business.gstNumber ?? null,
          state: business.state ?? null,
          taxSettings,
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to get tax settings', 500)
    }
  },
)

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'CLIENT_OWNER'],
})(async (req, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    })
    if (!business) return createErrorResponse('Business not found', 404)

    const body = await req.json() as Partial<TaxSettings>

    const current = parseTaxSettings(business.settings ?? '{}')
    const merged: TaxSettings = {
      ...current,
      ...(body.gstEnabled !== undefined && { gstEnabled: body.gstEnabled }),
      ...(body.hsnEnabled !== undefined && { hsnEnabled: body.hsnEnabled }),
      ...(body.inclusivePricing !== undefined && { inclusivePricing: body.inclusivePricing }),
      ...(body.autoTaxCalculation !== undefined && { autoTaxCalculation: body.autoTaxCalculation }),
      ...(body.categoryTaxMap !== undefined && { categoryTaxMap: body.categoryTaxMap }),
    }

    let existingSettings: Record<string, unknown> = {}
    try { existingSettings = JSON.parse(business.settings ?? '{}') } catch { /* ignore */ }

    await db.business.update({
      where: { id: businessId },
      data: { settings: JSON.stringify({ ...existingSettings, taxSettings: merged }) },
    })

    return NextResponse.json({ success: true, data: merged })
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Failed to update tax settings', 500)
  }
})
