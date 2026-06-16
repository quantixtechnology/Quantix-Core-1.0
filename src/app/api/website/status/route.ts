// ============================================================================
// GET /api/website/status?slug=arbazchicken
// Real-time deployment validation: DNS → SSL → Tenant → Storefront
//
// Returns a structured status object for each layer so the Website Management
// UI can show exactly which step is failing.
// Also updates DomainMapping.status in-place if DNS just became resolvable.
// When DNS becomes active, automatically queues SSL provisioning.
// ============================================================================

import { NextResponse } from 'next/server'
import dns from 'dns/promises'
import { db } from '@/lib/db'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'
const VPS_IP          = process.env.VPS_HOST || ''   // Set in .env — the public VPS IP

type DnsStatus      = 'active' | 'pending' | 'error'
type SslStatus      = 'active' | 'pending' | 'provisioning' | 'expired' | 'error' | 'failed'
type TenantStatus   = 'active' | 'draft' | 'maintenance' | 'not_found'
type StorefrontStatus = 'online' | 'offline' | 'unknown'

interface StatusResponse {
  slug:        string
  domain:      string
  dns:         { status: DnsStatus;      resolved: string[]; expected: string; pointsToVps: boolean }
  ssl:         { status: SslStatus;      expiryDate: string | null; httpsReachable: boolean; error: string | null }
  tenant:      { status: TenantStatus;   businessId: string | null; businessName: string | null }
  storefront:  { status: StorefrontStatus; isOnline: boolean }
  deployment:  { status: string; label: string; nextStep: string }
  checkedAt:   string
}

export const GET = withMiddleware({ requireAuth: true })(
  async (req) => {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')?.toLowerCase().trim()
    if (!slug) return createErrorResponse('slug is required', 400)

    const defaultDomain = `${slug}.${STOREFRONT_BASE}`

    // ── 0. Tenant resolution (from DB) — needed first for actual domain ─────
    const business = await db.business.findFirst({
      where: { slug },
      select: {
        id: true, name: true, isOnline: true, status: true, settings: true,
        domain: {
          select: { domain: true, subdomain: true, sslStatus: true, sslExpiryDate: true, sslError: true, status: true },
        },
      },
    })

    console.log("BUSINESS", JSON.stringify(business))
    console.log("DOMAIN_MAPPING", JSON.stringify(business?.domain))

    // Use the canonical domain from DomainMapping if available
    const domain = business?.domain?.domain || defaultDomain
    console.log("DOMAIN_USED", domain)
    console.log("DOMAIN_SOURCE", business?.domain?.domain ? 'DomainMapping' : 'slug-derived')

    const result: StatusResponse = {
      slug,
      domain,
      dns:        { status: 'pending', resolved: [], expected: VPS_IP, pointsToVps: false },
      ssl:        { status: 'pending', expiryDate: null, httpsReachable: false, error: null },
      tenant:     { status: 'not_found', businessId: null, businessName: null },
      storefront: { status: 'unknown', isOnline: false },
      deployment: { status: 'PENDING_DNS', label: 'DNS Pending', nextStep: 'Add wildcard A record for *.quantixtechnology.in to your DNS provider' },
      checkedAt:  new Date().toISOString(),
    }

    if (business) {
      result.tenant.businessId   = business.id
      result.tenant.businessName = business.name
      result.tenant.status       = business.isOnline ? 'active' : business.status === 'SUSPENDED' ? 'not_found' : 'draft'

      let settings: Record<string, unknown> = {}
      try { settings = JSON.parse(business.settings || '{}') } catch { /* ignore */ }
      const storefront = settings.storefront as Record<string, unknown> | undefined
      if (storefront?.websiteStatus === 'maintenance') result.tenant.status = 'maintenance'

      result.storefront.isOnline = business.isOnline
      result.storefront.status   = business.isOnline ? 'online' : 'offline'
    }

    // ── 1. DNS Resolution ──────────────────────────────────────────────────
    try {
      const addresses = await dns.resolve4(domain)
      result.dns.resolved = addresses
      result.dns.status   = 'active'
      result.dns.pointsToVps = VPS_IP ? addresses.includes(VPS_IP) : true
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      result.dns.status = code === 'ENOTFOUND' || code === 'ENODATA' ? 'pending' : 'error'
    }

    // ── 3. SSL Status (from DB record) ─────────────────────────────────────
    const domainRecord = business?.domain
    if (domainRecord) {
      const raw = domainRecord.sslStatus ?? 'pending'
      result.ssl.status     = (raw as SslStatus)
      result.ssl.expiryDate = domainRecord.sslExpiryDate?.toISOString() ?? null
      result.ssl.error      = domainRecord.sslError ?? null
    }

    // ── 4. HTTPS reachability (non-blocking, short timeout) ───────────────
    if (result.dns.status === 'active') {
      try {
        const ctrl = new AbortController()
        const tid  = setTimeout(() => ctrl.abort(), 4000)
        const res  = await fetch(`https://${domain}`, { signal: ctrl.signal, redirect: 'follow' })
        clearTimeout(tid)
        result.ssl.httpsReachable = res.ok || res.status < 500
        if (result.ssl.httpsReachable && result.ssl.status !== 'active') {
          result.ssl.status = 'active'
        }
      } catch {
        // HTTPS not reachable — could be SSL not provisioned yet or port closed
        result.ssl.httpsReachable = false
      }
    }

    // ── 5. Derive composite deployment status ──────────────────────────────
    if (result.dns.status !== 'active') {
      result.deployment = {
        status:   'PENDING_DNS',
        label:    'DNS Pending',
        nextStep: `Add wildcard A record: * → ${VPS_IP || '<VPS_IP>'} for ${STOREFRONT_BASE}. Then run: nslookup ${domain}`,
      }
    } else if (domainRecord?.sslStatus === 'provisioning') {
      result.deployment = {
        status:   'SSL_PENDING',
        label:    'Provisioning SSL...',
        nextStep: `SSL certificate is being provisioned automatically. This takes 1-3 minutes.`,
      }
    } else if (domainRecord?.sslStatus === 'failed') {
      result.deployment = {
        status:   'SSL_FAILED',
        label:    'SSL Failed',
        nextStep: `SSL provisioning failed: ${domainRecord.sslError || 'Unknown error'}. Retrying automatically.`,
      }
    } else if (result.ssl.status !== 'active' && !result.ssl.httpsReachable) {
      result.deployment = {
        status:   'SSL_PENDING',
        label:    'SSL Pending',
        nextStep: `DNS is active. Click "Validate" to trigger SSL provisioning.`,
      }
    } else if (result.tenant.status === 'not_found') {
      result.deployment = {
        status:   'ERROR',
        label:    'Tenant Not Found',
        nextStep: `Business with slug "${slug}" not found in database. Run backfill script or check business creation.`,
      }
    } else if (!result.storefront.isOnline) {
      result.deployment = {
        status:   'SSL_PENDING',
        label:    'SSL Active — Storefront Offline',
        nextStep: 'DNS and SSL are active. Set website status to Active in Website Management.',
      }
    } else {
      result.deployment = {
        status:   'ACTIVE',
        label:    'Fully Live',
        nextStep: '',
      }
    }

    // ── 6. Persist domain status update ───────────────────────────────────
    if (business) {
      try {
        const newDomainStatus = result.deployment.status === 'ACTIVE' ? 'ACTIVE'
          : result.deployment.status === 'SSL_PENDING' ? 'SSL_PENDING'
          : result.deployment.status === 'SSL_FAILED' ? 'ERROR'
          : result.dns.status === 'active'  ? 'SSL_PENDING'
          : 'PENDING_DNS'

        const currentStatus = domainRecord?.status ?? 'PENDING_DNS'

        // Only advance status, never regress (unless DNS disappeared)
        const statusOrder = ['PENDING_DNS', 'DNS_PROPAGATING', 'SSL_PENDING', 'SSL_PENDING', 'ACTIVE']
        const newIdx  = statusOrder.indexOf(newDomainStatus)
        const currIdx = statusOrder.indexOf(currentStatus)

        const shouldUpdate = newIdx > currIdx || result.dns.status !== 'active'

        if (shouldUpdate || !business.domain) {
          const sslStatusValue = result.deployment.status === 'SSL_PENDING' ? 'provisioning'
            : domainRecord?.sslStatus === 'failed' ? 'failed'
            : result.ssl.httpsReachable ? 'active'
            : (domainRecord?.sslStatus ?? 'pending')

          await db.domainMapping.upsert({
            where: { businessId: business.id },
            update: {
              status:    newDomainStatus as 'PENDING_DNS' | 'DNS_PROPAGATING' | 'SSL_PENDING' | 'ACTIVE' | 'ERROR',
              sslStatus: sslStatusValue,
              sslLastCheckedAt: new Date(),
            },
            create: {
              businessId: business.id,
              domain:     domain,
              subdomain:  slug,
              status:     newDomainStatus as 'PENDING_DNS' | 'DNS_PROPAGATING' | 'SSL_PENDING' | 'ACTIVE' | 'ERROR',
              sslStatus:  'pending',
            },
          })
        }
      } catch { /* non-critical — don't fail the request */ }
    }

    return NextResponse.json({ success: true, data: result })
  },
)
