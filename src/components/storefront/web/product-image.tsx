"use client"

// ============================================================================
// ProductImage — shared image renderer for all storefront product surfaces.
//
// Design decisions:
//   • object-contain  — never crops product images; shows full item shape
//   • white bg + padding — products stand out against a clean background
//   • Graceful error state — falls back to a business-type emoji placeholder
//   • className controls outer size; works in cards (h-28), detail (h-full),
//     cart thumbnails (h-16), and any future surface
// ============================================================================

import { useState } from "react"

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  fallbackEmoji?: string
  /** Tailwind classes that set the outer container size, e.g. "w-full h-28" */
  className?: string
}

export function ProductImage({
  src,
  alt,
  fallbackEmoji = "📦",
  className = "w-full h-28",
}: ProductImageProps) {
  const [error, setError] = useState(false)

  if (src && !error) {
    return (
      <div className={`${className} bg-white flex items-center justify-center p-2`}>
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          onError={() => setError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={`${className} bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-3xl`}
      aria-label={alt}
    >
      {fallbackEmoji}
    </div>
  )
}
