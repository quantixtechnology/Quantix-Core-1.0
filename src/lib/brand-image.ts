// ============================================================================
// Brand image processing — ONE sharp pipeline for every derived brand asset.
//
// Derivatives are generated on demand and cached at the edge; the uploaded
// original is only ever READ. Nothing here writes to the upload directory, so a
// business's source file cannot be altered or replaced by rendering a logo.
//
//   Original business logo
//        ├── square launcher icons   (192, 512)   — Android, PWA install
//        └── landscape website logo               — site header
// ============================================================================
import { readFile } from "fs/promises"
import { join, resolve, extname } from "path"
import sharp from "sharp"
import { UPLOAD_ROOT } from "@/lib/upload-root"

/** Read an uploaded logo, from disk or an external URL. Never throws. */
export async function readLogoBuffer(logoPath: string | null | undefined): Promise<Buffer | null> {
  if (!logoPath) return null

  if (logoPath.startsWith("http://") || logoPath.startsWith("https://")) {
    try {
      const res = await fetch(logoPath, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Quantix-Brand-Image/1.0" },
      })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch { return null }
  }

  let relative = logoPath
  if (relative.startsWith("/api/core/files/")) relative = relative.slice("/api/core/files/".length)
  else if (relative.startsWith("/uploads/")) relative = relative.slice("/uploads/".length)
  else relative = relative.replace(/^\//, "")

  try {
    const uploadsRoot = resolve(UPLOAD_ROOT)
    const filePath = resolve(join(uploadsRoot, relative))
    if (!filePath.startsWith(uploadsRoot)) return null // path traversal guard
    return await readFile(filePath)
  } catch { return null }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = (hex || "").replace("#", "").padEnd(6, "0")
  return {
    r: parseInt(h.slice(0, 2), 16) || 16,
    g: parseInt(h.slice(2, 4), 16) || 185,
    b: parseInt(h.slice(4, 6), 16) || 129,
  }
}

/** A sharp pipeline for a buffer, rasterising SVG at a usable density. */
function pipelineFor(buf: Buffer, sourcePath?: string | null) {
  const isSvg = extname(sourcePath ?? "").toLowerCase() === ".svg"
  return sharp(buf, { density: isSvg ? 300 : undefined })
}

// ─── Square launcher icon ───────────────────────────────────────────────────

/**
 * Fit a logo into an exact square without distorting it.
 *
 * `contain` preserves the aspect ratio and pads — never stretches, never crops.
 * The pad is transparent, so a launcher's own mask shapes the icon rather than
 * a white box baked into the image.
 */
export async function squareIcon(logo: Buffer, size: number, sourcePath?: string | null): Promise<Buffer> {
  return pipelineFor(logo, sourcePath)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ compressionLevel: 8 })
    .toBuffer()
}

/**
 * A generated square icon, used when a business has uploaded nothing.
 *
 * DRAWN, NEVER TYPESET. The first version set the business initial as SVG
 * <text>. That renders on a developer's machine and produces NOTHING on the
 * server, which has no fonts installed: the Customer icon shipped as a blue
 * square with a blank corner. It also explained an odd instability — with no
 * font to fall back on, libvips varied its output between requests.
 *
 * So the mark is pure geometry. Every app gets its own accent AND its own
 * silhouette, which is what keeps four unbranded apps apart on a launcher, and
 * a shape cannot fail to load the way a glyph can.
 */
export async function generatedAppIcon(opts: {
  initial: string
  glyph: string
  accent: string
  size: number
}): Promise<Buffer> {
  const { r, g, b } = hexToRgb(opts.accent)
  const { size } = opts
  const radius = Math.round(size * 0.22)
  // Marks are authored on a 100x100 grid and scaled to the icon.
  const u = size / 100
  const p = (n: number) => +(n * u).toFixed(2)

  const MARKS: Record<string, string> = {
    // Customer — a person.
    C: `<circle cx="${p(50)}" cy="${p(38)}" r="${p(14)}" fill="#fff"/>`
     + `<path d="M${p(24)} ${p(74)}a${p(26)} ${p(26)} 0 0 1 ${p(52)} 0Z" fill="#fff"/>`,
    // Delivery — motion, pointing forward.
    D: `<path d="M${p(22)} ${p(50)}h${p(34)}M${p(44)} ${p(36)}l${p(16)} ${p(14)}l-${p(16)} ${p(14)}" `
     + `stroke="#fff" stroke-width="${p(9)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
     + `<circle cx="${p(70)}" cy="${p(50)}" r="${p(6)}" fill="#fff"/>`,
    // Admin — a console of panels.
    A: `<rect x="${p(24)}" y="${p(24)}" width="${p(22)}" height="${p(22)}" rx="${p(5)}" fill="#fff"/>`
     + `<rect x="${p(54)}" y="${p(24)}" width="${p(22)}" height="${p(22)}" rx="${p(5)}" fill="#fff"/>`
     + `<rect x="${p(24)}" y="${p(54)}" width="${p(22)}" height="${p(22)}" rx="${p(5)}" fill="#fff"/>`
     + `<rect x="${p(54)}" y="${p(54)}" width="${p(22)}" height="${p(22)}" rx="${p(5)}" fill="#fff"/>`,
    // Store — a shopfront.
    S: `<path d="M${p(22)} ${p(44)}l${p(28)}-${p(20)}l${p(28)} ${p(20)}v${p(32)}h-${p(56)}Z" fill="#fff"/>`
     + `<rect x="${p(42)}" y="${p(56)}" width="${p(16)}" height="${p(20)}" rx="${p(3)}" fill="rgb(${r},${g},${b})"/>`,
  }
  const mark = MARKS[opts.glyph] ?? MARKS.A

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="rgb(${r},${g},${b})"/>
  ${mark}
</svg>`

  return sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 8 }).toBuffer()
}

// ─── Landscape website logo ─────────────────────────────────────────────────

export interface LandscapeOptions {
  width: number
  height: number
  /** Brand colour, used only when the source has no usable edge colour. */
  accent: string
  sourcePath?: string | null
}

/**
 * Present any logo on a landscape canvas without distorting it.
 *
 * A square logo dropped on a 16:9 canvas leaves two bars. Stretching it to fill
 * is worse, and cropping loses the mark. So the logo keeps its aspect ratio and
 * sits centred, and the bars are filled with a colour sampled FROM THE LOGO
 * ITSELF — its own edge pixels — so the square boundary stops reading as a box
 * pasted on a background.
 *
 * A transparent source keeps its transparency: the page background shows
 * through, which blends better than any colour this function could invent.
 */
export async function landscapeLogo(logo: Buffer, opts: LandscapeOptions): Promise<Buffer> {
  const { width, height } = opts
  const src = pipelineFor(logo, opts.sourcePath)
  const meta = await src.metadata()

  const hasAlpha = !!meta.hasAlpha
  const srcW = meta.width ?? width
  const srcH = meta.height ?? height
  const isLandscape = srcW / srcH >= width / height

  // Never upscale past the canvas, and always leave breathing room.
  const inner = await pipelineFor(logo, opts.sourcePath)
    .resize(Math.round(width * 0.9), Math.round(height * 0.86), {
      fit: "inside",
      withoutEnlargement: false,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer()

  // Transparent art keeps a transparent canvas — the site's own background is
  // the most convincing camouflage available.
  if (hasAlpha) {
    return sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: inner, gravity: "center" }])
      .png({ compressionLevel: 8 })
      .toBuffer()
  }

  // Opaque art (a JPEG, or a PNG with a baked background): sample the source's
  // own edge to extend it, so the fill matches the logo's backdrop instead of
  // announcing itself as a white bar.
  const edge = await sampleEdgeColor(logo, opts.sourcePath, opts.accent)
  const base = sharp({ create: { width, height, channels: 4, background: { ...edge, alpha: 1 } } })

  // Already landscape enough to fill the canvas — let it, still undistorted.
  if (isLandscape) {
    const filled = await pipelineFor(logo, opts.sourcePath)
      .resize(width, height, { fit: "contain", background: { ...edge, alpha: 1 } })
      .png()
      .toBuffer()
    return sharp(filled).png({ compressionLevel: 8 }).toBuffer()
  }

  return base.composite([{ input: inner, gravity: "center" }]).png({ compressionLevel: 8 }).toBuffer()
}

/**
 * The logo's own dominant edge colour.
 *
 * Averaging a 1px border tells us what the artwork sits on. If that fails, the
 * brand accent is a better guess than white.
 */
async function sampleEdgeColor(
  logo: Buffer,
  sourcePath: string | null | undefined,
  accent: string,
): Promise<{ r: number; g: number; b: number }> {
  try {
    // A 3x3 downsample: the corners approximate the surrounding background.
    const { data, info } = await pipelineFor(logo, sourcePath)
      .resize(3, 3, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const px = (i: number) => ({ r: data[i * info.channels], g: data[i * info.channels + 1], b: data[i * info.channels + 2] })
    const corners = [px(0), px(2), px(6), px(8)] // TL, TR, BL, BR
    const avg = corners.reduce(
      (a, c) => ({ r: a.r + c.r, g: a.g + c.g, b: a.b + c.b }),
      { r: 0, g: 0, b: 0 },
    )
    return {
      r: Math.round(avg.r / corners.length),
      g: Math.round(avg.g / corners.length),
      b: Math.round(avg.b / corners.length),
    }
  } catch {
    return hexToRgb(accent)
  }
}
