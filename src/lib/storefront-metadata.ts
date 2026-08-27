// ============================================================================
// Tenant branding for link previews (Open Graph / Twitter cards).
//
// A tenant sharing its own website on WhatsApp was getting the Quantix
// Technology logo and strapline, because the ONLY metadata the server emitted
// was the static platform block in app/layout.tsx. A crawler never runs the
// React app, so nothing the client does later can fix it — the tags have to be
// right in the first HTML response.
//
// This resolves the tenant the same way every other host-scoped surface does:
// the Host header → DomainMapping (a customer's own domain) or the storefront
// subdomain slug → one business. No businessId is ever read from the URL, so a
// crafted request cannot select another tenant's branding.
//
// It reuses the branding a tenant has already configured on its Business row —
// name, tagline, description, logo. There is no second branding system.
// ============================================================================
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { resolveTenantFromHostname } from "@/lib/tenant-resolver"
import { resolveImageUrl } from "@/lib/image-url"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

/** Hosts that ARE the platform — these keep the platform's own branding. */
function isPlatformHost(host: string): boolean {
  return host === SF_BASE || host === `www.${SF_BASE}` || host === `app.${SF_BASE}`
}

export interface StorefrontBranding {
  name: string
  description: string
  /** Absolute https URL, or null when the tenant has no logo. */
  image: string | null
  host: string
}

/**
 * Readable label for a business type, used only when a tenant has set neither a
 * tagline nor a description. Still tenant-specific — never platform copy.
 */
function typeLabel(businessType: string | null | undefined): string {
  if (!businessType) return "Online Store"
  return String(businessType)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * The branding for the host being visited, or null when this is the platform's
 * own site (or the host maps to no tenant — in which case the platform metadata
 * is the honest answer, exactly as today).
 */
export async function resolveStorefrontBranding(): Promise<StorefrontBranding | null> {
  const h = await headers()
  const host = (h.get("host") || "").toLowerCase().split(":")[0]
  if (!host || isPlatformHost(host)) return null

  // Custom domain (DomainMapping) first, then the storefront subdomain slug.
  let platformBusinessId = await resolveTenantFromHostname(
    new Request("http://internal", { headers: { host } }),
  ).catch(() => null)

  if (!platformBusinessId && host.endsWith(`.${SF_BASE}`)) {
    const slug = host.slice(0, -(SF_BASE.length + 1))
    // Product hosts (store., delivery., laundry., …) are apps, not storefronts;
    // they carry their own metadata and must not be resolved by slug here.
    if (slug && !slug.includes(".")) {
      const b = await prisma.business.findUnique({ where: { slug }, select: { id: true } }).catch(() => null)
      platformBusinessId = b?.id ?? null
    }
  }
  if (!platformBusinessId) return null

  const b = await prisma.business
    .findUnique({
      where: { id: platformBusinessId },
      select: { name: true, tagline: true, description: true, logo: true, businessType: true },
    })
    .catch(() => null)
  if (!b?.name) return null

  const logo = b.logo ? resolveImageUrl(b.logo) : ""
  // OG images must be absolute and fetchable without a session. resolveImageUrl
  // returns a site-relative /api/core/files/… path for uploads, which is public;
  // the tenant's own host makes it absolute and https.
  const image = logo ? (logo.startsWith("http") ? logo : `https://${host}${logo}`) : null

  return {
    name: b.name,
    description: (b.tagline || b.description || typeLabel(b.businessType)).trim(),
    image,
    host,
  }
}
