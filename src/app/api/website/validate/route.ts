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

  await shell(`mkdir -p ${NGINX_DIR} ${NGINX_ENABLED_DIR}`)

  const exists = await shellSafe(`test -f ${confPath} && echo "EXISTS"`)
  if (exists !== 'EXISTS') {
    const conf = nginxTemplate(domain)
    await shell(`cat > ${confPath} << 'NGINX_EOF'\n${conf}\nNGINX_EOF`)
  }

  const linked = await shellSafe(`test -L ${enabledPath} && echo "LINKED"`)
  if (linked !== 'LINKED') {
    await shell(`ln -sf ${confPath} ${enabledPath}`)
  }

  const valid = await shellSafe('nginx -t 2>&1')
  if (!valid.includes('syntax is ok')) {
    throw new Error(`nginx config invalid:\n${valid}`)
  }
}

async function runCertbot(domain: string): Promise<void> {
  await shell(
    `certbot --nginx ` +
    `-d ${domain} ` +
    `-d www.${domain} ` +
    `--non-interactive ` +
    `--agree-tos ` +
    `-m ${SSL_EMAIL}`,
    180_000,
  )
}

async function reloadNginx(): Promise<void> {
  await shell('systemctl reload nginx')
}

async function getCertExpiry(domain: string): Promise<Date | null> {
  const result = await shellSafe(
    `openssl x509 -enddate -noout -in /etc/letsencrypt/live/${domain}/cert.pem 2>/dev/null || echo "NOT_FOUND"`
  )
  if (result === 'NOT_FOUND' || !result) return null
  const match = result.match(/notAfter=(.+)/)
  if (!match) return null
  const date = new Date(match[1].trim())
  return isNaN(date.getTime()) ? null : date
}

export const POST = withMiddleware({ requireAuth: true })(
  async (req) => {
    const body = (await req.json()) as { slug: string }
    const slug = body.slug?.toLowerCase().trim()
    if (!slug) return createErrorResponse('slug is required', 400)

    const domain = `${slug}.${STOREFRONT_BASE}`

    const checkedAt = new Date().toISOString()

    // 1. DNS Resolution
    let dnsActive = false
    let resolved: string[] = []
    try {
      resolved = await dns.resolve4(domain)
      dnsActive = VPS_IP ? resolved.includes(VPS_IP) : true
    } catch {
      dnsActive = false
    }

    if (!dnsActive) {
      return NextResponse.json({
        success: true,
        data: {
          slug, domain,
          dns: { status: 'pending', resolved, expected: VPS_IP, pointsToVps: false },
          ssl: { status: 'pending', expiryDate: null, httpsReachable: false, error: null },
          tenant: null, storefront: null,
          deployment: { status: 'PENDING_DNS', label: 'DNS Pending', nextStep: `Add A record: * → ${VPS_IP || '<VPS_IP>'}` },
          checkedAt,
        },
      })
    }

    // DNS is active — proceed with SSL provisioning
    const business = await db.business.findFirst({
      where: { slug },
      select: { id: true, slug: true, domain: { select: { sslStatus: true } } },
    })
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
    if (currentSslStatus === 'active') {
      return NextResponse.json({
        success: true,
        data: {
          slug, domain,
          dns: { status: 'active', resolved, expected: VPS_IP, pointsToVps: true },
          ssl: { status: 'active', expiryDate: null, httpsReachable: true, error: null },
          tenant: null, storefront: null,
          deployment: { status: 'ACTIVE', label: 'Fully Live', nextStep: '' },
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
          tenant: null, storefront: null,
          deployment: { status: 'SSL_PROVISIONING', label: 'Provisioning SSL...', nextStep: 'SSL provisioning already in progress.' },
          checkedAt,
        },
      })
    }

    // 2. Verify prerequisites
    const prereqError = await verifyPrerequisites()
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
          tenant: null, storefront: null,
          deployment: { status: 'ERROR', label: 'SSL Failed', nextStep: prereqError },
          checkedAt,
        },
      })
    }

    // 3. Update DB to provisioning
    await db.domainMapping.upsert({
      where: { businessId: business.id },
      update: { sslStatus: 'provisioning', status: 'SSL_PROVISIONING', sslError: null },
      create: { businessId: business.id, domain, subdomain: slug, sslStatus: 'provisioning', status: 'SSL_PROVISIONING' },
    })

    // 4. Run full provisioning (blocks until certbot completes)
    let sslResult: { status: 'active' | 'failed'; expiryDate: Date | null; error: string | null }
    try {
      await ensureNginxConfig(domain)
      await runCertbot(domain)
      await reloadNginx()

      // Verify HTTPS
      let httpsOk = false
      try {
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 10000)
        const res = await fetch(`https://${domain}`, { signal: ctrl.signal, redirect: 'follow' })
        clearTimeout(tid)
        httpsOk = res.ok || res.status < 500
      } catch {
        httpsOk = false
      }

      const expiryDate = await getCertExpiry(domain)
      sslResult = { status: httpsOk ? 'active' : 'failed', expiryDate, error: httpsOk ? null : 'HTTPS not reachable after certificate was issued' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sslResult = { status: 'failed', expiryDate: null, error: message }
    }

    // 5. Update DB with final result
    await db.domainMapping.update({
      where: { businessId: business.id },
      data: {
        sslStatus: sslResult.status,
        status: sslResult.status === 'active' ? 'ACTIVE' : 'ERROR',
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
        tenant: null, storefront: null,
        deployment: {
          status: sslResult.status === 'active' ? 'ACTIVE' : 'SSL_FAILED',
          label: sslResult.status === 'active' ? 'Fully Live' : 'SSL Failed',
          nextStep: sslResult.error || '',
        },
        checkedAt: new Date().toISOString(),
      },
    })
  },
)
