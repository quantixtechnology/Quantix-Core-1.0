// White-label tenant resolution for the dedicated laundry PWA hosts. Each
// business gets its OWN per-app subdomain, resolved from the host ALONE:
//   Customer   → <slug>.<base>
//   Executive  → delivery.<slug>.<base>   (and delivery.<customdomain>)
//   Store Admin→ store.<slug>.<base>      (and store.<customdomain>)
// Strip the leading app prefix and resolve the underlying business the SAME way
// the customer site does (domain mapping → subdomain slug). No shared URL, no
// business picker. Reuses the existing tenant pipeline for ALL three apps.
import { prisma } from "@/lib/prisma"
import { resolveTenantFromHostname } from "@/lib/tenant-resolver"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"
export const EXEC_HOST_PREFIX = "delivery."
export const STORE_HOST_PREFIX = "store."

export interface ExecTenant {
  laundryBusinessId: string
  platformBusinessId: string
  name: string
  logo: string | null
  primaryColor: string
  slug: string | null
}

// Strip an app host prefix so the underlying tenant host resolves.
// delivery.freshwash.quantixtechnology.in → freshwash.quantixtechnology.in
export function tenantHostFromExecutiveHost(rawHost: string): string {
  const host = rawHost.toLowerCase().split(":")[0]
  return host.startsWith(EXEC_HOST_PREFIX) ? host.slice(EXEC_HOST_PREFIX.length) : host
}
export function tenantHostFromStoreHost(rawHost: string): string {
  const host = rawHost.toLowerCase().split(":")[0]
  return host.startsWith(STORE_HOST_PREFIX) ? host.slice(STORE_HOST_PREFIX.length) : host
}

// Public per-app URLs for a tenant (used by the Mobile Apps hub + credential sharing).
export function customerUrlForSlug(slug: string): string { return `https://${slug}.${SF_BASE}` }
export function executiveUrlForSlug(slug: string): string { return `https://${EXEC_HOST_PREFIX}${slug}.${SF_BASE}` }
export function storeUrlForSlug(slug: string): string { return `https://${STORE_HOST_PREFIX}${slug}.${SF_BASE}` }

// Shared resolution: a prefix-stripped host → the laundry tenant + branding.
// Both the executive and store resolvers delegate here, so all apps resolve the
// tenant identically (the exact same pipeline the customer site uses).
async function resolveTenantForHost(host: string): Promise<ExecTenant | null> {
  const stripped = new Request("http://internal", { headers: { host } })
  let platformBusinessId = await resolveTenantFromHostname(stripped).catch(() => null)
  if (!platformBusinessId && host.endsWith(`.${SF_BASE}`)) {
    const slug = host.slice(0, -(SF_BASE.length + 1))
    if (slug) {
      const biz = await prisma.business.findUnique({ where: { slug }, select: { id: true } })
      platformBusinessId = biz?.id ?? null
    }
  }
  const lb = platformBusinessId
    ? await prisma.laundryBusiness.findFirst({ where: { platformBusinessId }, select: { id: true, platformBusinessId: true } })
    : await prisma.laundryBusiness.findFirst({ where: { platformBusinessId: { not: null } }, orderBy: { createdAt: "asc" }, select: { id: true, platformBusinessId: true } })
  if (!lb?.platformBusinessId) return null

  const biz = await prisma.business.findUnique({ where: { id: lb.platformBusinessId }, select: { name: true, logo: true, primaryColor: true, slug: true } })
  return {
    laundryBusinessId: lb.id,
    platformBusinessId: lb.platformBusinessId,
    name: biz?.name || "Laundry",
    logo: biz?.logo || null,
    primaryColor: biz?.primaryColor || "#2563EB",
    slug: biz?.slug || null,
  }
}

export async function resolveExecutiveTenant(request: Request): Promise<ExecTenant | null> {
  const rawHost = (request.headers.get("host") || "").toLowerCase().split(":")[0]
  return resolveTenantForHost(tenantHostFromExecutiveHost(rawHost))
}

export async function resolveStoreTenant(request: Request): Promise<ExecTenant | null> {
  const rawHost = (request.headers.get("host") || "").toLowerCase().split(":")[0]
  return resolveTenantForHost(tenantHostFromStoreHost(rawHost))
}
