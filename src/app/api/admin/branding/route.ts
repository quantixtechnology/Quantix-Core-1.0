// GET /api/admin/branding
//
// Returns platform branding data to all authenticated admin/platform users.
// No `settings:view` permission required — every internal role (Sales, Support,
// Finance, Deployment, HR, etc.) needs logo + theme data to render the sidebar,
// proposal documents, and HRMS print pages. Settings-sensitive data (GST rates,
// invoice prefix, billing config, company address) is NOT exposed here.

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

const SIDEBAR_DEFAULTS = {
  sidebarBg:           '#04132E',
  sidebarActiveColor:  '#2563EB',
  sidebarTextColor:    '#FFFFFF',
  sidebarHeadingColor: '#38BDF8',
}

export const GET = withMiddleware({ requireAuth: true })(async () => {
  try {
    const row = await db.platformSettings.findFirst() ?? {}

    return NextResponse.json({
      success: true,
      data: {
        // Core logos
        logoUrl:        (row as Record<string, unknown>).logoUrl        ?? null,
        sidebarLogoUrl: (row as Record<string, unknown>).sidebarLogoUrl ?? null,
        compactLogoUrl: (row as Record<string, unknown>).compactLogoUrl ?? null,
        // Sidebar theme
        sidebarBg:           (row as Record<string, unknown>).sidebarBg           ?? SIDEBAR_DEFAULTS.sidebarBg,
        sidebarActiveColor:  (row as Record<string, unknown>).sidebarActiveColor  ?? SIDEBAR_DEFAULTS.sidebarActiveColor,
        sidebarTextColor:    (row as Record<string, unknown>).sidebarTextColor    ?? SIDEBAR_DEFAULTS.sidebarTextColor,
        sidebarHeadingColor: (row as Record<string, unknown>).sidebarHeadingColor ?? SIDEBAR_DEFAULTS.sidebarHeadingColor,
        // Sales / proposal documents
        salesLogoUrl:     (row as Record<string, unknown>).salesLogoUrl     ?? null,
        salesAccentColor: (row as Record<string, unknown>).salesAccentColor ?? null,
        // HRMS documents (offer letters, annexures)
        hrmsLogoUrl:          (row as Record<string, unknown>).hrmsLogoUrl          ?? null,
        hrmsAccentColor:      (row as Record<string, unknown>).hrmsAccentColor      ?? null,
        signatoryName:        (row as Record<string, unknown>).signatoryName        ?? null,
        signatoryDesignation: (row as Record<string, unknown>).signatoryDesignation ?? null,
        signatorySignUrl:     (row as Record<string, unknown>).signatorySignUrl     ?? null,
        signatoryStampUrl:    (row as Record<string, unknown>).signatoryStampUrl    ?? null,
        // Company identity (used in proposal + HRMS document headers)
        companyName:    (row as Record<string, unknown>).companyName    ?? 'Quantix Technology',
        companyWebsite: (row as Record<string, unknown>).companyWebsite ?? 'https://quantixtechnology.in',
        primaryColor:   (row as Record<string, unknown>).primaryColor   ?? '#10B981',
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load branding' }, { status: 500 })
  }
})
