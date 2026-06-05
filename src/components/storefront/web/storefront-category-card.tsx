"use client"

// ============================================================================
// StorefrontCategoryCard — compact circular/tile chip for horizontal scrolling.
//
// Used on the home screen category strip (horizontal scroll) and the full
// category grid page.  Two layouts:
//   default — stacked chip: circular icon tile + label below (use in scroll)
//   grid    — same visual, works in a grid container
// ============================================================================

import { resolveImageUrl } from "@/lib/image-url"
import { getCategoryIcon } from "@/lib/business-type-config"
import { usePwaMode } from "@/hooks/use-pwa-mode"

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

// ── Category card ──────────────────────────────────────────────────────────

interface StorefrontCategoryCardProps {
  category: StorefrontCategory
  brandColor: string
  businessType: string
  onClick: () => void
  showCount?: boolean
}

export function StorefrontCategoryCard({
  category,
  brandColor,
  businessType,
  onClick,
  showCount = false,
}: StorefrontCategoryCardProps) {
  const isPwa = usePwaMode()

  const tileColor = category.color
    ? `${category.color}20`
    : `${brandColor}15`

  const borderColor = category.color
    ? `${category.color}30`
    : `${brandColor}25`

  const iconFallback = category.icon || getCategoryIcon(businessType, category.name)
  const imgSrc       = category.image ? resolveImageUrl(category.image) : null

  const tileW = isPwa ? 76 : 60
  const tileH = isPwa ? 68 : 60
  const iconCls = isPwa ? "text-[28px]" : "text-[26px]"

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform duration-150 group"
    >
      {/* Tile */}
      <div
        className="rounded-2xl flex items-center justify-center overflow-hidden border-2 transition-all"
        style={{ backgroundColor: tileColor, borderColor, width: tileW, height: tileH }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={category.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`${iconCls} leading-none`}>{iconFallback}</span>
        )}
      </div>

      {/* Label */}
      <span
        className="text-[11px] font-medium text-gray-700 text-center leading-tight line-clamp-2"
        style={{ width: tileW }}
      >
        {category.name}
      </span>

      {/* Optional count badge */}
      {showCount && typeof category.productCount === "number" && (
        <span className="text-[10px] text-gray-400 -mt-1">
          {category.productCount} items
        </span>
      )}
    </button>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────

export function StorefrontCategoryCardSkeleton() {
  const isPwa = usePwaMode()
  const w = isPwa ? 76 : 60
  const h = isPwa ? 68 : 60
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
      <div className="rounded-2xl bg-gray-100" style={{ width: w, height: h }} />
      <div className="h-3 bg-gray-100 rounded" style={{ width: w }} />
    </div>
  )
}
