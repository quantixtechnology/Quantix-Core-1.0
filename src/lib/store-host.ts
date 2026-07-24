// Product-aware resolution for the shared Store Admin host (store.<tenant>). The
// proxy runs on the edge and cannot query the DB, so it rewrites every store.<*>
// host to /store; THIS resolver (Node) reads the Host header, resolves the
// underlying business, and reports its productCode + branding so /store can render
// the correct workspace's Store Admin app (Laundry or Commerce) — one host, one
// tenant pipeline, no duplicate routing.
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { resolveTenantFromHostname } from "@/lib/tenant-resolver"
import { resolveImageUrl } from "@/lib/image-url"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"
const STORE_PREFIX = "store."

export interface StoreHostTenant {
  platformBusinessId: string
  productCode: string | null // "COMMERCE" | "LAUNDRY" | …
  name: string
  logo: string | null
  primaryColor: string
  slug: string | null
}

export async function resolveStoreHostTenant(): Promise<StoreHostTenant | null> {
  const h = await headers()
  const rawHost = (h.get("host") || "").toLowerCase().split(":")[0]
  const host = rawHost.startsWith(STORE_PREFIX) ? rawHost.slice(STORE_PREFIX.length) : rawHost

  // Custom-domain mapping first, then the tenant subdomain slug.
  let platformBusinessId = await resolveTenantFromHostname(new Request("http://internal", { headers: { host } })).catch(() => null)
  if (!platformBusinessId && host.endsWith(`.${SF_BASE}`)) {
    const slug = host.slice(0, -(SF_BASE.length + 1))
    if (slug) { const b = await prisma.business.findUnique({ where: { slug }, select: { id: true } }); platformBusinessId = b?.id ?? null }
  }
  if (!platformBusinessId) return null

  const b = await prisma.business.findUnique({ where: { id: platformBusinessId }, select: { productCode: true, name: true, logo: true, primaryColor: true, slug: true } })
  if (!b) return null
  return {
    platformBusinessId,
    productCode: b.productCode,
    name: b.name,
    logo: b.logo ? resolveImageUrl(b.logo) : null,
    primaryColor: b.primaryColor,
    slug: b.slug,
  }
}
