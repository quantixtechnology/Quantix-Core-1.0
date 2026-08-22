import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isCandidateCustomHost, customHostCandidates, STOREFRONT_META_NAME } from '@/lib/custom-domain'

// ============================================================================
// A customer's domain opens the customer's shop.
//
// A storefront was always found by taking the slug off the front of
// <slug>.quantixtechnology.in. A customer's own domain has no slug to take, so
// every one of them fell past the storefront branch and rendered the Quantix
// marketing page — on the customer's own domain, which is the one page it must
// never show.
//
// DomainMapping.domain already held the answer. What was missing was a way to
// reach it: the edge proxy has no database, and the browser only knows a
// hostname. So the server resolves it once and emits it, and the client router
// reads it at boot exactly as it reads a slug off a platform subdomain.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const PROXY    = read('src/proxy.ts')
const LAYOUT   = read('src/app/layout.tsx')
const PAGE     = read('src/app/page.tsx')
const RESOLVER = read('src/lib/tenant-resolver.ts')

const BASE = 'quantixtechnology.in'

describe('a custom domain is recognised as one', () => {
  it('vastrasudha.co.in and its www are candidates', () => {
    expect(isCandidateCustomHost('vastrasudha.co.in', BASE)).toBe(true)
    expect(isCandidateCustomHost('www.vastrasudha.co.in', BASE)).toBe(true)
  })

  it('any customer domain qualifies — nothing is hardcoded', () => {
    for (const h of ['acme.com', 'shop.example.co.uk', 'my-laundry.in']) {
      expect(isCandidateCustomHost(h, BASE)).toBe(true)
    }
    for (const src of [PROXY, LAYOUT, PAGE]) {
      expect(src.toLowerCase()).not.toContain('vastrasudha')
    }
  })

  it('a port does not change the answer', () => {
    expect(isCandidateCustomHost('vastrasudha.co.in:443', BASE)).toBe(true)
  })
})

describe('nothing the platform already owns is treated as a custom domain', () => {
  it('the platform hosts are excluded', () => {
    for (const h of [BASE, `www.${BASE}`, `app.${BASE}`]) {
      expect(isCandidateCustomHost(h, BASE)).toBe(false)
    }
  })

  it('tenant subdomains keep their own branch', () => {
    // Sending them down both paths would give one host two routes.
    for (const h of [`vastrasudha.${BASE}`, `laundrydrycleaners.${BASE}`, `store.acme.${BASE}`, `delivery.acme.${BASE}`]) {
      expect(isCandidateCustomHost(h, BASE)).toBe(false)
    }
  })

  it('localhost and raw addresses are excluded', () => {
    for (const h of ['localhost', 'localhost:3000', 'app.localhost', '13.205.43.103', '127.0.0.1', '']) {
      expect(isCandidateCustomHost(h, BASE)).toBe(false)
    }
  })

  it('a bare label is not a public domain', () => {
    expect(isCandidateCustomHost('intranet', BASE)).toBe(false)
  })
})

describe('www is the only alias, and it is exact otherwise', () => {
  it('www falls back to the apex', () => {
    // nginx and the certificate already treat the pair as one domain.
    expect(customHostCandidates('www.vastrasudha.co.in')).toEqual(['www.vastrasudha.co.in', 'vastrasudha.co.in'])
  })

  it('an apex asks only for itself', () => {
    expect(customHostCandidates('vastrasudha.co.in')).toEqual(['vastrasudha.co.in'])
  })

  it('no other subdomain is guessed at', () => {
    // shop.acme.com must not resolve acme.com: a looser rule is how one tenant
    // ends up serving another's storefront.
    expect(customHostCandidates('shop.acme.com')).toEqual(['shop.acme.com'])
    expect(customHostCandidates('mail.acme.com')).toEqual(['mail.acme.com'])
  })

  it('the host is normalised before it is looked up', () => {
    expect(customHostCandidates('WWW.VastraSudha.CO.IN:443')).toEqual(['www.vastrasudha.co.in', 'vastrasudha.co.in'])
  })
})

describe('the proxy gives a custom domain a storefront-shaped request', () => {
  it('there is a branch for it, after the slug branch', () => {
    const slugBranch = PROXY.indexOf("if (hostWithoutPort.endsWith(`.${STOREFRONT_BASE}`))")
    const customBranch = PROXY.indexOf('if (isCandidateCustomHost(hostWithoutPort, STOREFRONT_BASE))')
    expect(slugBranch).toBeGreaterThan(-1)
    expect(customBranch).toBeGreaterThan(slugBranch)
  })

  it('deep paths collapse to / so the SPA boots, as they do for slug hosts', () => {
    const branch = PROXY.slice(PROXY.indexOf('if (isCandidateCustomHost('))
    expect(branch).toContain("url.pathname = '/'")
    expect(branch).toContain("const PUBLIC_PATHS = ['/delete-account', '/reset-password']")
  })

  it('the proxy claims no knowledge of the tenant', () => {
    // The edge has no database; "candidate" is all it can honestly say.
    const branch = PROXY.slice(PROXY.indexOf('if (isCandidateCustomHost('), PROXY.indexOf('return withSecurityHeaders(NextResponse.next())'))
    expect(branch).not.toContain('db.')
    expect(branch).not.toContain('prisma')
    expect(branch).not.toContain('_storefront')
  })

  it('the existing branches are untouched', () => {
    expect(PROXY).toContain("if (hostWithoutPort.startsWith('delivery.'))")
    expect(PROXY).toContain("if (hostWithoutPort.startsWith('store.'))")
    expect(PROXY).toContain("url.searchParams.set('_storefront', slug)")
    expect(PROXY).toContain("const SKIP_PATHS = ['/api', '/uploads', '/apks', '/sw.js'")
  })
})

describe('the tenant is resolved by the mapping, not by the hostname shape', () => {
  it('resolution goes through the existing exact-match endpoint', () => {
    expect(PAGE).toContain('`/api/core/tenant/resolve?domain=${encodeURIComponent(candidate)}`')
    expect(RESOLVER).toContain('{ domain: cleanHostname }')
  })

  it('a custom domain can never be matched by subdomain', () => {
    // The resolver only widens to a subdomain match for *.quantixtechnology.in;
    // that rule is what keeps one tenant off another's domain.
    expect(RESOLVER).toContain("...(isQuantixSubdomain ? [{ subdomain: cleanHostname.split('.')[0] }] : [])")
    expect(RESOLVER).toContain('const isQuantixSubdomain = cleanHostname.endsWith(`.${storefrontBase}`)')
  })

  it('a host that maps to nothing resolves to nothing', () => {
    const hook = PAGE.slice(PAGE.indexOf('function useCustomDomainSlug'), PAGE.indexOf('function detectStorefrontSlug'))
    expect(hook).toContain('setState({ slug: null, pending: false })')
  })

  it('an unreachable lookup is not a tenant either', () => {
    const hook = PAGE.slice(PAGE.indexOf('function useCustomDomainSlug'), PAGE.indexOf('function detectStorefrontSlug'))
    expect(hook).toContain('} catch {')
    expect(hook).toContain('continue')
  })

  it('nothing is read from the request while rendering', () => {
    // headers() in the root layout opts EVERY page on the platform out of
    // prerendering — the login screens and workspace shells included.
    expect(LAYOUT).not.toContain('next/headers')
    expect(LAYOUT).not.toContain('resolveBusinessFromDomain')
  })
})

describe('the client boots the right storefront', () => {
  it('the lookup runs only for a candidate custom host', () => {
    const hook = PAGE.slice(PAGE.indexOf('function useCustomDomainSlug'), PAGE.indexOf('function detectStorefrontSlug'))
    expect(hook).toContain('if (!isCandidateCustomHost(host, _SF_BASE)) return')
    // Nothing to do when the host already named its tenant.
    expect(hook).toContain('if (alreadyKnown) return')
  })

  it('www is tried before the apex it belongs to', () => {
    const hook = PAGE.slice(PAGE.indexOf('function useCustomDomainSlug'), PAGE.indexOf('function detectStorefrontSlug'))
    expect(hook).toContain('for (const candidate of customHostCandidates(host))')
  })

  it('the platform page is not shown while the answer is on its way', () => {
    // A marketing page on a customer's own domain is the whole problem.
    expect(PAGE).toContain('if (customDomain.pending) return <PageLoader />')
  })

  it('the host slug still wins when there is one', () => {
    expect(PAGE).toContain('const storefrontSlug = hostSlug ?? customDomain.slug')
  })

  it('a reserved name is refused however it arrives', () => {
    const hook = PAGE.slice(PAGE.indexOf('function useCustomDomainSlug'), PAGE.indexOf('function detectStorefrontSlug'))
    expect(hook).toContain('!_SF_RESERVED.has(slug)')
  })

  it('existing tenant-host detection is unchanged', () => {
    expect(PAGE).toContain('if (PLATFORM_HOSTS.has(hostname)) return null')
    expect(PAGE).toContain('if (hostname.endsWith(`.${_SF_BASE}`)) {')
    expect(PAGE).toContain('const slug = hostname.slice(0, -(_SF_BASE.length + 1))')
    // The synchronous detector is exactly what it was.
    const detect = PAGE.slice(PAGE.indexOf('function detectStorefrontSlug'), PAGE.indexOf('// Detect the Delivery PWA entry point'))
    expect(detect).not.toContain('fetch(')
    expect(detect).not.toContain('await')
  })
})

describe('the platform keeps its own front door', () => {
  it('the platform host is never a storefront, from any path', () => {
    expect(isCandidateCustomHost(BASE, BASE)).toBe(false)
    expect(isCandidateCustomHost(`www.${BASE}`, BASE)).toBe(false)
    // and the platform host never even triggers a lookup
    expect(PAGE).toContain('if (!isCandidateCustomHost(host, _SF_BASE)) return')
  })
})
