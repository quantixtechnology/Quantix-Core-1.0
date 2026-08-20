// ============================================================================
// GET /api/core/app-icon/[slug]/[app]/[size].png
//
// The launcher icon for ONE application of ONE tenant.
//
//   /api/core/app-icon/acme/delivery/512.png
//
// Resolution order, per app:
//   1. The app's own uploaded icon (BusinessBranding.appLogos[app])
//   2. The business's source logo — so a tenant that has only ever uploaded one
//      logo keeps working and is never asked to re-upload anything
//   3. A generated default carrying the app's own accent and glyph
//
// Step 3 is why four installed apps stop looking alike: an unbranded Delivery
// and an unbranded Store are visibly different icons, not two grey squares.
//
// Tenant isolation: the slug in the path IS the ownership boundary. There is no
// path by which one business's icon is served for another.
// ============================================================================
import { isAppKey, resolveAppBranding, APPS } from "@/lib/app-branding"
import { readLogoBuffer, squareIcon, generatedAppIcon } from "@/lib/brand-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_SIZES = new Set([192, 512])

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string; app: string; size: string }> },
) {
  const { slug, app, size: rawSize } = await context.params

  const size = parseInt(rawSize.replace(/\.png$/i, ""), 10)
  if (!VALID_SIZES.has(size)) return new Response("Invalid size. Use 192 or 512.", { status: 400 })
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return new Response("Invalid slug.", { status: 400 })
  if (!isAppKey(app)) return new Response("Unknown application.", { status: 400 })

  const brand = await resolveAppBranding(slug, app)
  const def = APPS[app]
  const initial = (brand.businessName || "Q").trim().charAt(0).toUpperCase() || "Q"

  // The app's own icon first, the business's logo second.
  const chosen = brand.appLogo ?? brand.sourceLogo
  let png: Buffer | null = null

  if (chosen) {
    const buf = await readLogoBuffer(chosen)
    if (buf) {
      try {
        png = await squareIcon(buf, size, chosen)
      } catch {
        png = null // corrupt or unsupported — fall through to the generated icon
      }
    }
  }

  if (!png) {
    png = await generatedAppIcon({ initial, glyph: def.glyph, accent: def.accent, size })
  }

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Long cache: the icon changes only when the business changes it, and the
      // app + slug in the path keep tenants on separate cache entries.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
