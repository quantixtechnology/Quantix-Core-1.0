// ============================================================================
// Product Host Provisioner — creates the Nginx virtual host + Let's Encrypt SSL
// certificate for a product workspace subdomain (e.g. commerce.quantixtechnology.in).
//
// This is the product-subdomain analogue of the per-tenant storefront SSL flow
// in src/app/api/website/validate/route.ts, and reuses the exact same on-VPS
// mechanism: the deployed app runs `sudo nginx`/`sudo certbot` (the app user has
// the required sudoers entries on the production VPS). It is idempotent:
//   - nginx config is created only if missing, then symlinked + validated
//   - certbot runs only if no live certificate already exists for the host
//   - nginx is reloaded
//
// One vhost per PRODUCT host serves ALL businesses on that product (tenant
// context is carried in the path / query by the proxy), so this runs once per
// product — NOT once per business.
// ============================================================================

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const SSL_EMAIL = process.env.SSL_EMAIL || 'ssl@quantixtechnology.in'
const NGINX_DIR = '/etc/nginx/sites-available'
const NGINX_ENABLED_DIR = '/etc/nginx/sites-enabled'

export interface ProductHostResult {
  host: string
  nginx: 'created' | 'existing' | 'failed'
  ssl: 'issued' | 'existing' | 'failed'
  // Observability only: reports the outcome of the (unchanged) nginx reload step.
  reload: 'reloaded' | 'failed' | 'not_reached'
  httpsReachable: boolean
  expiryDate: string | null
  error: string | null
}

async function shell(cmd: string, timeout = 120_000): Promise<string> {
  const { stdout } = await execAsync(cmd, { timeout, encoding: 'utf-8' })
  return stdout.trim()
}
async function shellSafe(cmd: string, timeout = 120_000): Promise<string> {
  try { return await shell(cmd, timeout) } catch { return '' }
}

export async function verifyPrerequisites(): Promise<string | null> {
  const nginx = await shellSafe('which nginx 2>/dev/null || echo "MISSING"')
  if (nginx === 'MISSING' || !nginx) return 'nginx is not installed on this server'
  const certbot = await shellSafe('which certbot 2>/dev/null || echo "MISSING"')
  if (certbot === 'MISSING' || !certbot) return 'certbot is not installed on this server'
  return null
}

// Product hosts have no `www.` alias (unlike tenant storefronts).
function nginxTemplate(host: string): string {
  return [
    'server {',
    '    listen 80;',
    `    server_name ${host};`,
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

async function ensureNginxConfig(host: string): Promise<'created' | 'existing'> {
  const confPath = `${NGINX_DIR}/${host}.conf`
  const enabledPath = `${NGINX_ENABLED_DIR}/${host}.conf`

  await shell(`sudo mkdir -p ${NGINX_DIR} ${NGINX_ENABLED_DIR}`)

  const exists = await shellSafe(`sudo test -f ${confPath} && echo "EXISTS"`)
  const created = exists !== 'EXISTS'
  if (created) {
    const conf = nginxTemplate(host)
    await shell(`sudo tee ${confPath} > /dev/null << 'NGINX_EOF'\n${conf}\nNGINX_EOF`)
  }

  const linked = await shellSafe(`sudo test -L ${enabledPath} && echo "LINKED"`)
  if (linked !== 'LINKED') {
    await shell(`sudo ln -sf ${confPath} ${enabledPath}`)
  }

  // Long/multi-label hostnames (e.g. delivery.<slug>.<base>) overflow nginx's
  // default server_names_hash_bucket_size (64), which makes `nginx -t` fail
  // globally with "could not build server_names_hash" — blocking certbot for
  // EVERY host in the run. Ensure a sufficient bucket size (idempotent) so the
  // engine scales to long names + many tenants. conf.d/*.conf is included in the
  // http{} block, which is where this directive must live.
  await ensureServerNamesHash()

  const valid = await shellSafe('sudo nginx -t 2>&1')
  if (!valid.includes('syntax is ok')) {
    throw new Error(`nginx config invalid:\n${valid}`)
  }
  return created ? 'created' : 'existing'
}

async function ensureServerNamesHash(): Promise<void> {
  const path = '/etc/nginx/conf.d/00-server-names-hash.conf'
  const present = await shellSafe(`sudo test -f ${path} && echo "EXISTS"`)
  if (present !== 'EXISTS') {
    await shell(`echo 'server_names_hash_bucket_size 128;' | sudo tee ${path} > /dev/null`)
  }
}

async function certExists(host: string): Promise<boolean> {
  const out = await shellSafe(`sudo test -f /etc/letsencrypt/live/${host}/cert.pem && echo "EXISTS"`)
  return out === 'EXISTS'
}

async function runCertbot(host: string): Promise<void> {
  await shell(
    `sudo certbot --nginx -d ${host} --non-interactive --agree-tos -m ${SSL_EMAIL}`,
    180_000,
  )
}

async function reloadNginx(): Promise<void> {
  await shell('sudo systemctl reload nginx')
}

async function getCertExpiry(host: string): Promise<Date | null> {
  const result = await shellSafe(
    `sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/${host}/cert.pem 2>/dev/null || echo "NOT_FOUND"`,
  )
  if (result === 'NOT_FOUND' || !result) return null
  const match = result.match(/notAfter=(.+)/)
  if (!match) return null
  const date = new Date(match[1].trim())
  return isNaN(date.getTime()) ? null : date
}

async function checkHttps(host: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 10_000)
    const res = await fetch(`https://${host}`, { signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(tid)
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

/**
 * Idempotently provision the Nginx vhost + SSL certificate for a product host.
 * `host` must be a bare hostname (no scheme, no path), e.g. 'commerce.quantixtechnology.in'.
 */
export async function provisionProductHost(host: string): Promise<ProductHostResult> {
  const result: ProductHostResult = {
    host, nginx: 'failed', ssl: 'failed', reload: 'not_reached', httpsReachable: false, expiryDate: null, error: null,
  }

  const prereq = await verifyPrerequisites()
  if (prereq) { result.error = prereq; return result }

  try {
    result.nginx = await ensureNginxConfig(host)

    if (await certExists(host)) {
      result.ssl = 'existing'
    } else {
      await runCertbot(host)
      result.ssl = 'issued'
    }

    // Reload behaviour is unchanged; we only record its outcome for diagnostics.
    try {
      await reloadNginx()
      result.reload = 'reloaded'
    } catch (reloadErr) {
      result.reload = 'failed'
      throw reloadErr
    }

    const expiry = await getCertExpiry(host)
    result.expiryDate = expiry?.toISOString() ?? null
    result.httpsReachable = await checkHttps(host)
    if (!result.httpsReachable) {
      result.error = 'Certificate provisioned but HTTPS not reachable yet'
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  }

  return result
}

/** Normalise a registry workspaceUrl into a bare hostname (strip scheme + path). */
export function workspaceUrlToHost(workspaceUrl: string): string {
  return workspaceUrl.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()
}
