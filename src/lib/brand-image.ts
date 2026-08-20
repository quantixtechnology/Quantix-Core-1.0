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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

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
 * Each app gets its OWN accent and glyph, because four identical grey squares
 * on a launcher is the problem this whole model exists to solve. The business
 * initial keeps it recognisably theirs.
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
  const initialSize = Math.round(size * 0.4)
  const badge = Math.round(size * 0.3)
  const badgeR = Math.round(badge * 0.32)
  const pad = Math.round(size * 0.07)

  // Business initial on the app's accent, with a small light badge carrying the
  // app glyph — distinct at 48dp, still legibly the same business.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="rgb(${r},${g},${b})"/>
  <text x="${size / 2}" y="${size * 0.47}" text-anchor="middle" dominant-baseline="central"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
    font-size="${initialSize}" font-weight="700" fill="#ffffff">${esc(opts.initial)}</text>
  <rect x="${size - badge - pad}" y="${size - badge - pad}" width="${badge}" height="${badge}"
    rx="${badgeR}" ry="${badgeR}" fill="#ffffff" fill-opacity="0.92"/>
  <text x="${size - badge / 2 - pad}" y="${size - badge / 2 - pad}" text-anchor="middle" dominant-baseline="central"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
    font-size="${Math.round(badge * 0.62)}" font-weight="700" fill="rgb(${r},${g},${b})">${esc(opts.glyph)}</text>
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
