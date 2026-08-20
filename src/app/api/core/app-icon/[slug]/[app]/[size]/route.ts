// ============================================================================
// GET /api/core/app-icon/[slug]/[app]/[size].png
//
// The launcher icon for ONE application of ONE tenant.
//
//   /api/core/app-icon/acme/delivery/512.png
//
// Resolution order, per app:
//   1. The app's own uploaded icon (BusinessBranding.appLogos[app])
//   2. A generated default in THIS app's accent, carrying the business initial
//
// There is deliberately no step that falls back to the business logo. Doing so
// returns the same image for all four apps — which is the bug this model exists
// to remove, and it is invisible in code review because each app still "has an
// icon". The generated default keeps the tenant's identity (its initial) while
// making Customer, Delivery, Admin and Store four distinct marks.
//
// The source logo is not discarded: it is what the WEBSITE presentation is
// generated from (see /api/core/website-logo). Different job, different asset.
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

  // ONLY the app's own icon. No fallback to the business logo — see above.
  const chosen = brand.appLogo
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
