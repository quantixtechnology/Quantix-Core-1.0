// ============================================================================
// Product Workspace Hosts — canonical, edge-safe, registry-aligned.
//
// Each Quantix product is served on its own permanent subdomain
// (commerce.quantixtechnology.in, laundry.quantixtechnology.in, …) — distinct
// from app.quantixtechnology.in (the Platform) and from tenant storefront
// subdomains (<slug>.quantixtechnology.in).
//
// WHY a separate module from ProductRuntimeRegistry:
//   The proxy (src/proxy.ts) runs on the Edge runtime and CANNOT touch the DB,
//   so it cannot read ProductRuntimeRegistry (Prisma) at request time. This
//   module is the small, edge-safe projection of the registry's product-host
//   config. The registry remains the source of truth for deployment metadata
//   (workspaceUrl, deploymentMode, status); this module only answers the one
//   edge question: "is <prefix>.<base> a product host, and which product?"
//
// SCALABILITY (add a product with NO routing-code change):
//   The product subdomain prefix equals the lowercased product code by
//   convention (COMMERCE -> commerce, RESTAURANT -> restaurant). The active
//   prefix set is the union of:
//     1. DEFAULT_PRODUCT_HOST_PREFIXES (the products shipped in-tree), and
//     2. NEXT_PUBLIC_PRODUCT_HOST_PREFIXES — a comma-separated env list that is
//        regenerated from the Product Registry at deploy time.
//   So a new product (restaurant, pharmacy, …) goes live by: registering it in
//   the Product Registry, adding its prefix to that env var, and shipping its
//   /<product> route tree — without editing proxy.ts or this file's logic.
// ============================================================================

import { getWorkspaceEntryRoute } from './workspace-routes'

// Hostnames reserved by the platform itself (never products, never tenant slugs).
// `delivery` and `store` are the dedicated laundry PWA host prefixes — reserving
// them prevents a tenant slug from colliding with an app subdomain.
const PLATFORM_RESERVED_PREFIXES = ['www', 'app', 'admin', 'api', 'mail', 'delivery', 'store'] as const

// Products shipped in this repository. Prefix === lowercased product code.
const DEFAULT_PRODUCT_HOST_PREFIXES = ['commerce', 'laundry'] as const

// App routes that are shared across every host (auth/account flows). On a
// product host these must pass through untouched — never be treated as a
// businessId and rewritten to the workspace entry route.
export const SHARED_HOST_PATHS = ['/reset-password', '/change-password', '/delete-account'] as const

function parsePrefixEnv(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

// Frozen, de-duplicated set of active product subdomain prefixes.
const PRODUCT_HOST_PREFIXES: ReadonlySet<string> = new Set<string>([
  ...DEFAULT_PRODUCT_HOST_PREFIXES,
  ...parsePrefixEnv(process.env.NEXT_PUBLIC_PRODUCT_HOST_PREFIXES),
])

/** All active product subdomain prefixes (lowercase). */
export function getProductHostPrefixes(): string[] {
  return [...PRODUCT_HOST_PREFIXES]
}

function hostPrefix(hostWithoutPort: string, base: string): string | null {
  if (hostWithoutPort === base) return null
  if (!hostWithoutPort.endsWith(`.${base}`)) return null
  const prefix = hostWithoutPort.slice(0, -(base.length + 1))
  // Only a single-label prefix is a workspace/storefront host (foo, not a.b).
  if (!prefix || prefix.includes('.')) return null
  return prefix
}

/**
 * If `hostWithoutPort` is a product workspace host under `base`, return its
 * product code (UPPERCASE); otherwise null.
 *   getProductCodeForHost('commerce.quantixtechnology.in', 'quantixtechnology.in') -> 'COMMERCE'
 *   getProductCodeForHost('arbazfreshmeat.quantixtechnology.in', …)                -> null
 */
export function getProductCodeForHost(hostWithoutPort: string, base: string): string | null {
  const prefix = hostPrefix(hostWithoutPort, base)
  if (!prefix || !PRODUCT_HOST_PREFIXES.has(prefix)) return null
  return prefix.toUpperCase()
}

/** Real in-app workspace entry route for a product code (registry/convention driven). */
export function getProductEntryRoute(productCode: string): string {
  return getWorkspaceEntryRoute(productCode)
}

/** Whether a bare subdomain prefix is reserved (platform or product) — never a tenant slug. */
export function isReservedHostPrefix(prefix: string): boolean {
  const p = prefix.toLowerCase()
  return (PLATFORM_RESERVED_PREFIXES as readonly string[]).includes(p) || PRODUCT_HOST_PREFIXES.has(p)
}

/** All reserved prefixes (platform + products) — used to reject tenant slug collisions. */
export function getReservedHostPrefixes(): string[] {
  return [...PLATFORM_RESERVED_PREFIXES, ...PRODUCT_HOST_PREFIXES]
}
