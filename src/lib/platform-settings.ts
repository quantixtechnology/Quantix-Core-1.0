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

  logoUrl: string | null
  darkLogoUrl: string | null
  compactLogoUrl: string | null
  faviconUrl: string | null
  emailLogoUrl: string | null
  loginScreenLogoUrl: string | null

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

  // Zone 5 — Invoice Settings
  invoiceLogoUrl: string | null

  // Invoice company identity
  invoiceLegalName: string | null
  invoiceBusinessName: string | null
  invoiceAddress: string | null
  invoiceCity: string | null
  invoiceState: string | null
  invoicePincode: string | null
  invoiceCountry: string
  invoicePhone: string | null
  invoiceEmail: string | null
  invoiceWebsite: string | null

  // Tax & registration numbers (null / empty = hidden on invoices)
  companyPan: string | null
  companyMsme: string | null
  companyShopEst: string | null
  companyIec: string | null
  companyCin: string | null

  // Banking details (shown only on unpaid invoices)
  bankAccountName: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankIfsc: string | null
  bankUpiId: string | null

  // Invoice footer / notes
  invoiceFooterNotes: string | null
  invoiceLegalDisclaimer: string | null
  invoiceDefaultNotes: string | null
}

const DEFAULTS: Omit<PlatformSettingsData, 'id'> = {
  companyName:    'Quantix Technology',
  companyAddress: 'Bangalore, Karnataka, India',
  companyEmail:   'billing@quantixtechnology.in',
  companyPhone:   null,
  companyWebsite: 'https://quantixtechnology.in',
  companyGst:     'APPLIED FOR',

  logoUrl:            null,
  darkLogoUrl:        null,
  compactLogoUrl:     null,
  faviconUrl:         null,
  emailLogoUrl:       null,
  loginScreenLogoUrl: null,

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

  // Zone 5 defaults
  invoiceLogoUrl:         null,
  invoiceLegalName:       null,
  invoiceBusinessName:    null,
  invoiceAddress:         null,
  invoiceCity:            null,
  invoiceState:           null,
  invoicePincode:         null,
  invoiceCountry:         'India',
  invoicePhone:           null,
  invoiceEmail:           null,
  invoiceWebsite:         null,
  companyPan:             null,
  companyMsme:            null,
  companyShopEst:         null,
  companyIec:             null,
  companyCin:             null,
  bankAccountName:        null,
  bankName:               null,
  bankAccountNumber:      null,
  bankIfsc:               null,
  bankUpiId:              null,
  invoiceFooterNotes:     null,
  invoiceLegalDisclaimer: null,
  invoiceDefaultNotes:    null,
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

      logoUrl:            row.logoUrl            ?? null,
      darkLogoUrl:        row.darkLogoUrl        ?? null,
      compactLogoUrl:     row.compactLogoUrl     ?? null,
      faviconUrl:         row.faviconUrl         ?? null,
      emailLogoUrl:       row.emailLogoUrl       ?? null,
      loginScreenLogoUrl: row.loginScreenLogoUrl ?? null,

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

      // Zone 5 — Invoice Settings
      invoiceLogoUrl:         row.invoiceLogoUrl         ?? null,
      invoiceLegalName:       row.invoiceLegalName       ?? null,
      invoiceBusinessName:    row.invoiceBusinessName    ?? null,
      invoiceAddress:         row.invoiceAddress         ?? null,
      invoiceCity:            row.invoiceCity            ?? null,
      invoiceState:           row.invoiceState           ?? null,
      invoicePincode:         row.invoicePincode         ?? null,
      invoiceCountry:         row.invoiceCountry         ?? DEFAULTS.invoiceCountry,
      invoicePhone:           row.invoicePhone           ?? null,
      invoiceEmail:           row.invoiceEmail           ?? null,
      invoiceWebsite:         row.invoiceWebsite         ?? null,
      companyPan:             row.companyPan             ?? null,
      companyMsme:            row.companyMsme            ?? null,
      companyShopEst:         row.companyShopEst         ?? null,
      companyIec:             row.companyIec             ?? null,
      companyCin:             row.companyCin             ?? null,
      bankAccountName:        row.bankAccountName        ?? null,
      bankName:               row.bankName               ?? null,
      bankAccountNumber:      row.bankAccountNumber      ?? null,
      bankIfsc:               row.bankIfsc               ?? null,
      bankUpiId:              row.bankUpiId              ?? null,
      invoiceFooterNotes:     row.invoiceFooterNotes     ?? null,
      invoiceLegalDisclaimer: row.invoiceLegalDisclaimer ?? null,
      invoiceDefaultNotes:    row.invoiceDefaultNotes    ?? null,
    }

    _cache = resolved
    _cacheAt = Date.now()
    return resolved
  } catch {
    return { id: 'singleton', ...DEFAULTS }
  }
}

// Helpers used by invoice renderers -------------------------------------------

/** Absolute logo URL for use in emails. */
export function emailLogoUrl(settings: PlatformSettingsData, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const raw  = settings.emailLogoUrl ?? settings.logoUrl
  if (raw) return raw.startsWith('http') ? raw : `${base}${raw}`
  return `${base}/api/assets/logo`
}

/** Relative logo URL for browser-rendered HTML. */
export function browserLogoUrl(settings: PlatformSettingsData): string {
  return settings.logoUrl ?? '/api/assets/logo'
}

/**
 * Invoice logo URL (priority: invoiceLogoUrl → salesLogoUrl → logoUrl).
 * Returns null if nothing is configured.
 */
export function invoiceLogoUrl(settings: PlatformSettingsData, baseUrl?: string): string | null {
  const raw = settings.invoiceLogoUrl ?? settings.salesLogoUrl ?? settings.logoUrl
  if (!raw) return null
  if (!baseUrl) return raw
  return raw.startsWith('http') ? raw : `${baseUrl}${raw}`
}

/** Invoice company display name (priority: legalName → companyName). */
export function invoiceCompanyName(settings: PlatformSettingsData): string {
  return settings.invoiceLegalName ?? settings.companyName
}

/** Invoice address formatted for display (city + state + pincode). */
export function invoiceFullAddress(settings: PlatformSettingsData): string {
  const parts = [
    settings.invoiceAddress ?? settings.companyAddress,
    [settings.invoiceCity, settings.invoiceState].filter(Boolean).join(', '),
    settings.invoicePincode ? `– ${settings.invoicePincode}` : '',
    settings.invoiceCountry !== 'India' ? settings.invoiceCountry : '',
  ].filter(Boolean)
  return parts.join('\n')
}

/** Invoice contact email (priority: invoiceEmail → companyEmail). */
export function invoiceContactEmail(settings: PlatformSettingsData): string {
  return settings.invoiceEmail ?? settings.companyEmail
}

/** Accent color for billing documents. */
export function salesDocAccentColor(settings: PlatformSettingsData): string {
  return settings.salesAccentColor ?? settings.primaryColor ?? '#10B981'
}

/** @deprecated use invoiceLogoUrl() */
export function salesDocLogoUrl(settings: PlatformSettingsData, baseUrl: string): string | null {
  return invoiceLogoUrl(settings, baseUrl)
}
