// ============================================================================
// What an APK for one tenant is made of.
//
// Everything the Android build needs — where the app opens, what it is called,
// what it is called by Android, which icon it wears — derived from the tenant's
// own Mobile Apps configuration. Nothing here knows any business by name, and
// nothing here guesses.
//
// The guessing is the point. The builder used to compose its own hosts as
// <slug>.<base>, which is right only for tenants who never brought a domain of
// their own. A tenant on their own domain got an APK pointing at a hostname
// with no certificate on it: the app installed, opened, and failed on the first
// request. The canonical host is the one the platform already publishes — the
// same one the PWA manifest, the storefront and the certificate all use — so
// that is what is read.
//
// Pure: no I/O. The caller supplies the business row; this decides what it
// means for the build.
// ============================================================================
import { APPS, appDisplayName, type AppKey } from "@/lib/app-branding"

/** The apps that are packaged. Laundry OS is the platform's own workspace. */
export const PACKAGED_APPS = ["customer", "delivery", "store"] as const
export type PackagedApp = (typeof PACKAGED_APPS)[number]

/** Which Android flavour each app builds as — only scanners declare CAMERA. */
const FLAVOUR: Record<PackagedApp, "viewer" | "scanner"> = {
  customer: "viewer",   // never scans
  delivery: "scanner",  // bag QR at the doorstep
  store: "scanner",     // garment and bag QR at the counter
}

/** Host prefix per app, matching how the platform provisions and certifies them. */
const HOST_PREFIX: Record<PackagedApp, string> = {
  customer: "",
  delivery: "delivery.",
  store: "store.",
}

export interface ApkAppConfig {
  key: PackagedApp
  /** The hostname the APK opens — canonical, never composed. */
  host: string
  url: string
  /** Launcher label. Same rule the PWA manifest uses, so they cannot disagree. */
  label: string
  packageId: string
  flavour: "viewer" | "scanner"
  /** The tenant's configured icon for THIS app. */
  iconPath: string
}

/**
 * A valid, deterministic, collision-safe Android application id.
 *
 * Android package segments must be Java-ish identifiers, so a slug is reduced
 * to letters and digits and may not start with a digit. Deterministic because a
 * rebuild must produce an id that upgrades the installed app rather than
 * sitting beside it, and distinct per app so a tenant's three apps coexist on
 * one phone — and distinct per tenant so two businesses do too.
 */
export function androidPackageId(slug: string, app: PackagedApp): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9]/g, "")
  const segment = /^[0-9]/.test(safe) || safe === "" ? `t${safe}` : safe
  return `in.quantixtechnology.laundry.${app}.${segment}`
}

/**
 * The canonical customer-facing host for a tenant.
 *
 * A mapped domain wins: it is what has the certificate and what the customer
 * types. The slug host is the fallback for tenants who have not brought one.
 */
export function canonicalHost(
  business: { slug?: string | null; domain?: { domain?: string | null } | null },
  storefrontBase: string,
): string | null {
  const mapped = business.domain?.domain?.trim()
  if (mapped) return mapped.toLowerCase()
  return business.slug ? `${business.slug}.${storefrontBase}`.toLowerCase() : null
}

/** The full build configuration for one tenant's three apps. */
export function apkBuildConfig(
  business: { slug?: string | null; name?: string | null; domain?: { domain?: string | null } | null },
  storefrontBase: string,
  iconVersions: Partial<Record<AppKey, string>> = {},
): { slug: string; businessName: string; apps: ApkAppConfig[] } | null {
  const host = canonicalHost(business, storefrontBase)
  const slug = business.slug?.trim()
  if (!host || !slug) return null

  return {
    slug,
    businessName: business.name ?? slug,
    apps: PACKAGED_APPS.map((key) => {
      const appHost = `${HOST_PREFIX[key]}${host}`
      const v = iconVersions[key as AppKey] || "d"
      return {
        key,
        host: appHost,
        url: `https://${appHost}/`,
        // Exactly what the installed PWA calls itself, from the same helper —
        // an APK and a home-screen shortcut for one app must not disagree.
        label: appDisplayName(key as AppKey, business.name ?? null) || APPS[key as AppKey].label,
        packageId: androidPackageId(slug, key),
        flavour: FLAVOUR[key],
        iconPath: `/api/core/app-icon/${slug}/${key}/192.png?v=${v}`,
      }
    }),
  }
}
