"use client"

// BrandLogo — one way to draw a tenant's logo, everywhere.
//
// The rendering rule is the whole point and it is easy to get wrong in a dozen
// places independently: NEVER stretch. A logo is someone's identity, and a
// squashed one looks worse than none at all.
//
//   • object-fit: contain, never cover. cover crops; contain fits.
//   • The container is landscape (10:3), the shape logos are designed for.
//   • A square logo therefore sits CENTRED inside that box with clear space on
//     either side — correct, not a bug. No border, no letterboxing, no forcing
//     it to fill a shape it was never drawn for.
//   • No logo falls back to the business initials rather than a broken image.
//
// Used by the sidebar, invoices, receipts, labels, the executive and store
// PWAs and the customer site, so those cannot drift apart.

export const LOGO_RATIO = 10 / 3
export const LOGO_GUIDANCE = "Recommended: 600 × 180 px (Landscape). PNG with transparent background preferred."
export const LOGO_MAX_BYTES = 2 * 1024 * 1024
export const LOGO_ACCEPT = "image/png,image/svg+xml,image/jpeg,image/webp"
export const LOGO_MIN = { width: 400, height: 120 }
export const LOGO_RECOMMENDED = { width: 600, height: 180 }

const SIZES = {
  xs: "h-6",   // dense rows, labels
  sm: "h-8",   // sidebar, headers
  md: "h-12",  // invoices, receipts
  lg: "h-16",  // login screens
  xl: "h-24",  // settings preview
} as const

export type BrandLogoSize = keyof typeof SIZES

export interface BrandLogoProps {
  src?: string | null
  /** Business name — used for the alt text and the initials fallback. */
  name: string
  size?: BrandLogoSize
  /** Brand colour for the initials fallback. */
  color?: string | null
  className?: string
}

export function BrandLogo({ src, name, size = "sm", color, className = "" }: BrandLogoProps) {
  const label = (name || "Business").trim()

  if (!src) {
    return (
      <span
        aria-label={label}
        title={label}
        className={`${SIZES[size]} aspect-[10/3] rounded-md grid place-items-center font-bold tracking-tight text-white shrink-0 ${className}`}
        style={{ backgroundColor: color || "#0f172a" }}>
        <span className="text-[0.7em] px-1 truncate">{initials(label)}</span>
      </span>
    )
  }

  return (
    // The wrapper fixes the landscape box; the image fits inside it. A square
    // logo keeps its shape and simply does not fill the width.
    <span className={`${SIZES[size]} aspect-[10/3] inline-flex items-center justify-center shrink-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
    </span>
  )
}

/** Business identity block: logo above the name, as every document leads with. */
export function BrandIdentity({
  logo, name, subtitle, size = "md", color, className = "",
}: { logo?: string | null; name: string; subtitle?: string | null; size?: BrandLogoSize; color?: string | null; className?: string }) {
  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <BrandLogo src={logo} name={name} size={size} color={color} />
      <div className="min-w-0">
        <p className="font-bold text-slate-800 truncate leading-tight">{name}</p>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w))
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Reads a logo's real dimensions so the uploader can warn before saving. */
export function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    // SVG is resolution-independent; there is nothing meaningful to measure.
    if (file.type === "image/svg+xml") { resolve(null); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

/** Advice for a chosen file — never blocks the upload, only informs. */
export function logoAdvice(size: { width: number; height: number } | null): string | null {
  if (!size) return null
  if (size.width < LOGO_MIN.width || size.height < LOGO_MIN.height) {
    return `This logo is ${size.width} × ${size.height}. Below ${LOGO_MIN.width} × ${LOGO_MIN.height} it may look soft on invoices and labels.`
  }
  const ratio = size.width / size.height
  if (ratio < 1.2) return "This is a square-ish logo. It will be centred in the landscape space — that is expected, not a fault."
  return null
}
