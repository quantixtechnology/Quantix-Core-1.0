import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// TENANT LINK PREVIEWS — a tenant's customers must never see Quantix branding.
//
// The only metadata the server emitted was the static platform block in
// app/layout.tsx, so every tenant domain shared on WhatsApp showed "Quantix
// Technology". A crawler never runs React, so nothing the client does later can
// fix it: the tags have to be right in the FIRST HTML response.
//
// The tenant is resolved from the Host header — DomainMapping for a customer's
// own domain, else the storefront subdomain slug. No businessId is ever read
// from the URL, so a crafted request cannot select another tenant's branding.
// ============================================================================

const H = vi.hoisted(() => {
  const state = {
    host: '',
    // host → platformBusinessId, as DomainMapping resolves it
    domains: {} as Record<string, string>,
    slugs: {} as Record<string, string>,
    businesses: {} as Record<string, { name: string; tagline: string | null; description: string | null; logo: string | null; businessType: string }>,
  }
  return {
    state,
    headers: vi.fn(async () => ({ get: (k: string) => (k.toLowerCase() === 'host' ? state.host : null) })),
    resolveTenantFromHostname: vi.fn(async (req: Request) => {
      const host = req.headers.get('host') || ''
      return state.domains[host] ?? null
    }),
    prisma: {
      business: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findUnique: vi.fn(async (a: any) => {
          if (a.where.slug !== undefined) {
            const id = state.slugs[a.where.slug]
            return id ? { id } : null
          }
          return state.businesses[a.where.id] ?? null
        }),
      },
    },
  }
})

vi.mock('next/headers', () => ({ headers: H.headers }))
vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/tenant-resolver', () => ({ resolveTenantFromHostname: H.resolveTenantFromHostname }))

import { resolveStorefrontBranding } from '@/lib/storefront-metadata'
import { generateMetadata } from '@/app/page'

const { state } = H

const VS = 'BUS-202608-0008'
const LD = 'BUS-202606-0005'

beforeEach(() => {
  state.host = ''
  state.domains = { 'vastrasudha.co.in': VS, 'www.vastrasudha.co.in': VS, 'laundrydrycleaners.co.in': LD }
  state.slugs = { vastrasudha: VS }
  state.businesses = {
    [VS]: { name: 'VASTRASUDHA', tagline: 'Laundry & Drycleaners', description: null, logo: '/uploads/business/vs/logo.png', businessType: 'LAUNDRY' },
    [LD]: { name: 'Laundry & Drycleaners', tagline: 'Fresh every day', description: null, logo: '/uploads/business/ld/logo.png', businessType: 'LAUNDRY' },
  }
  vi.clearAllMocks()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const og = (m: any) => m.openGraph ?? {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tw = (m: any) => m.twitter ?? {}

describe('1,2,3,4 · VASTRASUDHA gets VASTRASUDHA branding', () => {
  beforeEach(() => { state.host = 'vastrasudha.co.in' })

  it('1 · og:title is the tenant name', async () => {
    const m = await generateMetadata()
    expect(og(m).title).toBe('VASTRASUDHA')
    expect(tw(m).title).toBe('VASTRASUDHA')
    expect(m.title).toBe('VASTRASUDHA')
  })

  it('2 · og:image is the tenant logo, absolute and https on its own host', async () => {
    const m = await generateMetadata()
    const img = og(m).images?.[0]?.url
    expect(img).toBe('https://vastrasudha.co.in/api/core/files/business/vs/logo.png')
    expect(img.startsWith('https://')).toBe(true)
    expect(tw(m).images?.[0]).toBe(img)
  })

  it('3 · NOTHING in the payload is Quantix branding', async () => {
    const m = await generateMetadata()
    const blob = JSON.stringify(m).toLowerCase()
    expect(blob).not.toContain('quantix')
    expect(blob).not.toContain('white-label')
    expect(blob).not.toContain('run your business smarter')
  })

  it('4 · description is the tenant tagline', async () => {
    const m = await generateMetadata()
    expect(og(m).description).toBe('Laundry & Drycleaners')
    expect(tw(m).description).toBe('Laundry & Drycleaners')
  })

  it('siteName and canonical are the tenant, not the platform', async () => {
    const m = await generateMetadata()
    expect(og(m).siteName).toBe('VASTRASUDHA')
    expect(og(m).url).toBe('https://vastrasudha.co.in')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((m as any).alternates?.canonical).toBe('https://vastrasudha.co.in')
  })

  it('www. resolves to the same tenant', async () => {
    state.host = 'www.vastrasudha.co.in'
    expect((await resolveStorefrontBranding())?.name).toBe('VASTRASUDHA')
  })

  it('the storefront subdomain works too, not only the custom domain', async () => {
    state.host = 'vastrasudha.quantixtechnology.in'
    expect((await resolveStorefrontBranding())?.name).toBe('VASTRASUDHA')
  })
})

describe('5 · another tenant gets its own branding', () => {
  it('resolves per host, with nothing hardcoded', async () => {
    state.host = 'laundrydrycleaners.co.in'
    const m = await generateMetadata()
    expect(og(m).title).toBe('Laundry & Drycleaners')
    expect(og(m).description).toBe('Fresh every day')
    expect(og(m).images?.[0]?.url).toBe('https://laundrydrycleaners.co.in/api/core/files/business/ld/logo.png')

    const SRC = readFileSync(join(process.cwd(), 'src/lib/storefront-metadata.ts'), 'utf8')
    expect(SRC.toLowerCase()).not.toContain('vastrasudha')
  })

  it('falls back to tenant-specific copy — never platform copy — with no tagline', async () => {
    state.businesses[VS].tagline = null
    state.businesses[VS].description = null
    state.host = 'vastrasudha.co.in'
    const b = await resolveStorefrontBranding()
    expect(b?.description).toBe('Laundry')          // from businessType
    expect(b?.description).not.toContain('Quantix')
  })

  it('a tenant with no logo still gets its own name and copy', async () => {
    state.businesses[VS].logo = null
    state.host = 'vastrasudha.co.in'
    const m = await generateMetadata()
    expect(og(m).title).toBe('VASTRASUDHA')
    expect(og(m).images).toBeUndefined()             // no image beats the wrong image
    expect(tw(m).card).toBe('summary')
    expect(JSON.stringify(m).toLowerCase()).not.toContain('quantix')
  })
})

describe('6 · tenant isolation', () => {
  it('branding comes from the HOST — no businessId is read from the request', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/storefront-metadata.ts'), 'utf8')
    expect(SRC).toContain('h.get("host")')
    expect(SRC).not.toContain('searchParams')
    expect(SRC).not.toContain('req.url')
    expect(SRC).not.toMatch(/businessId\s*=\s*(body|params|query)/)
  })

  it("tenant A's host can never return tenant B's branding", async () => {
    state.host = 'vastrasudha.co.in'
    expect((await resolveStorefrontBranding())?.name).toBe('VASTRASUDHA')
    state.host = 'laundrydrycleaners.co.in'
    expect((await resolveStorefrontBranding())?.name).toBe('Laundry & Drycleaners')
  })

  it('an unmapped host gets no tenant branding at all', async () => {
    state.host = 'attacker-controlled.example.com'
    expect(await resolveStorefrontBranding()).toBeNull()
    expect(await generateMetadata()).toEqual({})   // platform metadata stands
  })

  it('a nested/product host is not resolved by slug', async () => {
    state.host = 'store.vastrasudha.quantixtechnology.in'
    expect(await resolveStorefrontBranding()).toBeNull()
  })

  it('the platform host keeps the platform branding', async () => {
    for (const host of ['quantixtechnology.in', 'www.quantixtechnology.in', 'app.quantixtechnology.in']) {
      state.host = host
      expect(await resolveStorefrontBranding()).toBeNull()
    }
  })
})

describe('7 · the metadata is server-rendered, not client-set', () => {
  const PAGE = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')

  it('the entry is a SERVER component exporting generateMetadata', () => {
    expect(PAGE).toContain('export async function generateMetadata()')
    expect(PAGE).not.toContain('"use client"')
  })

  it('nothing about it depends on the browser', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/storefront-metadata.ts'), 'utf8')
    for (const banned of ['useEffect', 'document.', 'window.', 'localStorage']) {
      expect(PAGE, banned).not.toContain(banned)
      expect(SRC, banned).not.toContain(banned)
    }
  })

  it('is on the PAGE, not the root layout — the layout must stay prerenderable', () => {
    const LAYOUT = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    expect(LAYOUT).not.toContain('generateMetadata')
    expect(LAYOUT).not.toContain('headers()')
    expect(LAYOUT).toContain('export const metadata: Metadata')
  })

  it('the image URL is stable — no per-request cache buster', async () => {
    state.host = 'vastrasudha.co.in'
    const a = (await generateMetadata()) as { openGraph?: { images?: { url: string }[] } }
    const b = (await generateMetadata()) as { openGraph?: { images?: { url: string }[] } }
    expect(a.openGraph?.images?.[0].url).toBe(b.openGraph?.images?.[0].url)
    expect(a.openGraph?.images?.[0].url).not.toMatch(/[?&](t|v|ts|rand)=/)
  })
})

describe('8 · the storefront itself is unchanged', () => {
  it('the app shell moved file, and nothing else', () => {
    const SHELL = readFileSync(join(process.cwd(), 'src/app/home-shell.tsx'), 'utf8')
    expect(SHELL.startsWith('"use client"')).toBe(true)
    expect(SHELL).toContain('export default function HomeShell()')
    // The routing/branch logic the storefront depends on is still there.
    expect(SHELL).toContain('isCandidateCustomHost')
    expect(SHELL).toContain('customHostCandidates')
    expect(SHELL).toContain('getProductCodeForHost')
  })

  it('the page renders that shell and nothing else', () => {
    const PAGE = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')
    expect(PAGE).toContain('return <HomeShell />')
  })

  it('the resolver only READS branding — it writes nothing', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/storefront-metadata.ts'), 'utf8')
    expect(SRC).toContain('findUnique')
    for (const w of ['.create(', '.update(', '.delete(', '.upsert(']) expect(SRC, w).not.toContain(w)
  })

  it('reuses the existing Business branding — no second system', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/storefront-metadata.ts'), 'utf8')
    expect(SRC).toContain('resolveTenantFromHostname')  // the existing host→tenant resolver
    expect(SRC).toContain('resolveImageUrl')            // the existing image URL resolver
    expect(SRC).toContain('select: { name: true, tagline: true, description: true, logo: true, businessType: true }')
  })
})
