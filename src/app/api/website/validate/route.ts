// ============================================================================
// POST /api/website/validate — Full deployment validation.
//
// Synchronous flow:
//   1. Check DNS → if not active, return early
//   2. Verify nginx + certbot installed on server
//   3. Update DB: sslStatus = "provisioning"
//   4. Generate nginx config if missing
//   5. Run certbot --nginx (blocks 30-60s)
//   6. Reload nginx
//   7. Verify HTTPS reachable
//   8. Update DB: sslStatus = "active" (or "failed" with error)
//   9. Return full validation result
// ============================================================================

import { NextResponse } from 'next/server'
import dns from 'dns/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from '@/lib/db'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'

const execAsync = promisify(exec)
const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'
const VPS_IP = process.env.VPS_HOST || ''
const SSL_EMAIL = process.env.SSL_EMAIL || 'ssl@quantixtechnology.in'
const NGINX_DIR = '/etc/nginx/sites-available'
const NGINX_ENABLED_DIR = '/etc/nginx/sites-enabled'

async function shell(cmd: string, timeout = 120_000): Promise<string> {
  const { stdout } = await execAsync(cmd, { timeout, encoding: 'utf-8' })
  return stdout.trim()
}

async function shellSafe(cmd: string, timeout = 120_000): Promise<string> {
  try { return await shell(cmd, timeout) } catch { return '' }
}

async function verifyPrerequisites(): Promise<string | null> {
  const nginx = await shellSafe('which nginx 2>/dev/null || echo "MISSING"')
  if (nginx === 'MISSING' || !nginx) return 'nginx is not installed on this server'

  const certbot = await shellSafe('which certbot 2>/dev/null || echo "MISSING"')
  if (certbot === 'MISSING' || !certbot) return 'certbot is not installed on this server'

  return null
}

function nginxTemplate(domain: string): string {
  return [
    'server {',
    '    listen 80;',
    `    server_name ${domain} www.${domain};`,
    '',
    '    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
    '',
    '    location / {',
    '        proxy_pass http://localhost:3000;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection \'upgrade\';',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Forwarded-For $remote_addr;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '        proxy_cache_bypass $http_upgrade;',
    '    }',
    '}',
  ].join('\n')
}

async function ensureNginxConfig(domain: string): Promise<void> {
  const confPath = `${NGINX_DIR}/${domain}.conf`
  const enabledPath = `${NGINX_ENABLED_DIR}/${domain}.conf`

  await shell(`sudo mkdir -p ${NGINX_DIR} ${NGINX_ENABLED_DIR}`)

  const exists = await shellSafe(`sudo test -f ${confPath} && echo "EXISTS"`)
  if (exists !== 'EXISTS') {
    const conf = nginxTemplate(domain)
    await shell(`sudo tee ${confPath} > /dev/null << 'NGINX_EOF'\n${conf}\nNGINX_EOF`)
  }

  const linked = await shellSafe(`sudo test -L ${enabledPath} && echo "LINKED"`)
  if (linked !== 'LINKED') {
    await shell(`sudo ln -sf ${confPath} ${enabledPath}`)
  }

  const valid = await shellSafe('sudo nginx -t 2>&1')
  if (!valid.includes('syntax is ok')) {
    throw new Error(`nginx config invalid:\n${valid}`)
  }
}

async function runCertbot(domain: string): Promise<void> {
  await shell(
    `sudo certbot --nginx ` +
    `-d ${domain} ` +
    `-d www.${domain} ` +
    `--non-interactive ` +
    `--agree-tos ` +
    `-m ${SSL_EMAIL}`,
    180_000,
  )
}

async function reloadNginx(): Promise<void> {
  await shell('sudo systemctl reload nginx')
}

async function getCertExpiry(domain: string): Promise<Date | null> {
  const result = await shellSafe(
    `sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/${domain}/cert.pem 2>/dev/null || echo "NOT_FOUND"`
  )
  if (result === 'NOT_FOUND' || !result) return null
  const match = result.match(/notAfter=(.+)/)
  if (!match) return null
  const date = new Date(match[1].trim())
  return isNaN(date.getTime()) ? null : date
}

async function checkStorefrontHealth(domain: string): Promise<{ status: string; isOnline: boolean }> {
  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(`https://${domain}`, { signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(tid)
    const isOnline = res.ok || res.status < 500
    return { status: isOnline ? 'online' : 'offline', isOnline }
  } catch {
    return { status: 'offline', isOnline: false }
  }
}

function buildTenantStorefront(business: {
  id: string; name: string; isOnline: boolean; status: string; settings?: string | null;
}): { tenant: { status: string; businessId: string; businessName: string }; storefront: { status: string; isOnline: boolean } } {
  let tenantStatus: string
  if (!business.isOnline && business.status === 'SUSPENDED') {
    tenantStatus = 'not_found'
  } else {
    tenantStatus = business.isOnline ? 'active' : 'draft'
  }
  try {
    const settings = JSON.parse(business.settings || '{}')
    const sf = settings.storefront as Record<string, unknown> | undefined
    if (sf?.websiteStatus === 'maintenance') tenantStatus = 'maintenance'
  } catch { /* ignore */ }
  return {
    tenant: { status: tenantStatus, businessId: business.id, businessName: business.name },
    storefront: { isOnline: business.isOnline, status: business.isOnline ? 'online' : 'offline' },
  }
}

export const POST = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const body = (await req.json()) as { slug: string }
      console.log("VALIDATE REQUEST", JSON.stringify(body))

      const slug = body.slug?.toLowerCase().trim()
      console.log("SLUG", slug)

      if (!slug) return createErrorResponse('slug is required', 400)

      const defaultDomain = `${slug}.${STOREFRONT_BASE}`
      const checkedAt = new Date().toISOString()

      // 0. Look up business + DomainMapping first (ALWAYS — even before DNS check)
      console.log("Fetching business for slug", slug)
      const business = await db.business.findFirst({
        where: { slug },
        select: {
          id: true, slug: true, name: true, isOnline: true, status: true, settings: true,
          domain: { select: { domain: true, subdomain: true, sslStatus: true, sslError: true, status: true } },
        },
      })
      console.log("BUSINESS", JSON.stringify(business))
      console.log("DOMAIN_MAPPING", JSON.stringify(business?.domain))

      // Resolve the actual provisioning domain:
      //   Prefer DomainMapping.domain (the canonical website hostname)
      //   Fall back to slug-derived domain for first-time provisioning
      const domain = business?.domain?.domain || defaultDomain
      console.log("DOMAIN_USED", domain)
      console.log("DOMAIN_SOURCE", business?.domain?.domain ? 'DomainMapping' : 'slug-derived')

      // Compute tenant/storefront from business data (available for ALL paths, including DNS-pending)
      const ts = business
        ? buildTenantStorefront(business)
        : { tenant: null, storefront: null }

      // 1. DNS Resolution
      let dnsActive = false
      let resolved: string[] = []
      try {
        console.log("Resolving DNS for", domain)
        resolved = await dns.resolve4(domain)
        console.log("DNS RESOLVED", resolved)
        dnsActive = VPS_IP ? resolved.includes(VPS_IP) : true
        console.log("DNS ACTIVE", dnsActive, "VPS_IP", VPS_IP)
      } catch (dnsErr) {
        console.log("DNS ERROR", dnsErr instanceof Error ? dnsErr.message : String(dnsErr))
        dnsActive = false
      }

      if (!dnsActive) {
        return NextResponse.json({
          success: true,
          data: {
            slug, domain,
            dns: { status: 'pending', resolved, expected: VPS_IP, pointsToVps: false },
            ssl: { status: 'pending', expiryDate: null, httpsReachable: false, error: null },
            tenant: ts.tenant, storefront: ts.storefront,
            deployment: { status: 'PENDING_DNS', label: 'DNS Pending', nextStep: `Add A record: * → ${VPS_IP || '<VPS_IP>'}` },
            checkedAt,
          },
        })
      }

      if (!business) {
        return NextResponse.json({
          success: true,
          data: {
            slug, domain,
            dns: { status: 'active', resolved, expected: VPS_IP, pointsToVps: true },
            ssl: { status: 'pending', expiryDate: null, httpsReachable: false, error: null },
            tenant: null, storefront: null,
            deployment: { status: 'ERROR', label: 'Tenant Not Found', nextStep: 'Business not found in database.' },
            checkedAt,
          },
        })
      }

      // Skip if already active or currently provisioning
      const currentSslStatus = business.domain?.sslStatus
      console.log("CURRENT SSL STATUS", currentSslStatus)

      if (currentSslStatus === 'active') {
        const health = await checkStorefrontHealth(domain)
        return NextResponse.json({
          success: true,
          data: {
            slug, domain,
            dns: { status: 'active', resolved, expected: VPS_IP, pointsToVps: true },
            ssl: { status: 'active', expiryDate: null, httpsReachable: true, error: null },
            tenant: ts.tenant, storefront: health,
            deployment: health.isOnline
              ? { status: 'ACTIVE', label: 'Fully Live', nextStep: '' }
              : { status: 'STOREFRONT_OFFLINE', label: 'Storefront Offline', nextStep: 'SSL is active but the storefront is not serving content.' },
            checkedAt,
          },
        })
      }

      if (currentSslStatus === 'provisioning') {
        return NextResponse.json({
          success: true,
          data: {
            slug, domain,
            dns: { status: 'active', resolved, expected: VPS_IP, pointsToVps: true },
            ssl: { status: 'provisioning', expiryDate: null, httpsReachable: false, error: null },
            tenant: ts.tenant, storefront: ts.storefront,
            deployment: { status: 'SSL_PENDING', label: 'Provisioning SSL...', nextStep: 'SSL provisioning already in progress.' },
            checkedAt,
          },
        })
      }

      // 2. Verify prerequisites
      console.log("Verifying prerequisites (nginx + certbot)")
      const prereqError = await verifyPrerequisites()
      console.log("PREREQ RESULT", prereqError)

      if (prereqError) {
        await db.domainMapping.upsert({
          where: { businessId: business.id },
          update: { sslStatus: 'failed', status: 'ERROR', sslError: prereqError, sslLastCheckedAt: new Date() },
          create: { businessId: business.id, domain, subdomain: slug, sslStatus: 'failed', status: 'ERROR', sslError: prereqError },
        })
        return NextResponse.json({
          success: true,
          data: {
            slug, domain,
            dns: { status: 'active', resolved, expected: VPS_IP, pointsToVps: true },
            ssl: { status: 'failed', expiryDate: null, httpsReachable: false, error: prereqError },
            tenant: ts.tenant, storefront: ts.storefront,
            deployment: { status: 'ERROR', label: 'SSL Failed', nextStep: prereqError },
            checkedAt,
          },
        })
      }

      // 3. Update DB to provisioning
      console.log("Updating DB to provisioning")
      await db.domainMapping.upsert({
        where: { businessId: business.id },
        update: { sslStatus: 'provisioning', status: 'SSL_PENDING', sslError: null },
        create: { businessId: business.id, domain, subdomain: slug, sslStatus: 'provisioning', status: 'SSL_PENDING' },
      })

      // 4. Run full provisioning (blocks until certbot completes)
      console.log("SSL PROVISIONING DOMAIN:", domain)
      let sslResult: { status: 'active' | 'failed'; expiryDate: Date | null; error: string | null }
      try {
        console.log("Step: ensureNginxConfig")
        await ensureNginxConfig(domain)
        console.log("Step: runCertbot")
        const certbotCmd = `sudo certbot --nginx -d ${domain} -d www.${domain} --non-interactive --agree-tos -m ${SSL_EMAIL}`
        console.log("CERTBOT COMMAND:", certbotCmd)
        let certbotOutput = ''
        try {
          certbotOutput = await shell(certbotCmd, 180_000)
          console.log("CERTBOT OUTPUT:", certbotOutput)
        } catch (certbotErr) {
          certbotOutput = certbotErr instanceof Error ? certbotErr.message : String(certbotErr)
          console.log("CERTBOT FAILED:", certbotOutput)
          throw certbotErr
        }
        console.log("Step: reloadNginx")
        await reloadNginx()

        // Verify HTTPS
        console.log("Step: verify HTTPS")
        let httpsOk = false
        try {
          const ctrl = new AbortController()
          const tid = setTimeout(() => ctrl.abort(), 10000)
          const res = await fetch(`https://${domain}`, { signal: ctrl.signal, redirect: 'follow' })
          clearTimeout(tid)
          httpsOk = res.ok || res.status < 500
          console.log("HTTPS CHECK", httpsOk, res.status)
        } catch (httpsErr) {
          console.log("HTTPS ERROR", httpsErr instanceof Error ? httpsErr.message : String(httpsErr))
          httpsOk = false
        }

        const expiryDate = await getCertExpiry(domain)
        console.log("CERT EXPIRY", expiryDate)
        sslResult = { status: httpsOk ? 'active' : 'failed', expiryDate, error: httpsOk ? null : 'HTTPS not reachable after certificate was issued' }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.log("PROVISION ERROR", message)
        sslResult = { status: 'failed', expiryDate: null, error: message }
      }

      // 5. Live storefront health check (independent of DB isOnline flag)
      const storefrontHealth = await checkStorefrontHealth(domain)
      console.log("STOREFRONT HEALTH", storefrontHealth)

      // 6. Determine final deployment status with distinct codes
      let deploymentStatus: string
      let deploymentLabel: string
      let deploymentNextStep: string

      if (sslResult.status === 'failed') {
        deploymentStatus = 'SSL_FAILED'
        deploymentLabel = 'SSL Failed'
        deploymentNextStep = sslResult.error || ''
      } else if (!storefrontHealth.isOnline) {
        deploymentStatus = 'STOREFRONT_OFFLINE'
        deploymentLabel = 'Storefront Offline'
        deploymentNextStep = 'SSL is active but the storefront is not serving content. Check the Next.js application and set website status to Active.'
      } else {
        deploymentStatus = 'ACTIVE'
        deploymentLabel = 'Fully Live'
        deploymentNextStep = ''
      }

      // 7. Update DB with final result
      console.log("Final SSL result", sslResult.status, sslResult.error)
      await db.domainMapping.update({
        where: { businessId: business.id },
        data: {
          sslStatus: sslResult.status,
          status: deploymentStatus === 'ACTIVE' ? 'ACTIVE' : deploymentStatus === 'STOREFRONT_OFFLINE' ? 'SSL_PENDING' : 'ERROR',
          sslExpiryDate: sslResult.expiryDate,
          sslError: sslResult.error,
          sslLastCheckedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          slug, domain,
          dns: { status: 'active', resolved, expected: VPS_IP, pointsToVps: true },
          ssl: {
            status: sslResult.status,
            expiryDate: sslResult.expiryDate?.toISOString() ?? null,
            httpsReachable: sslResult.status === 'active',
            error: sslResult.error,
          },
          tenant: ts.tenant,
          storefront: storefrontHealth,
          deployment: {
            status: deploymentStatus,
            label: deploymentLabel,
            nextStep: deploymentNextStep,
          },
          checkedAt: new Date().toISOString(),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : ''
      console.log("VALIDATION FATAL ERROR", message)
      console.log("STACK", stack)
      return NextResponse.json(
        { success: false, error: message, stack },
        { status: 500 },
      )
    }
  },
)
