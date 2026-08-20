import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { APPS, APP_KEYS, appDisplayName, parseAppLogos, isAppKey } from '@/lib/app-branding'

// ============================================================================
// A website logo and a launcher icon are different assets.
//
// The website header wants a landscape lockup. Android wants a square that
// still reads at 48dp beside three siblings. Reusing one asset for both is what
// made four installed apps look identical on the launcher.
//
//   Business
//     ├── Website branding      → landscape logo
//     └── Application branding  → one square icon per installable app
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const MANIFEST = read('src/app/manifest.json/route.ts')
const IMAGE = read('src/lib/brand-image.ts')
const ICON_ROUTE = read('src/app/api/core/app-icon/[slug]/[app]/[size]/route.ts')
const SITE_ROUTE = read('src/app/api/core/website-logo/[slug]/route.ts')
const SAVE_ROUTE = read('src/app/api/core/businesses/[businessId]/app-branding/route.ts')

describe('every installable app has its own identity', () => {
  it('covers the four installable apps and nothing else', () => {
    expect([...APP_KEYS]).toEqual(['customer', 'delivery', 'admin', 'store'])
  })

  it('each app has a distinct accent and glyph', () => {
    // Four unbranded apps must not resolve to four identical squares.
    const accents = APP_KEYS.map((k) => APPS[k].accent)
    const glyphs = APP_KEYS.map((k) => APPS[k].glyph)
    expect(new Set(accents).size).toBe(APP_KEYS.length)
    expect(new Set(glyphs).size).toBe(APP_KEYS.length)
  })

  it('names lead with the role, so a truncated launcher label still differs', () => {
    expect(appDisplayName('delivery', 'Laundry & Drycleaners')).toBe('Delivery Laundry & Drycleaners')
    expect(appDisplayName('customer', 'Laundry & Drycleaners')).toBe('Customer Laundry & Drycleaners')
    expect(appDisplayName('store', 'Laundry & Drycleaners')).toBe('Store Laundry & Drycleaners')
  })

  it('an unresolved tenant degrades to the role alone', () => {
    expect(appDisplayName('delivery', null)).toBe('Delivery')
    expect(appDisplayName('store', '')).toBe('Store')
  })

  it('Laundry OS stays product-branded, by design', () => {
    // One installation serves whichever businesses the operator is authorized
    // for, so naming it after one of them would be false the moment they
    // switch. This is a deliberate exception, asserted so it is not "fixed".
    expect(APPS.admin.tenantBranded).toBe(false)
    expect(appDisplayName('admin', 'Laundry & Drycleaners')).toBe('Admin')
  })
})

describe('per-app overrides are stored per tenant', () => {
  it('reads a logo map keyed by app', () => {
    const m = parseAppLogos(JSON.stringify({ delivery: '/uploads/branding/x/d.png', store: '/uploads/branding/x/s.png' }))
    expect(m.delivery).toBe('/uploads/branding/x/d.png')
    expect(m.store).toBe('/uploads/branding/x/s.png')
    expect(m.customer).toBeUndefined()
  })

  it('malformed or absent JSON is no override, never a crash', () => {
    expect(parseAppLogos('{not json')).toEqual({})
    expect(parseAppLogos(null)).toEqual({})
    expect(parseAppLogos('[]')).toEqual({})
  })

  it('unknown keys and blank values are ignored', () => {
    expect(parseAppLogos(JSON.stringify({ website: '/x.png', delivery: '   ' }))).toEqual({})
    expect(isAppKey('website')).toBe(false)
    expect(isAppKey('delivery')).toBe(true)
  })

  it('saving one app leaves the others untouched', () => {
    // The map is read, one key changed, the rest written back.
    expect(SAVE_ROUTE).toContain('const map = parseAppLogos(existing?.appLogos)')
    expect(SAVE_ROUTE).toContain('if (logo) map[app] = logo')
    expect(SAVE_ROUTE).toContain('else delete map[app]')
  })

  it('branding is owned by a business, never global', () => {
    expect(SAVE_ROUTE).toContain('where: { businessId }')
    expect(SAVE_ROUTE).toContain("user.businessId !== businessId")
    // Only our own uploads — not an arbitrary URL from a client.
    expect(SAVE_ROUTE).toContain("!logo.startsWith(\"/uploads/\")")
  })
})

describe('the manifest uses application icons, not the website logo', () => {
  it('each PWA points at its own app icon set', () => {
    expect(MANIFEST).toContain("icons: iconSet('delivery')")
    expect(MANIFEST).toContain("icons: iconSet('store')")
    expect(MANIFEST).toContain("icons: iconSet('customer')")
  })

  it('the icon set is tenant-scoped', () => {
    expect(MANIFEST).toContain('`/api/core/app-icon/${slug}/${app}/192.png`')
    expect(MANIFEST).toContain('`/api/core/app-icon/${slug}/${app}/512.png`')
  })

  it('it still declares the sizes and the maskable purpose Chrome needs', () => {
    expect(MANIFEST).toContain("sizes: '192x192', type: 'image/png', purpose: 'any' as const")
    expect(MANIFEST).toContain("sizes: '512x512', type: 'image/png', purpose: 'maskable' as const")
  })
})

describe('the upload survives the proxy, and never parses HTML as JSON', () => {
  const DIALOG = read('src/components/laundry/apps/app-branding-dialog.tsx')

  it('the image is squared and shrunk before it is sent', () => {
    // nginx rejects a body over ~1MB with an HTML 413 page. JSON.parse on that
    // is the "Unexpected token '<'" the user saw — the request never reached
    // the app, so no handler could have answered in JSON.
    expect(DIALOG).toContain('async function toSquarePng(')
    expect(DIALOG).toContain('const prepared = await toSquarePng(file)')
  })

  it('squaring centres the art instead of stretching or cropping it', () => {
    expect(DIALOG).toContain('const scale = Math.min(size / bitmap.width, size / bitmap.height)')
    expect(DIALOG).toContain('Math.round((size - w) / 2), Math.round((size - h) / 2)')
  })

  it('an SVG small enough to send is left as vector art', () => {
    expect(DIALOG).toContain('if (file.type === "image/svg+xml" && file.size <= MAX_UPLOAD_BYTES) return file')
  })

  it('a non-JSON response is reported, not parsed blind', () => {
    expect(DIALOG).toContain('async function readJson(')
    expect(DIALOG).toContain('if (res.status === 413) throw new Error("That image is too large. Try one under 1 MB.")')
    // The raw .json() calls that produced the parse error are gone.
    expect(DIALOG).not.toContain('await up.json()')
    expect(DIALOG).not.toContain('await res.json()')
  })
})

describe('images are derived, never destructive', () => {
  it('the pipeline only reads the uploaded original', () => {
    expect(IMAGE).not.toContain('writeFile')
    expect(IMAGE).not.toContain('unlink')
    for (const src of [ICON_ROUTE, SITE_ROUTE]) {
      expect(src).not.toContain('writeFile')
      expect(src).not.toContain('unlink')
    }
  })

  it('it reuses the existing sharp infrastructure', () => {
    expect(IMAGE).toContain("import sharp from \"sharp\"")
  })

  it('a square logo is never stretched or cropped into a launcher icon', () => {
    // `contain` preserves the aspect ratio and pads; `cover` would crop and
    // `fill` would distort.
    expect(IMAGE).toContain('fit: "contain"')
    const sq = IMAGE.slice(IMAGE.indexOf('export async function squareIcon'), IMAGE.indexOf('export async function generatedAppIcon'))
    expect(sq).not.toContain('"cover"')
    expect(sq).not.toContain('"fill"')
  })

  it('the launcher pad is transparent, not a white box', () => {
    expect(IMAGE).toContain('background: { r: 255, g: 255, b: 255, alpha: 0 }')
  })

  it('path traversal cannot escape the upload root', () => {
    expect(IMAGE).toContain('if (!filePath.startsWith(uploadsRoot)) return null')
  })
})

describe('the website logo is landscape, and camouflaged', () => {
  it('the logo keeps its aspect ratio on the canvas', () => {
    const ls = IMAGE.slice(IMAGE.indexOf('export async function landscapeLogo'))
    expect(ls).toContain('fit: "inside"')
    expect(ls).not.toContain('fit: "cover"')
  })

  it('transparent art stays transparent, so the page shows through', () => {
    const ls = IMAGE.slice(IMAGE.indexOf('export async function landscapeLogo'))
    expect(ls).toContain('if (hasAlpha)')
    expect(ls).toContain('background: { r: 0, g: 0, b: 0, alpha: 0 }')
  })

  it('opaque art is extended with a colour sampled from the logo itself', () => {
    // Not white bars, and not an invented colour — the logo's own edge.
    expect(IMAGE).toContain('async function sampleEdgeColor')
    expect(IMAGE).toContain('const edge = await sampleEdgeColor(')
  })

  it('the brand colour is only the last resort', () => {
    const sampler = IMAGE.slice(IMAGE.indexOf('async function sampleEdgeColor'))
    expect(sampler).toContain('return hexToRgb(accent)')
  })
})

describe('existing businesses keep working', () => {
  it('an app with no icon gets a GENERATED default, not the business logo', () => {
    // Falling back to the business logo hands the same image to all four apps.
    // It looks correct in review — every app "has an icon" — and produces four
    // identical launcher entries.
    expect(ICON_ROUTE).toContain('const chosen = brand.appLogo')
    expect(ICON_ROUTE).not.toContain('brand.appLogo ?? brand.sourceLogo')
    expect(ICON_ROUTE).toContain('png = await generatedAppIcon(')
  })

  it('the generated default still carries the tenant identity', () => {
    // Distinct per app, but recognisably this business.
    expect(ICON_ROUTE).toContain('const initial = (brand.businessName || "Q")')
    expect(ICON_ROUTE).toContain('glyph: def.glyph, accent: def.accent')
  })

  it('the source logo is kept for the WEBSITE presentation', () => {
    const LIB = read('src/lib/app-branding.ts')
    expect(LIB).toContain('sourceLogo: biz.logo || biz.branding?.logo || null')
    expect(SITE_ROUTE).toContain('logoPath = biz.logo || biz.branding?.logo || null')
  })

  it('the stored override defaults to empty, so nothing must be migrated', () => {
    expect(read('prisma/schema.prisma')).toContain('appLogos       String   @default("{}")')
  })
})
