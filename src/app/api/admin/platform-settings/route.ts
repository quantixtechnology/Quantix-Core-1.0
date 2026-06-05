// ============================================================================
// GET  /api/admin/platform-settings  — return current settings (auto-init singleton)
// PATCH /api/admin/platform-settings — update one or more fields, bust cache
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { invalidatePlatformSettingsCache } from '@/lib/platform-settings'

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
  // Billing
  'invoicePrefix', 'sacCode',
  'gstRate', 'cgstRate', 'sgstRate',
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
})(async (req: NextRequest) => {
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

    invalidatePlatformSettingsCache()
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save settings'
    return createErrorResponse(message, 500)
  }
})
