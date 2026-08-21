import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { APPS, APP_KEYS, appDisplayName, appShortName, parseAppLogos, isAppKey } from '@/lib/app-branding'

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
    expect(appDisplayName('store', 'Laundry & Drycleaners')).toBe('Store Admin Laundry & Drycleaners')
    expect(appDisplayName('customer', 'Laundry & Drycleaners')).toBe('Laundry & Drycleaners')
  })

  it('an unresolved tenant degrades to the role alone', () => {
    expect(appDisplayName('delivery', null)).toBe('Delivery')
    expect(appDisplayName('store', '')).toBe('Store Admin')
  })

  it('the launcher label is the ROLE, which truncation cannot destroy', () => {
    // short_name is what Android draws. "Delivery" and "Store Admin" stay
    // readable where a full name would be cut to a shared prefix.
    expect(appShortName('delivery', 'Laundry & Drycleaners')).toBe('Delivery')
    expect(appShortName('store', 'Laundry & Drycleaners')).toBe('Store Admin')
    // The customer app has no role, so it uses the first word of the business.
    expect(appShortName('customer', 'Laundry & Drycleaners')).toBe('Laundry')
  })

  it('Laundry OS stays product-branded, by design', () => {
    // One installation serves whichever businesses the operator is authorized
    // for, so naming it after one of them would be false the moment they
    // switch. This is a deliberate exception, asserted so it is not "fixed".
    expect(APPS.admin.tenantBranded).toBe(false)
    expect(appDisplayName('admin', 'Laundry & Drycleaners')).toBe('Laundry OS')
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
    // Versioned, so a replaced icon produces a new URL.
    expect(MANIFEST).toContain('/api/core/app-icon/${slug}/${app}/192.png?v=${v}')
    expect(MANIFEST).toContain('/api/core/app-icon/${slug}/${app}/512.png?v=${v}')
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

describe('the website header wears the square app mark', () => {
  const LAYOUT = read('src/components/storefront/web/storefront-layout.tsx')

  it('the header resolves the Customer App icon, not the landscape logo', () => {
    expect(LAYOUT).toContain('/api/core/app-icon/${slug}/customer/192.png')
    expect(LAYOUT).toContain('src={headerMark || currentBusinessLogo')
  })

  it('the slug comes from the host, with no fetch and no PWA code touched', () => {
    expect(LAYOUT).toContain('const slug = host.slice(0, -(base.length + 1))')
    expect(LAYOUT).toContain('if (!slug || slug.includes("."))')
  })

  it('a square mark sits in a square box, fixed on both axes', () => {
    // A width that can grow is what let one asset eat a phone header.
    expect(LAYOUT).toContain('className="h-10 w-10 shrink-0 flex items-center justify-center cursor-pointer active:opacity-70"')
    expect(LAYOUT).toContain('className="h-10 w-10 sm:h-11 sm:w-11 object-contain rounded-lg"')
  })

  it('it is contained, never stretched, and never circular', () => {
    expect(LAYOUT).toContain('className="h-full w-full object-contain rounded-md"')
    expect(LAYOUT).not.toContain('rounded-full object-contain')
  })

  it('the header URL is versioned, like the manifest', () => {
    // An unversioned URL is stable while its contents are not: a browser that
    // cached it once keeps showing an icon the tenant has since replaced.
    expect(LAYOUT).toContain('/customer/192.png?v=${v || "d"}')
    const CTX = read('src/app/api/core/storefront/store-context/route.ts')
    expect(CTX).toContain('customerAppIconVersion: appIconVersion(')
    expect(CTX).toContain('appLogos: true')
  })

  it('off a tenant host it falls back rather than breaking', () => {
    expect(LAYOUT).toContain('if (!host.endsWith(`.${base}`)) return null')
  })
})

describe('a square app icon never becomes a landscape one', () => {
  const ICON = read('src/app/api/core/app-icon/[slug]/[app]/[size]/route.ts')
  const CROPPER = read('src/components/branding/brand-asset-cropper.tsx')
  const DIALOG = read('src/components/laundry/apps/app-branding-dialog.tsx')

  it('the icon route cannot reach the website logo at all', () => {
    // The website logo is a landscape wordmark. Reaching for it here would put
    // a 4.33:1 lockup inside a square launcher tile.
    expect(ICON).not.toContain('sourceLogo')
    expect(ICON).toContain('const chosen = brand.appLogo')
  })

  it('the output is square at both required sizes', () => {
    expect(ICON).toContain('const VALID_SIZES = new Set([192, 512])')
    expect(ICON).toContain('squareIcon(buf, size, chosen)')
    // squareIcon fits into size x size — one dimension, used twice.
    const IMG = read('src/lib/brand-image.ts')
    expect(IMG).toContain('.resize(size, size, { fit: "contain"')
  })

  it('app icons crop 1:1 and the website crops 3:1 — separate presets', () => {
    expect(CROPPER).toContain('aspect: 1, outputWidth: 512, outputHeight: 512')
    expect(CROPPER).toContain('aspect: 3, outputWidth: 900, outputHeight: 300')
    // The app dialog asks for the square preset, never the website one.
    expect(DIALOG).toContain('CROP_PRESETS.appIcon(')
    expect(DIALOG).not.toContain('CROP_PRESETS.websiteLogo')
  })

  it('the cropped square is what is saved, previewed AND installed', () => {
    // One asset: the crop output is uploaded, the dialog previews the icon
    // route, and the manifest points at that same route.
    expect(DIALOG).toContain('onApply={(cropped) => { setPending(null); save(cropped) }}')
    expect(DIALOG).toContain('`/api/core/app-icon/${slug}/${appKey}/192.png')
    expect(MANIFEST).toContain('/api/core/app-icon/${slug}/${app}/192.png?v=${v}')
  })

  it('the website logo is read from the business, not from app branding', () => {
    const SITE = read('src/app/api/core/website-logo/[slug]/route.ts')
    expect(SITE).toContain('logoPath = biz.logo || biz.branding?.logo || null')
    expect(SITE).not.toContain('appLogos')
  })
})

describe('the dialog says which icon you are looking at', () => {
  const DIALOG = read('src/components/laundry/apps/app-branding-dialog.tsx')
  const SAVE = read('src/app/api/core/businesses/[businessId]/app-branding/route.ts')

  it('it reads what is actually configured', () => {
    expect(SAVE).toContain('export const GET')
    expect(SAVE).toContain('custom: !!map[k]')
    expect(DIALOG).toContain('const loadState = useCallback(')
  })

  it('custom and default are named, never left to guess', () => {
    expect(DIALOG).toContain('Custom icon')
    expect(DIALOG).toContain('Default icon')
  })

  it('the preview is the same route the manifest points at', () => {
    // A dialog that previews one image while the phone installs another is
    // worse than no preview.
    expect(DIALOG).toContain('`/api/core/app-icon/${slug}/${appKey}/192.png')
  })

  it('resetting is offered only when there is something to reset', () => {
    expect(DIALOG).toContain('{custom && (')
  })

  it('all four apps expose branding, Laundry OS included', () => {
    const APPS_VIEW = read('src/components/laundry/views/laundry-mobile-apps.tsx')
    for (const k of ['"customer"', '"delivery"', '"store"', '"admin"']) {
      expect(APPS_VIEW).toContain(`appKey=${k}`)
    }
  })
})

describe('a replaced icon is visible without clearing a cache', () => {
  const ICON = read('src/app/api/core/app-icon/[slug]/[app]/[size]/route.ts')
  const MAN = read('src/app/manifest.json/route.ts')
  const LIB = read('src/lib/app-branding.ts')

  it('the version is derived from the configured asset', () => {
    expect(LIB).toContain('export function appIconVersion(')
    expect(LIB).toContain('if (!appLogo) return "d"')
  })

  it('the manifest points at versioned icon URLs', () => {
    expect(MAN).toContain('const v = appIconVersion(appLogos[app])')
    expect(MAN).toContain('/192.png?v=${v}')
    expect(MAN).toContain('/512.png?v=${v}')
  })

  it('a versioned URL caches forever; an unversioned one does not', () => {
    // The URL names one exact asset, so it never has to expire. Without a
    // version the URL is stable while its contents are not.
    expect(ICON).toContain('"public, max-age=31536000, immutable"')
    expect(ICON).toContain('"public, max-age=300, stale-while-revalidate=60"')
  })

  it('the same version changes for a different upload', () => {
    // Distinct stored paths must not collide onto one cache entry.
    expect(LIB).toContain('Math.imul(31, h)')
  })
})

describe('one crop editor, configured per destination', () => {
  const CROPPER = read('src/components/branding/brand-asset-cropper.tsx')
  const DIALOG = read('src/components/laundry/apps/app-branding-dialog.tsx')

  it('selecting a file opens the editor instead of saving', () => {
    // Straight-to-save is how a logo's empty margin became most of the icon.
    expect(DIALOG).toContain('if (f) setPending(f)')
    expect(DIALOG).not.toContain('if (f) save(f)')
  })

  it('the workspace logo uses the same editor at the website ratio', () => {
    // §9: one crop workflow, not a second implementation for the website.
    const WS = read('src/components/laundry/views/laundry-branding-settings.tsx')
    expect(WS).toContain('<BrandAssetCropper')
    expect(WS).toContain('CROP_PRESETS.websiteLogo()')
    expect(WS).toContain('if (f) setPendingLogo(f)')
    // Straight-to-upload is gone.
    expect(WS).not.toContain('if (f) pickLogo(f)')
  })

  it('all four apps share the one component', () => {
    // The dialog is rendered per app, so wiring it here covers Customer,
    // Delivery, Admin and Store without four implementations.
    expect(DIALOG).toContain('<BrandAssetCropper')
    expect(DIALOG).toContain('CROP_PRESETS.appIcon(')
  })

  it('the editor cannot distort the logo', () => {
    // The frame is fixed and the artwork moves beneath it. There is no handle
    // that changes width independently of height, which is how logos squash.
    expect(CROPPER).toContain('const s = baseScale * zoom')
    expect(CROPPER).toContain('const w = img.width * s')
    expect(CROPPER).toContain('const h = img.height * s')
  })

  it('what is seen in the frame is what is saved', () => {
    expect(CROPPER).toContain('const k = config.outputWidth / FRAME_W')
    expect(CROPPER).toContain('offset.x * k')
  })

  it('it produces a NEW file and never touches the original', () => {
    expect(CROPPER).toContain('new File([blob]')
    expect(CROPPER).toContain('-cropped.png')
    expect(CROPPER).not.toContain('writeFile')
  })

  it('presets carry each destination\'s real ratio and size', () => {
    expect(CROPPER).toContain('aspect: 1, outputWidth: 512, outputHeight: 512')
    expect(CROPPER).toContain('aspect: 3, outputWidth: 900, outputHeight: 300')
    expect(CROPPER).toContain('aspect: 1, outputWidth: 256, outputHeight: 256')
  })

  it('it offers move, zoom, reset, cancel and apply', () => {
    for (const control of ['onPointerDown', 'type="range"', 'const reset =', 'onClick={onCancel}', 'onClick={apply}']) {
      expect(CROPPER).toContain(control)
    }
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

  it('the generated mark is DRAWN, never typeset', () => {
    // SVG <text> renders on a developer machine and produces nothing on the
    // server, which has no fonts: the Customer icon shipped as a blue square
    // with a blank corner. Geometry cannot fail to load the way a glyph can.
    const gen = IMAGE.slice(IMAGE.indexOf('export async function generatedAppIcon'), IMAGE.indexOf('// ─── Landscape website logo'))
    expect(gen).not.toContain('<text')
    expect(gen).not.toContain('font-family')
    expect(gen).toContain('const MARKS')
  })

  it('each app has its own silhouette, not just its own colour', () => {
    const gen = IMAGE.slice(IMAGE.indexOf('export async function generatedAppIcon'), IMAGE.indexOf('// ─── Landscape website logo'))
    for (const key of ['    C:', '    D:', '    A:', '    S:']) expect(gen).toContain(key)
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
