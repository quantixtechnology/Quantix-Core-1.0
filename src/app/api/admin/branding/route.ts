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
        // Company contact details (used in quote header when toggles are enabled)
        companyAddress: (row as Record<string, unknown>).companyAddress ?? null,
        companyPhone:   (row as Record<string, unknown>).companyPhone   ?? null,
        companyEmail:   (row as Record<string, unknown>).companyEmail   ?? null,
        companyGst:     (row as Record<string, unknown>).companyGst     ?? null,
        // Legal registration numbers (quote last-page legal section)
        companyPan:     (row as Record<string, unknown>).companyPan     ?? null,
        companyMsme:    (row as Record<string, unknown>).companyMsme    ?? null,
        companyShopEst: (row as Record<string, unknown>).companyShopEst ?? null,
        companyIec:     (row as Record<string, unknown>).companyIec     ?? null,
        companyCin:     (row as Record<string, unknown>).companyCin     ?? null,
        // Zone 6 — Quote / Proposal Settings
        quoteLogoUrl:         (row as Record<string, unknown>).quoteLogoUrl         ?? null,
        quoteAccentColor:     (row as Record<string, unknown>).quoteAccentColor     ?? null,
        quoteFooterText:      (row as Record<string, unknown>).quoteFooterText      ?? null,
        quoteFooterColor:     (row as Record<string, unknown>).quoteFooterColor     ?? null,
        quoteShowPageNumber:  (row as Record<string, unknown>).quoteShowPageNumber  ?? null,
        quoteShowLogo:        (row as Record<string, unknown>).quoteShowLogo        ?? null,
        quoteShowCompanyName: (row as Record<string, unknown>).quoteShowCompanyName ?? null,
        quoteShowAddress:     (row as Record<string, unknown>).quoteShowAddress     ?? null,
        quoteShowPhone:       (row as Record<string, unknown>).quoteShowPhone       ?? null,
        quoteShowEmail:       (row as Record<string, unknown>).quoteShowEmail       ?? null,
        quoteShowWebsite:     (row as Record<string, unknown>).quoteShowWebsite     ?? null,
        quoteShowGST:         (row as Record<string, unknown>).quoteShowGST         ?? null,
        quoteShowPAN:         (row as Record<string, unknown>).quoteShowPAN         ?? null,
        quoteShowMSME:        (row as Record<string, unknown>).quoteShowMSME        ?? null,
        quoteShowShopAct:     (row as Record<string, unknown>).quoteShowShopAct     ?? null,
        quoteShowCIN:         (row as Record<string, unknown>).quoteShowCIN         ?? null,
        quoteShowIEC:         (row as Record<string, unknown>).quoteShowIEC         ?? null,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load branding' }, { status: 500 })
  }
})
