"use client"

// ============================================================================
// ProductImage — shared image renderer for all storefront product surfaces.
//
// Rendering behaviour:
//   • Skeleton shimmer while the image loads — no blank containers
//   • Smooth opacity fade-in when the image is ready
//   • loading="lazy" — defers off-screen images for faster LCP
//   • object-contain — never crops; shows the full product shape
//   • Config-driven padding / bg / radius / fit — no magic numbers
//   • Emoji placeholder on error — always shows something meaningful
//
// Sizing: caller controls the container via `className` (e.g. "w-full h-full").
// Styling: caller passes `config` from the store; defaults to platform config.
// ============================================================================

import { useState, CSSProperties } from "react"
import type { ProductImageConfig } from "@/config/product-image-config"
import { PLATFORM_IMAGE_DEFAULTS } from "@/config/product-image-config"

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  fallbackEmoji?: string
  /** Tailwind sizing classes applied to the outer container, e.g. "w-full h-full" */
  className?: string
  /** Per-surface style overrides merged onto platform defaults */
  config?: Partial<ProductImageConfig>
}

export function ProductImage({
  src,
  alt,
  fallbackEmoji = "📦",
  className = "w-full h-full",
  config,
}: ProductImageProps) {
  const [loaded, setLoaded]   = useState(false)
  const [error,  setError]    = useState(false)

  const cfg: ProductImageConfig = config
    ? { ...PLATFORM_IMAGE_DEFAULTS, ...config }
    : PLATFORM_IMAGE_DEFAULTS

  const containerStyle: CSSProperties = {
    backgroundColor: cfg.backgroundColor,
    padding:         cfg.padding,
    borderRadius:    cfg.borderRadius,
  }

  // ── Fallback placeholder ─────────────────────────────────────────────────
  if (!src || error) {
    return (
      <div
        className={`${className} flex items-center justify-center text-3xl bg-gradient-to-br from-gray-100 to-gray-50`}
        style={{ borderRadius: cfg.borderRadius }}
        aria-label={alt}
        role="img"
      >
        {fallbackEmoji}
      </div>
    )
  }

  // ── Image with skeleton + fade-in ────────────────────────────────────────
  return (
    <div
      className={`${className} relative flex items-center justify-center overflow-hidden`}
      style={containerStyle}
    >
      {/* Skeleton shimmer — visible until image fires onLoad */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100"
          aria-hidden="true"
        />
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full group-hover:scale-105"
        style={{
          objectFit:  cfg.fitMode,
          opacity:    loaded ? 1 : 0,
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  )
}
