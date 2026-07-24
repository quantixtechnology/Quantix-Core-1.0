// Unified tenant-app provisioning for laundry. A laundry business has THREE public
// apps — the Customer site (<domain>), the Executive PWA (delivery.<domain>) and
// the Store Admin PWA (store.<domain>). All are provisioned by the SAME engine
// (provisionProductHost → nginx vhost + Let's Encrypt), never a separate
// infrastructure step. Customer + Executive SSL status is persisted on the
// existing DomainMapping row; the Store host reports status via live HTTPS
// reachability (no schema change). Idempotent (reuses an existing vhost/cert).
import { prisma } from "@/lib/prisma"
import { provisionProductHost } from "@/lib/product-host-provisioner"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

async function resolveDomains(platformBusinessId: string): Promise<{ customer: string; executive: string; store: string } | null> {
  const b = await prisma.business.findUnique({ where: { id: platformBusinessId }, select: { slug: true, domain: { select: { domain: true } } } })
  const customer = b?.domain?.domain || (b?.slug ? `${b.slug}.${SF_BASE}` : null)
  if (!customer) return null
  return { customer, executive: `delivery.${customer}`, store: `store.${customer}` }
}

const sslLabel = (r: "issued" | "existing" | "failed") => (r === "failed" ? "failed" : "active")

// Provision BOTH hosts via the shared engine and persist status.
export async function provisionTenantApps(platformBusinessId: string) {
  const d = await resolveDomains(platformBusinessId)
  if (!d) return { ok: false as const, error: "Business has no slug or mapped domain" }

  await prisma.domainMapping.updateMany({ where: { businessId: platformBusinessId }, data: { executiveSslStatus: "provisioning", storeSslStatus: "provisioning" } }).catch(() => {})
  // All three hosts through the SAME engine — identical vhost + server_names_hash
  // fix + certbot + HSTS. Provisioned SEQUENTIALLY, never in parallel: certbot
  // holds a global lock and manipulates nginx config for its http-01 challenge,
  // so concurrent runs step on each other and some hosts fail to get a cert
  // (observed: customer+delivery issued, store left without a :443 vhost → served
  // another tenant's default cert → CN mismatch). Serial issuance is the fix.
  const cust = await provisionProductHost(d.customer)
  const exec = await provisionProductHost(d.executive)
  const store = await provisionProductHost(d.store)

  await prisma.domainMapping.updateMany({
    where: { businessId: platformBusinessId },
    data: {
      sslStatus: sslLabel(cust.ssl), sslError: cust.error, sslLastCheckedAt: new Date(),
      ...(cust.expiryDate ? { sslExpiryDate: new Date(cust.expiryDate) } : {}),
      executiveSslStatus: sslLabel(exec.ssl), executiveSslError: exec.error, executiveSslLastCheckedAt: new Date(),
      ...(exec.expiryDate ? { executiveSslExpiryDate: new Date(exec.expiryDate) } : {}),
      storeSslStatus: sslLabel(store.ssl), storeSslError: store.error, storeSslLastCheckedAt: new Date(),
      ...(store.expiryDate ? { storeSslExpiryDate: new Date(store.expiryDate) } : {}),
    },
  }).catch(() => {})

  return { ok: true as const, customer: cust, executive: exec, store }
}

async function httpsReachable(host: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    // A failed/mismatched TLS cert makes fetch throw → not reachable over HTTPS.
    await fetch(`https://${host}/api/health/readiness`, { method: "GET", redirect: "manual", signal: ctrl.signal })
    clearTimeout(t)
    return true
  } catch { return false }
}

export interface TenantAppStatus {
  customer: { url: string; sslStatus: string; httpsReachable: boolean }
  executive: { url: string; sslStatus: string; httpsReachable: boolean }
  store: { url: string; sslStatus: string; httpsReachable: boolean }
}

export async function getTenantAppStatus(platformBusinessId: string): Promise<TenantAppStatus | null> {
  const d = await resolveDomains(platformBusinessId)
  if (!d) return null
  const dm = await prisma.domainMapping.findUnique({ where: { businessId: platformBusinessId }, select: { sslStatus: true, executiveSslStatus: true, storeSslStatus: true } })
  const [custHttps, execHttps, storeHttps] = await Promise.all([httpsReachable(d.customer), httpsReachable(d.executive), httpsReachable(d.store)])
  return {
    customer: { url: `https://${d.customer}`, sslStatus: dm?.sslStatus ?? "pending", httpsReachable: custHttps },
    executive: { url: `https://${d.executive}`, sslStatus: dm?.executiveSslStatus ?? "pending", httpsReachable: execHttps },
    store: { url: `https://${d.store}`, sslStatus: dm?.storeSslStatus ?? "pending", httpsReachable: storeHttps },
  }
}
