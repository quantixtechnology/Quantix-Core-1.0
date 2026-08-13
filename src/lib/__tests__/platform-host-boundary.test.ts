import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isPlatformAppHost, productHostForCode } from '@/lib/product-hosts'

// ============================================================================
// app.<base> is the Quantix PLATFORM application; laundry.<base> is a tenant
// workspace. They share one deployment and one login endpoint, and that
// endpoint had NO notion of which host the browser used — so a Business Owner
// posting valid credentials to the platform host received a fully valid
// session, with only the client-side viewMode deciding what to render.
//
// The boundary is now enforced BEFORE any token is minted.
// ============================================================================

const BASE = 'quantixtechnology.in'
const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const LOGIN = read('src/app/api/core/auth/login/route.ts')
const EXCHANGE = read('src/app/api/core/auth/session-exchange/route.ts')

describe('host classification', () => {
  it('the platform application hosts', () => {
    expect(isPlatformAppHost('app.quantixtechnology.in', BASE)).toBe(true)
    expect(isPlatformAppHost('admin.quantixtechnology.in', BASE)).toBe(true)
    expect(isPlatformAppHost('quantixtechnology.in', BASE)).toBe(true)
    expect(isPlatformAppHost('APP.QuantixTechnology.IN:443', BASE)).toBe(true)
  })

  it('product workspaces are NOT the platform', () => {
    expect(isPlatformAppHost('laundry.quantixtechnology.in', BASE)).toBe(false)
    expect(isPlatformAppHost('commerce.quantixtechnology.in', BASE)).toBe(false)
  })

  it('tenant storefronts, custom domains and sub-hosts are NOT the platform', () => {
    expect(isPlatformAppHost('vastrasudha.quantixtechnology.in', BASE)).toBe(false)
    expect(isPlatformAppHost('store.vastrasudha.quantixtechnology.in', BASE)).toBe(false)
    expect(isPlatformAppHost('mylaundry.com', BASE)).toBe(false)
    // Lookalikes must not pass.
    expect(isPlatformAppHost('app.quantixtechnology.in.evil.com', BASE)).toBe(false)
    expect(isPlatformAppHost('notquantixtechnology.in', BASE)).toBe(false)
  })

  it('local development is never treated as the platform host', () => {
    expect(isPlatformAppHost('localhost:3000', BASE)).toBe(false)
    expect(isPlatformAppHost('127.0.0.1:3000', BASE)).toBe(false)
  })

  it('an unclassifiable host is NOT the platform — fail closed', () => {
    expect(isPlatformAppHost(null, BASE)).toBe(false)
    expect(isPlatformAppHost('app.quantixtechnology.in', '')).toBe(false)
  })

  it('a refused tenant is pointed at their own workspace', () => {
    expect(productHostForCode('LAUNDRY', BASE)).toBe('laundry.quantixtechnology.in')
    expect(productHostForCode('COMMERCE', BASE)).toBe('commerce.quantixtechnology.in')
    expect(productHostForCode('UNKNOWN', BASE)).toBeNull()
    expect(productHostForCode(null, BASE)).toBeNull()
  })
})

describe('the refusal happens before a session exists', () => {
  it('login refuses on the platform host for a non-platform user', () => {
    expect(LOGIN).toContain('isPlatformAppHost(requestHost, STOREFRONT_BASE) && !isPlatformAdmin')
    expect(LOGIN).toContain('TENANT_ACCOUNT_ON_PLATFORM_HOST')
    expect(LOGIN).toContain('This account belongs to a business workspace')
  })

  it('no token is minted for a refused user', () => {
    // The guard must precede BOTH refreshToken.create calls, so there is
    // nothing to replay and nothing localStorage could be primed with.
    const guardAt = LOGIN.indexOf('isPlatformAppHost(requestHost')
    const firstToken = LOGIN.indexOf('refreshToken.create')
    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(firstToken)
  })

  it('credentials are still verified first — no user enumeration change', () => {
    // Password verification and the lockout logic run before the host check.
    expect(LOGIN.indexOf('Invalid email or password')).toBeLessThan(LOGIN.indexOf('isPlatformAppHost(requestHost'))
  })

  it('the token exchange applies the same boundary', () => {
    // Otherwise a tenant could sign in at laundry.<base> and swap that token
    // for an app.<base> session.
    expect(EXCHANGE).toContain('isPlatformAppHost(exchangeHost, STOREFRONT_BASE)')
    expect(EXCHANGE).toContain('TENANT_ACCOUNT_ON_PLATFORM_HOST')
  })
})

describe('every existing platform role keeps its access', () => {
  it('the check is isPlatformAdmin, which covers the whole PLATFORM_ROLES list', () => {
    // Super Admin, Platform Admin, Sales, Support, Deployment, Finance — the
    // fix refuses tenant roles only, it does not narrow to Super Admin.
    expect(LOGIN).toContain("'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM'")
    expect(LOGIN).toContain("'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM'")
    expect(LOGIN).toContain('&& !isPlatformAdmin')
    expect(LOGIN).not.toContain("role !== 'QUANTIX_SUPER_ADMIN'")
  })

  it('the exchange uses the same platform role list', () => {
    expect(EXCHANGE).toContain("'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM'")
  })
})

describe('nothing else was changed', () => {
  it('the tenant workspace login path is untouched', () => {
    // The check only fires on the platform host, so laundry.<base> login,
    // the customer PWA and the executive/store PWAs are unaffected.
    expect(LOGIN).toContain('isPlatformAppHost(requestHost, STOREFRONT_BASE)')
    for (const f of ['src/app/api/laundry/app/auth/verify/route.ts',
                     'src/app/api/laundry/executive/auth/login/route.ts',
                     'src/app/api/laundry/store-admin/auth/login/route.ts']) {
      expect(read(f)).not.toContain('isPlatformAppHost')
    }
  })

  it('no new role, permission or auth system was introduced', () => {
    const hosts = read('src/lib/product-hosts.ts')
    expect(hosts).not.toContain('prisma')
    expect(hosts).not.toContain('createAccessToken')
    const schema = read('prisma/schema.prisma')
    expect(schema).not.toContain('model PlatformAccess')
  })

  it('the reverse direction is not widened — platform users gain no tenant rights', () => {
    // getLaundryAuthContext still requires a BusinessUser row, falling back to
    // support mode for platform staff exactly as before.
    const auth = read('src/lib/laundry-auth.ts')
    expect(auth).toContain('isSupportMode: true')
    expect(auth).not.toContain('isPlatformAppHost')
  })
})
