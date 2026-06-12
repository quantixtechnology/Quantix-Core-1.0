// ============================================================================
// GET  /api/admin/platform-settings  — return current settings (auto-init singleton)
// PATCH /api/admin/platform-settings — update one or more fields, bust cache
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { invalidatePlatformSettingsCache } from '@/lib/platform-settings'
import { logPlatformEvent } from '@/lib/platform-audit'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

// Fields the client is allowed to PATCH
const PATCHABLE = new Set([
  // Company identity
  'companyName', 'companyAddress', 'companyEmail', 'companyPhone',
  'companyWebsite', 'companyGst',
  // Zone 1 — Core Platform
  'tagline',
  'primaryColor', 'secondaryColor', 'accentColor',
  'successColor', 'warningColor', 'infoColor',
  // Zone 2 — Sales Documents
  'salesAccentColor', 'salesFooterText',
  // Zone 3 — HRMS
  'hrmsAccentColor',
  'signatoryName', 'signatoryDesignation',
  // Zone 4 — Sidebar Theme
  'sidebarBg', 'sidebarActiveColor', 'sidebarTextColor', 'sidebarHeadingColor',
  // Billing
  'invoicePrefix', 'sacCode',
  'gstRate', 'cgstRate', 'sgstRate',
  // Zone 5 — Invoice Settings
  'invoiceLegalName', 'invoiceBusinessName',
  'invoiceAddress', 'invoiceCity', 'invoiceState', 'invoicePincode', 'invoiceCountry',
  'invoicePhone', 'invoiceEmail', 'invoiceWebsite',
  'companyPan', 'companyMsme', 'companyShopEst', 'companyIec', 'companyCin',
  'bankAccountName', 'bankName', 'bankAccountNumber', 'bankIfsc', 'bankUpiId',
  'invoiceFooterNotes', 'invoiceLegalDisclaimer', 'invoiceDefaultNotes',
  // Zone 6 — Quote Settings
  'quoteAccentColor', 'quoteFooterText', 'quoteFooterColor', 'quoteShowPageNumber',
  'quoteShowLogo', 'quoteShowCompanyName', 'quoteShowAddress', 'quoteShowPhone',
  'quoteShowEmail', 'quoteShowWebsite',
  'quoteShowGST', 'quoteShowPAN', 'quoteShowMSME', 'quoteShowShopAct', 'quoteShowCIN', 'quoteShowIEC',
])

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'settings:view',
})(async () => {
  try {
    let row = await db.platformSettings.findFirst()
    if (!row) {
      row = await db.platformSettings.create({ data: { id: 'singleton' } })
    }
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings'
    return createErrorResponse(message, 500)
  }
})

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredPermission: 'settings:edit',
})(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json() as Record<string, unknown>

    // Only accept whitelisted fields
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body)) {
      if (PATCHABLE.has(k)) data[k] = v
    }

    const row = await db.platformSettings.upsert({
      where:  { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    })

    logPlatformEvent({
      userId:      req.user?.id,
      userName:    req.user?.name,
      email:       req.user?.email,
      role:        req.user?.role,
      module:      'SETTINGS',
      action:      'UPDATE',
      description: `Platform settings updated (fields: ${Object.keys(data).join(', ')})`,
      newValues:   data,
      severity:    'WARNING',
      req,
    })

    invalidatePlatformSettingsCache()
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save settings'
    return createErrorResponse(message, 500)
  }
})
