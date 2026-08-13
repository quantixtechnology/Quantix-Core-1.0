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
// THE RULE, applied at the shared session-resolution layer so no PWA can forget
// it. A host is one of three things, and the third is the one that matters:
//
//   names a tenant   → the session's business MUST be that tenant
//   names no tenant  → platform / product workspace / localhost: no constraint,
//                      so local development and the workspace flows are unchanged
//   TENANT-SHAPED but unresolvable → REFUSE
//
// The first version of this file collapsed the last two cases and failed OPEN,
// which is how the production bypass survived it: delivery.ohhmomos.<base> is
// not Ohh Momos (their slug is `ohhhmonos`), so it resolved to nothing, the
// boundary concluded there was nothing to contradict, and a Laundry
// executive's session was accepted. Wildcard DNS meant ANY invented subdomain
// got the same free pass.
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
 * Three states, because "no tenant" and "a tenant I cannot identify" are
 * completely different security answers:
 *
 *   tenant          — the host names a business; the session must match it
 *   non-tenant      — platform, product workspace, localhost: nothing to match
 *   unknown-tenant  — TENANT-SHAPED but resolves to nothing: REJECT
 *
 * The third case is what let a Laundry executive's session load on
 * delivery.ohhmomos.<base>. That host is not Ohh Momos — their slug is
 * `ohhhmonos` — so it matched no DomainMapping and no Business, the resolver
 * answered "no tenant", and the boundary concluded there was nothing to
 * contradict. Wildcard DNS means ANY invented subdomain reached the app and got
 * the same free pass.
 */
export type HostTenantResult =
  | { kind: "tenant"; platformBusinessId: string }
  | { kind: "non-tenant" }
  | { kind: "unknown-tenant"; host: string }

/**
 * The tenant this HOST represents, or null when the host is not a tenant host.
 *
 * Handles the PWA forms — delivery.<tenant>.<base>, store.<tenant>.<base>,
 * delivery.<customdomain> — by stripping the PWA prefix before resolving, and
 * the plain storefront host <tenant>.<base> used by the customer PWA.
 */
export async function classifyHostTenant(
  request: Request | { headers: { get(name: string): string | null } },
): Promise<HostTenantResult> {
  const raw = request.headers.get("x-forwarded-host") || request.headers.get("host") || ""
  if (!raw) return { kind: "non-tenant" }
  let host = raw.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase()
  const base = (process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in").toLowerCase()

  // Strip the PWA prefix: delivery.<tenant>… / store.<tenant>… → <tenant>…
  // A PWA prefix means the host is unambiguously addressing ONE tenant.
  let hadPwaPrefix = false
  for (const p of PWA_HOST_PREFIXES) {
    if (host.startsWith(p)) { host = host.slice(p.length); hadPwaPrefix = true; break }
  }
  if (isNonTenantHost(host, base)) return { kind: "non-tenant" }

  const subdomain = host.endsWith(`.${base}`) ? host.slice(0, -(base.length + 1)) : null

  // Existing resolution: a mapped domain/subdomain, else the business slug.
  const mapping = await prisma.domainMapping.findFirst({
    where: { OR: [{ domain: host }, ...(subdomain ? [{ subdomain }] : [])] },
    select: { businessId: true },
  })
  if (mapping?.businessId) return { kind: "tenant", platformBusinessId: mapping.businessId }

  if (subdomain && !subdomain.includes(".")) {
    const biz = await prisma.business.findFirst({ where: { slug: subdomain }, select: { id: true } })
    if (biz) return { kind: "tenant", platformBusinessId: biz.id }
  }

  // TENANT-SHAPED BUT UNRESOLVABLE → fail CLOSED.
  //
  // A delivery./store. prefix, or a single-label subdomain of the base domain,
  // is addressing a specific tenant. If we cannot say which one, we must not
  // hand the caller their own tenant's data instead. Wildcard DNS puts every
  // invented subdomain in this bucket, and this is the bucket the production
  // bypass lived in.
  if (hadPwaPrefix || (subdomain && !subdomain.includes("."))) {
    return { kind: "unknown-tenant", host }
  }

  // An unmapped host that is NOT under the base domain (an unforeseen
  // deployment or preview hostname) is not addressing a tenant at all.
  return { kind: "non-tenant" }
}

/** Back-compat: the resolved tenant, or null for every other case. */
export async function resolveHostTenant(
  request: Request | { headers: { get(name: string): string | null } },
): Promise<HostTenant | null> {
  const r = await classifyHostTenant(request)
  return r.kind === "tenant" ? { platformBusinessId: r.platformBusinessId } : null
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
  const host = await classifyHostTenant(request)
  // Platform / product workspace / localhost: nothing to contradict.
  if (host.kind === "non-tenant") return true
  // Tenant-shaped but unidentifiable: refuse rather than fall back to the
  // caller's own tenant.
  if (host.kind === "unknown-tenant") return false
  if (!sessionPlatformBusinessId) return false
  return host.platformBusinessId === sessionPlatformBusinessId
}

export const TENANT_MISMATCH_MESSAGE = "This account does not belong to this business."
