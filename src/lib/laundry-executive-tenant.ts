// White-label tenant resolution for the Executive PWA. The business is inferred
// from the request HOST (dedicated branded deployment per tenant) — the SAME
// strategy the customer app + storefront manifest use. Falls back to the single
// laundry tenant for non-mapped hosts (current single-tenant deployments).
import { prisma } from "@/lib/prisma"
import { resolveTenantFromHostname } from "@/lib/tenant-resolver"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

export interface ExecTenant {
  laundryBusinessId: string
  platformBusinessId: string
  name: string
  logo: string | null
  primaryColor: string
  slug: string | null
}

export async function resolveExecutiveTenant(request: Request): Promise<ExecTenant | null> {
  // 1) Custom-domain mapping (platform businessId), else 2) storefront subdomain.
  let platformBusinessId = await resolveTenantFromHostname(request).catch(() => null)
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0]
  if (!platformBusinessId && host.endsWith(`.${SF_BASE}`)) {
    const slug = host.slice(0, -(SF_BASE.length + 1))
    if (slug) {
      const biz = await prisma.business.findUnique({ where: { slug }, select: { id: true } })
      platformBusinessId = biz?.id ?? null
    }
  }
  // Resolve the laundry business (by platform id, or the single tenant fallback).
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
