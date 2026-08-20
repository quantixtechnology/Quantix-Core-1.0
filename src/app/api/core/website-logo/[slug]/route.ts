// ============================================================================
// GET /api/core/website-logo/[slug].png
//
// The tenant's logo presented on a LANDSCAPE canvas for the website header.
//
// The business uploads one logo and it may be any shape. The header wants a
// wide lockup. Rather than making the owner produce a second file, the source
// is presented on a landscape canvas:
//
//   • already landscape → used as-is, aspect ratio preserved
//   • square / portrait → centred at its true proportions, and the space around
//     it filled with a colour sampled FROM THE LOGO'S OWN EDGE, so the square
//     boundary stops reading as a box pasted onto a background
//   • transparent art   → stays transparent, so the page background shows
//     through — better camouflage than any invented colour
//
// It never stretches, never crops, and never writes: the uploaded original is
// only ever read. ?w= and ?h= let a caller ask for the canvas its header needs.
// ============================================================================
import { db } from "@/lib/db"
import { readLogoBuffer, landscapeLogo, generatedAppIcon } from "@/lib/brand-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_W = 640
const DEFAULT_H = 360 // 16:9
const MAX_DIM = 2048

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params
  const slug = rawSlug.replace(/\.png$/i, "")
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return new Response("Invalid slug.", { status: 400 })

  const url = new URL(req.url)
  const width = clamp(parseInt(url.searchParams.get("w") || "", 10) || DEFAULT_W, 64, MAX_DIM)
  const height = clamp(parseInt(url.searchParams.get("h") || "", 10) || DEFAULT_H, 64, MAX_DIM)

  let name = "Q"
  let accent = "#10B981"
  let logoPath: string | null = null
  try {
    const biz = await db.business.findUnique({
      where: { slug },
      select: { name: true, primaryColor: true, logo: true, branding: { select: { logo: true, primaryColor: true } } },
    })
    if (biz) {
      name = biz.name || "Q"
      accent = biz.primaryColor || biz.branding?.primaryColor || accent
      logoPath = biz.logo || biz.branding?.logo || null
    }
  } catch {
    // Fall through to the generated mark.
  }

  let png: Buffer | null = null
  const buf = await readLogoBuffer(logoPath)
  if (buf) {
    try {
      png = await landscapeLogo(buf, { width, height, accent, sourcePath: logoPath })
    } catch {
      png = null
    }
  }

  if (!png) {
    // No usable logo — a square brand mark centred on the landscape canvas is
    // still better than an empty header.
    const mark = await generatedAppIcon({
      initial: name.trim().charAt(0).toUpperCase() || "Q",
      glyph: "",
      accent,
      size: Math.min(width, height),
    })
    png = await landscapeLogo(mark, { width, height, accent })
  }

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
