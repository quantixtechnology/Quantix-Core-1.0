"use client"

// ============================================================================
// StorefrontCategoryCard
//
// Two distinct layouts driven by context:
//
//   WEB (grid)  — Blinkit-style square card: full-width aspect-square image
//                 container + label below. Size is set by the parent grid
//                 (4 cols on mobile → 10 cols on xl, giving ~80–110px images).
//
//   PWA (scroll) — Compact 72px circular/rounded chip for horizontal scroll
//                  strips. Unchanged from original design.
// ============================================================================

import { resolveImageUrl } from "@/lib/image-url"
import { getCategoryIcon } from "@/lib/business-type-config"
import { usePwaModeCtx } from "@/contexts/pwa-mode-context"
import { usePwaAppearance } from "@/contexts/pwa-appearance-context"

// ── Types ──────────────────────────────────────────────────────────────────

export interface StorefrontCategory {
  id: string
  name: string
  slug: string
  image: string | null
  icon: string | null
  color: string | null
  productCount?: number
}

// ── Web card ───────────────────────────────────────────────────────────────

interface StorefrontCategoryCardProps {
  category:     StorefrontCategory
  brandColor:   string
  businessType: string
  onClick:      () => void
  showCount?:   boolean
}

export function StorefrontCategoryCard({
  category,
  brandColor,
  businessType,
  onClick,
  showCount = false,
}: StorefrontCategoryCardProps) {
  const isPwa = usePwaModeCtx()
  const { categoryStyle } = usePwaAppearance()

  const tileColor   = category.color ? `${category.color}1a` : `${brandColor}12`
  const iconFallback = category.icon || getCategoryIcon(businessType, category.name)
  const imgSrc       = category.image ? resolveImageUrl(category.image) : null

  // ── PWA: compact 72px scroll chip (horizontal strip) ─────────────────────
  if (isPwa) {
    const pwaTileBg    = imgSrc ? "transparent" : "white"
    const pwaBorderClr = category.color ? `${category.color}80` : `${brandColor}60`
    // categoryStyle: "rounded" = rounded-xl (default), "circle" = rounded-full
    const tileRadius = categoryStyle === "circle" ? "rounded-full" : "rounded-xl"

    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-1.5 shrink-0 active:scale-[0.91] transition-transform duration-100 group"
      >
        <div
          className={`${tileRadius} flex items-center justify-center overflow-hidden border-[1.5px] transition-colors`}
          style={{ backgroundColor: pwaTileBg, borderColor: pwaBorderClr, width: 72, height: 72 }}
        >
          {imgSrc ? (
            <img src={imgSrc} alt={category.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[26px] leading-none">{iconFallback}</span>
          )}
        </div>
        <span
          className="text-[11px] font-semibold text-gray-800 text-center leading-tight line-clamp-2"
          style={{ width: 72 }}
        >
          {category.name}
        </span>
        {showCount && typeof category.productCount === "number" && (
          <span className="text-[10px] text-gray-400 -mt-1">{category.productCount} items</span>
        )}
      </button>
    )
  }

  // ── Web: Blinkit-style full-width square card ─────────────────────────────
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 w-full group active:scale-95 transition-transform duration-100"
    >
      {/* Square image — fills the grid column; height = width via aspect-square */}
      <div
        className="w-full aspect-square rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-150 group-hover:scale-[1.04] group-hover:shadow-md"
        style={{ backgroundColor: tileColor }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={category.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl sm:text-4xl leading-none select-none">{iconFallback}</span>
        )}
      </div>

      {/* Label */}
      <span className="text-[11px] sm:text-[12px] font-semibold text-gray-800 text-center leading-tight line-clamp-2 w-full px-0.5">
        {category.name}
      </span>

      {showCount && typeof category.productCount === "number" && (
        <span className="text-[10px] text-gray-400 -mt-0.5">{category.productCount} items</span>
      )}
    </button>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────

export function StorefrontCategoryCardSkeleton() {
  const isPwa = usePwaModeCtx()

  if (isPwa) {
    return (
      <div className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
        <div className="rounded-xl bg-gray-100" style={{ width: 72, height: 72 }} />
        <div className="h-2.5 bg-gray-100 rounded" style={{ width: 72 }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5 w-full animate-pulse">
      <div className="w-full aspect-square rounded-2xl bg-gray-100" />
      <div className="h-2.5 bg-gray-100 rounded w-3/4" />
    </div>
  )
}
