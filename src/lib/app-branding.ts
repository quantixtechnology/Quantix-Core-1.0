// ============================================================================
// Application branding — THE registry of installable apps and their identity.
//
// A website logo and a launcher icon are different assets with different jobs.
// The website header wants a landscape lockup; Android wants a square icon that
// survives being drawn at 48dp next to three siblings. Reusing one for the other
// is what made four installed apps look identical.
//
//   Business
//     ├── Website branding  → landscape logo (see /api/core/website-logo)
//     └── Application branding
//           ├── Customer   → square icon
//           ├── Delivery   → square icon
//           ├── Admin      → square icon
//           └── Store      → square icon
//
// Per-app assets live in BusinessBranding.appLogos, a JSON map keyed by app.
// The business row is the ownership boundary: every lookup here takes a
// businessId or a slug, and there is no global application branding.
// ============================================================================
import { db } from "@/lib/db"

/** Every application a tenant can actually install. */
export const APP_KEYS = ["customer", "delivery", "admin", "store"] as const
export type AppKey = (typeof APP_KEYS)[number]

export interface AppDefinition {
  key: AppKey
  /** Word that leads the installed name: "Delivery Acme Laundry". */
  rolePrefix: string
  /**
   * Launcher label. Android draws short_name and truncates it, so the ROLE
   * alone is the most legible thing to put there — it is the part that tells
   * two installed apps of the same business apart.
   */
  shortLabel: string
  /** Human label on the Mobile Apps screen. */
  label: string
  /** Distinguishing accent for the generated default icon. */
  accent: string
  /** Glyph drawn on the generated default icon — readable at 48dp. */
  glyph: string
  /**
   * Whether the installed app is branded with ONE tenant.
   *
   * Laundry OS is deliberately not: a single installation serves whichever
   * businesses the person signing in is authorized for, so naming it after one
   * of them would be a lie the moment they switch. It keeps product branding.
   */
  tenantBranded: boolean
}

export const APPS: Record<AppKey, AppDefinition> = {
  // The customer app is the business itself — it carries no role prefix,
  // because to a customer there is only one app and it IS the shop.
  customer: { key: "customer", rolePrefix: "",            shortLabel: "",            label: "Customer App", accent: "#0EA5E9", glyph: "C", tenantBranded: true },
  delivery: { key: "delivery", rolePrefix: "Delivery",    shortLabel: "Delivery",    label: "Delivery App", accent: "#F97316", glyph: "D", tenantBranded: true },
  admin:    { key: "admin",    rolePrefix: "Admin",       shortLabel: "Laundry OS",  label: "Admin App",    accent: "#2563EB", glyph: "A", tenantBranded: false },
  store:    { key: "store",    rolePrefix: "Store Admin", shortLabel: "Store Admin", label: "Store App",    accent: "#7C3AED", glyph: "S", tenantBranded: true },
}

export function isAppKey(v: string | null | undefined): v is AppKey {
  return !!v && (APP_KEYS as readonly string[]).includes(v)
}

/**
 * The installed application name.
 *
 * ROLE FIRST: Android draws short_name on the launcher and truncates it, so a
 * business-first label collapses to the same visible prefix for every app.
 * With no business resolved the role stands alone rather than being glued to a
 * placeholder.
 */
export function appDisplayName(app: AppKey, businessName: string | null | undefined): string {
  const def = APPS[app]
  if (!def.tenantBranded) return def.shortLabel || def.rolePrefix
  if (!businessName) return def.rolePrefix || def.shortLabel || "App"
  // The customer app has no prefix: it is the business.
  return def.rolePrefix ? `${def.rolePrefix} ${businessName}` : businessName
}

/**
 * The launcher label.
 *
 * Android truncates short_name, so the role goes here on its own — "Delivery"
 * and "Store Admin" stay readable where "Delivery Acme Laundry Services" would
 * be cut to the same prefix as its siblings. The customer app, having no role,
 * uses the first word of the business name.
 */
export function appShortName(app: AppKey, businessName: string | null | undefined): string {
  const def = APPS[app]
  if (def.shortLabel) return def.shortLabel
  const first = (businessName || "").trim().split(/\s+/)[0]
  return first || "App"
}

/**
 * A cache key for one app's icon, derived from what is configured.
 *
 * Icons are cached hard — a launcher icon that refetches on every page load is
 * waste. But a hard cache with a stable URL means a replaced icon can take a
 * day to appear, and telling a business owner to clear their browser is not an
 * answer. The version changes when, and only when, the configured asset does,
 * so the URL itself becomes new and the old bytes are never consulted.
 *
 * `d` marks the generated default, which changes only when the code does.
 */
export function appIconVersion(appLogo: string | null | undefined): string {
  if (!appLogo) return "d"
  // The stored path carries an upload timestamp and a random suffix, so a short
  // hash of it is unique per asset without exposing the path in the URL.
  let h = 0
  for (let i = 0; i < appLogo.length; i++) h = (Math.imul(31, h) + appLogo.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Per-app logo overrides, stored as JSON on BusinessBranding.appLogos. */
export type AppLogoMap = Partial<Record<AppKey, string>>

export function parseAppLogos(raw: string | null | undefined): AppLogoMap {
  try {
    const parsed = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== "object") return {}
    const out: AppLogoMap = {}
    for (const k of APP_KEYS) {
      const v = (parsed as Record<string, unknown>)[k]
      if (typeof v === "string" && v.trim()) out[k] = v.trim()
    }
    return out
  } catch {
    return {} // malformed JSON is no override, never a crash
  }
}

export interface ResolvedAppBranding {
  businessId: string | null
  businessName: string | null
  primaryColor: string
  /** The app's OWN uploaded icon, when the business has set one. */
  appLogo: string | null
  /** The business's source logo — the migration path for existing tenants. */
  sourceLogo: string | null
  displayName: string
}

/**
 * Resolve one app's branding for one tenant.
 *
 * Order: the app's own uploaded icon, then the business's existing logo, then a
 * generated default. An existing business that has only ever uploaded one logo
 * keeps working and is never asked to re-upload anything.
 */
export async function resolveAppBranding(slug: string, app: AppKey): Promise<ResolvedAppBranding> {
  const empty: ResolvedAppBranding = {
    businessId: null, businessName: null, primaryColor: "#10B981",
    appLogo: null, sourceLogo: null, displayName: APPS[app].rolePrefix,
  }
  try {
    const biz = await db.business.findUnique({
      where: { slug },
      select: {
        id: true, name: true, primaryColor: true, logo: true,
        branding: { select: { appLogos: true, logo: true, primaryColor: true } },
      },
    })
    if (!biz) return empty

    const appLogos = parseAppLogos(biz.branding?.appLogos)
    return {
      businessId: biz.id,
      businessName: biz.name,
      primaryColor: biz.primaryColor || biz.branding?.primaryColor || "#10B981",
      appLogo: appLogos[app] ?? null,
      sourceLogo: biz.logo || biz.branding?.logo || null,
      displayName: appDisplayName(app, biz.name),
    }
  } catch {
    return empty // a branding lookup must never take down a manifest
  }
}
