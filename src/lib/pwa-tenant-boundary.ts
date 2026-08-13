// ============================================================================
// PWA tenant boundary — the host says WHICH tenant you are trying to enter;
// your account says which tenant you are actually authorized for.
//
// THE BUG THIS FIXES: every tenant PWA resolved its session purely from the
// bearer token — token → executive / store-admin assignment / customer → that
// person's OWN business — and never once compared it with the host. So a
// Laundry Delivery Executive opening delivery.<a-commerce-tenant> had their
// Laundry session accepted and Laundry data rendered under another tenant's
// domain.
//
// The rule, applied at the shared session-resolution layer so no PWA can forget
// it: IF the host resolves to a tenant, the session's business MUST be that
// tenant. A host that resolves to no tenant (localhost, app.<base>, a product
// workspace host) contradicts nothing, so the session's own business governs
// exactly as before — which is what keeps local development and the existing
// workspace flows working.
//
// No new table, role, permission or auth system: this reads the existing
// DomainMapping / Business records and compares ids that already exist.
// ============================================================================

import { prisma } from "@/lib/prisma"

/** PWA sub-prefixes that sit IN FRONT of the tenant host. */
const PWA_HOST_PREFIXES = ["delivery.", "store."] as const

/** Hosts that are the platform or a product workspace — never a tenant. */
function isNonTenantHost(cleanHost: string, base: string): boolean {
  if (!cleanHost) return true
  if (cleanHost === "localhost" || cleanHost.endsWith(".localhost") || /^[\d.]+$/.test(cleanHost)) return true
  if (!base) return true
  if (cleanHost === base || cleanHost === `www.${base}`) return true
  const prefix = cleanHost.endsWith(`.${base}`) ? cleanHost.slice(0, -(base.length + 1)) : null
  // Single-label reserved prefixes: app, admin, laundry, commerce, …
  if (prefix && !prefix.includes(".")) {
    return ["app", "admin", "api", "www", "laundry", "commerce"].includes(prefix)
  }
  return false
}

export interface HostTenant {
  /** Platform Business id the host belongs to. */
  platformBusinessId: string
}

/**
 * The tenant this HOST represents, or null when the host is not a tenant host.
 *
 * Handles the PWA forms — delivery.<tenant>.<base>, store.<tenant>.<base>,
 * delivery.<customdomain> — by stripping the PWA prefix before resolving, and
 * the plain storefront host <tenant>.<base> used by the customer PWA.
 */
export async function resolveHostTenant(
  request: Request | { headers: { get(name: string): string | null } },
): Promise<HostTenant | null> {
  const raw = request.headers.get("x-forwarded-host") || request.headers.get("host") || ""
  if (!raw) return null
  let host = raw.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase()
  const base = (process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in").toLowerCase()

  // Strip the PWA prefix: delivery.<tenant>… / store.<tenant>… → <tenant>…
  for (const p of PWA_HOST_PREFIXES) {
    if (host.startsWith(p)) { host = host.slice(p.length); break }
  }
  if (isNonTenantHost(host, base)) return null

  const subdomain = host.endsWith(`.${base}`) ? host.slice(0, -(base.length + 1)) : null

  // Existing resolution: a mapped domain/subdomain, else the business slug.
  const mapping = await prisma.domainMapping.findFirst({
    where: { OR: [{ domain: host }, ...(subdomain ? [{ subdomain }] : [])] },
    select: { businessId: true },
  })
  if (mapping?.businessId) return { platformBusinessId: mapping.businessId }

  if (subdomain && !subdomain.includes(".")) {
    const biz = await prisma.business.findFirst({ where: { slug: subdomain }, select: { id: true } })
    if (biz) return { platformBusinessId: biz.id }
  }
  // A tenant-shaped host we cannot resolve is treated as "no host tenant"
  // rather than a mismatch: refusing here would lock out a tenant whose domain
  // mapping is still provisioning.
  return null
}

/**
 * Does this session belong to the tenant the host represents?
 *
 * `sessionPlatformBusinessId` must be the PLATFORM Business id — the id every
 * PWA session ultimately hangs off — so Laundry and Commerce compare on the
 * same axis and a product mismatch is caught by the same check.
 */
export async function sessionMatchesHostTenant(
  request: Request | { headers: { get(name: string): string | null } },
  sessionPlatformBusinessId: string | null | undefined,
): Promise<boolean> {
  const hostTenant = await resolveHostTenant(request)
  if (!hostTenant) return true // no tenant host → nothing to contradict
  if (!sessionPlatformBusinessId) return false
  return hostTenant.platformBusinessId === sessionPlatformBusinessId
}

export const TENANT_MISMATCH_MESSAGE = "This account does not belong to this business."
