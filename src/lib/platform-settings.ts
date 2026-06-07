// ============================================================================
// Platform Settings Service
//
// Single source of truth for all configurable platform branding / billing.
// Always call getPlatformSettings() — never query PlatformSettings directly.
//
// Design:
//   • One DB record (id = "singleton"), auto-created on first read.
//   • Module-level 60-second cache; cleared by invalidatePlatformSettingsCache()
//     whenever settings are saved via the admin API.
//   • All fields fall back to sensible defaults, honouring legacy env vars
//     (PLATFORM_SELLER_NAME / PLATFORM_SELLER_ADDRESS / PLATFORM_SELLER_GST)
//     so existing deployments work without running db push first.
// ============================================================================

import { db } from '@/lib/db'

export interface PlatformSettingsData {
  id: string

  companyName: string
  companyAddress: string
  companyEmail: string
  companyPhone: string | null
  companyWebsite: string | null
  companyGst: string

  logoUrl: string | null       // /uploads/platform/shared/xxx.png  (null → static fallback)
  darkLogoUrl: string | null
  compactLogoUrl: string | null
  faviconUrl: string | null
  emailLogoUrl: string | null

  primaryColor: string
  secondaryColor: string | null
  accentColor: string | null

  // Zone 2 — Sales Documents
  salesLogoUrl: string | null
  salesAccentColor: string | null

  // Zone 4 — Sidebar Theme
  sidebarBg: string
  sidebarActiveColor: string
  sidebarTextColor: string
  sidebarHeadingColor: string
  sidebarLogoUrl: string | null

  invoicePrefix: string
  sacCode: string

  gstRate: number
  cgstRate: number
  sgstRate: number
}

const DEFAULTS: Omit<PlatformSettingsData, 'id'> = {
  companyName:    'Quantix Technology',
  companyAddress: 'Bangalore, Karnataka, India',
  companyEmail:   'billing@quantixtechnology.in',
  companyPhone:   null,
  companyWebsite: 'https://quantixtechnology.in',
  companyGst:     'APPLIED FOR',

  logoUrl:        null,
  darkLogoUrl:    null,
  compactLogoUrl: null,
  faviconUrl:     null,
  emailLogoUrl:   null,

  primaryColor:   '#10B981',
  secondaryColor: null,
  accentColor:    null,

  salesLogoUrl:      null,
  salesAccentColor:  null,

  sidebarBg:           '#04132E',
  sidebarActiveColor:  '#2563EB',
  sidebarTextColor:    '#FFFFFF',
  sidebarHeadingColor: '#38BDF8',
  sidebarLogoUrl:      null,

  invoicePrefix: 'QTX',
  sacCode:       '998314',

  gstRate:  18,
  cgstRate: 9,
  sgstRate: 9,
}

let _cache: PlatformSettingsData | null = null
let _cacheAt = 0
const TTL = 60_000

export function invalidatePlatformSettingsCache(): void {
  _cache = null
  _cacheAt = 0
}

export async function getPlatformSettings(): Promise<PlatformSettingsData> {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache

  try {
    let row = await db.platformSettings.findFirst()
    if (!row) {
      row = await db.platformSettings.create({ data: { id: 'singleton' } })
    }

    const resolved: PlatformSettingsData = {
      id: row.id,
      companyName:    row.companyName    ?? process.env.PLATFORM_SELLER_NAME    ?? DEFAULTS.companyName,
      companyAddress: row.companyAddress ?? process.env.PLATFORM_SELLER_ADDRESS ?? DEFAULTS.companyAddress,
      companyEmail:   row.companyEmail   ?? DEFAULTS.companyEmail,
      companyPhone:   row.companyPhone   ?? null,
      companyWebsite: row.companyWebsite ?? DEFAULTS.companyWebsite,
      companyGst:     row.companyGst     ?? process.env.PLATFORM_SELLER_GST     ?? DEFAULTS.companyGst,

      logoUrl:        row.logoUrl        ?? null,
      darkLogoUrl:    row.darkLogoUrl    ?? null,
      compactLogoUrl: row.compactLogoUrl ?? null,
      faviconUrl:     row.faviconUrl     ?? null,
      emailLogoUrl:   row.emailLogoUrl   ?? null,

      primaryColor:   row.primaryColor   ?? DEFAULTS.primaryColor,
      secondaryColor: row.secondaryColor ?? null,
      accentColor:    row.accentColor    ?? null,

      salesLogoUrl:     row.salesLogoUrl     ?? null,
      salesAccentColor: row.salesAccentColor ?? null,

      sidebarBg:           row.sidebarBg           ?? DEFAULTS.sidebarBg,
      sidebarActiveColor:  row.sidebarActiveColor  ?? DEFAULTS.sidebarActiveColor,
      sidebarTextColor:    row.sidebarTextColor     ?? DEFAULTS.sidebarTextColor,
      sidebarHeadingColor: row.sidebarHeadingColor ?? DEFAULTS.sidebarHeadingColor,
      sidebarLogoUrl:      row.sidebarLogoUrl      ?? null,

      invoicePrefix: row.invoicePrefix ?? DEFAULTS.invoicePrefix,
      sacCode:       row.sacCode       ?? DEFAULTS.sacCode,

      gstRate:  row.gstRate  ?? DEFAULTS.gstRate,
      cgstRate: row.cgstRate ?? DEFAULTS.cgstRate,
      sgstRate: row.sgstRate ?? DEFAULTS.sgstRate,
    }

    _cache = resolved
    _cacheAt = Date.now()
    return resolved
  } catch {
    // Table not yet migrated — return defaults so existing code keeps working
    return { id: 'singleton', ...DEFAULTS }
  }
}

// Helpers used by invoice renderers -------------------------------------------

/** Absolute logo URL for use in emails (where relative paths don't work). */
export function emailLogoUrl(settings: PlatformSettingsData, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const raw  = settings.emailLogoUrl ?? settings.logoUrl
  if (raw) return raw.startsWith('http') ? raw : `${base}${raw}`
  return `${base}/api/assets/logo`
}

/** Relative logo URL for browser-rendered HTML (invoice download / proposals). */
export function browserLogoUrl(settings: PlatformSettingsData): string {
  return settings.logoUrl ?? '/api/assets/logo'
}

/**
 * Absolute logo URL for sales documents (proposals, invoices).
 * Priority: salesLogoUrl → logoUrl. Returns null when no logo is configured
 * so callers can render a text fallback instead of a broken image.
 */
export function salesDocLogoUrl(settings: PlatformSettingsData, baseUrl: string): string | null {
  const raw = settings.salesLogoUrl ?? settings.logoUrl
  if (!raw) return null
  return raw.startsWith('http') ? raw : `${baseUrl}${raw}`
}

/** Brand accent color for sales documents (invoices, proposals). */
export function salesDocAccentColor(settings: PlatformSettingsData): string {
  return settings.salesAccentColor ?? settings.primaryColor ?? '#10B981'
}
