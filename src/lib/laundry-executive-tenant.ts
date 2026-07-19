// White-label tenant resolution for the dedicated Executive PWA host. Each
// business gets its OWN executive subdomain: delivery.<slug>.<base> (and, with a
// custom domain, delivery.<customdomain>). The tenant is inferred from the host
// ALONE — strip the leading `delivery.` and resolve the underlying business the
// SAME way the customer site does (domain mapping → subdomain slug). No shared
// executive URL, no business picker. Reuses the existing tenant pipeline.
import { prisma } from "@/lib/prisma"
import { resolveTenantFromHostname } from "@/lib/tenant-resolver"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"
export const EXEC_HOST_PREFIX = "delivery."

export interface ExecTenant {
  laundryBusinessId: string
  platformBusinessId: string
  name: string
  logo: string | null
  primaryColor: string
  slug: string | null
}

// Strip the executive host prefix so the underlying tenant host resolves.
// delivery.freshwash.quantixtechnology.in → freshwash.quantixtechnology.in
// delivery.freshwash.com                  → freshwash.com
export function tenantHostFromExecutiveHost(rawHost: string): string {
  const host = rawHost.toLowerCase().split(":")[0]
  return host.startsWith(EXEC_HOST_PREFIX) ? host.slice(EXEC_HOST_PREFIX.length) : host
}

// Public URLs for a tenant (used by the Mobile Apps hub + credential sharing).
export function customerUrlForSlug(slug: string): string { return `https://${slug}.${SF_BASE}` }
export function executiveUrlForSlug(slug: string): string { return `https://${EXEC_HOST_PREFIX}${slug}.${SF_BASE}` }

export async function resolveExecutiveTenant(request: Request): Promise<ExecTenant | null> {
  const rawHost = (request.headers.get("host") || "").toLowerCase().split(":")[0]
  const host = tenantHostFromExecutiveHost(rawHost)

  // 1) Custom-domain mapping / subdomain via the shared resolver (using the
  //    prefix-stripped host), else 2) storefront subdomain slug, else 3) the
  //    single-tenant fallback for non-mapped hosts (e.g. localhost / dev).
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
