// Branding cache — module-level, lives for the browser session.
//
// Avoids re-fetching and re-converting the logo on every proposal render.
// TTL is intentionally short (5 min) so Brand Studio changes propagate quickly.
//
// logoDataUrl: the logo converted to a base64 data URL so it embeds directly
// in the proposal print HTML — no second network round-trip from the print
// window, which is the main cause of blank logos in PDFs.

export interface QuoteBrandingSettings {
  // Company contact fields (from companyX in PlatformSettings)
  companyAddress: string | null
  companyPhone:   string | null
  companyEmail:   string | null
  // Legal registration numbers
  companyGst:     string | null
  companyPan:     string | null
  companyMsme:    string | null
  companyShopEst: string | null
  companyIec:     string | null
  companyCin:     string | null
  // Footer config
  footerText:     string | null
  footerColor:    string | null
  showPageNumber: boolean
  // Header visibility
  showLogo:        boolean
  showCompanyName: boolean
  showAddress:     boolean
  showPhone:       boolean
  showEmail:       boolean
  showWebsite:     boolean
  // Last page legal visibility
  showGST:     boolean
  showPAN:     boolean
  showMSME:    boolean
  showShopAct: boolean
  showCIN:     boolean
  showIEC:     boolean
}

export const DEFAULT_QUOTE_SETTINGS: QuoteBrandingSettings = {
  companyAddress: null, companyPhone: null, companyEmail: null,
  companyGst: null, companyPan: null, companyMsme: null,
  companyShopEst: null, companyIec: null, companyCin: null,
  footerText: null, footerColor: null,
  showPageNumber: true,
  showLogo: true, showCompanyName: true,
  showAddress: false, showPhone: false, showEmail: false, showWebsite: true,
  showGST: true, showPAN: true, showMSME: true,
  showShopAct: true, showCIN: true, showIEC: true,
}

export interface CachedBranding {
  logoUrl:        string | null
  logoDataUrl:    string | null  // base64 — safe to embed in outerHTML for printing
  companyName:    string
  companyWebsite: string
  accentColor:    string
  cachedAt:       number
  quote?:         QuoteBrandingSettings  // undefined on old cached entries — use DEFAULT_QUOTE_SETTINGS
}

const TTL = 5 * 60 * 1000  // 5 minutes

let _cache: CachedBranding | null = null

export function getCachedBranding(): CachedBranding | null {
  if (!_cache) return null
  if (Date.now() - _cache.cachedAt > TTL) { _cache = null; return null }
  return _cache
}

export function setCachedBranding(b: Omit<CachedBranding, 'cachedAt'>): void {
  _cache = { ...b, cachedAt: Date.now() }
}

export function clearBrandingCache(): void {
  _cache = null
}

/** Fetch an image URL and return a base64 data URL, or null on any failure. */
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
