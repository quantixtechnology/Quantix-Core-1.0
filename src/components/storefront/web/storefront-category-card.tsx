"use client"

// ============================================================================
// StorefrontCategoryCard + StorefrontCategoryCardSkeleton
//
// Extracted from storefront-home.tsx so every listing surface renders
// categories through a single component.  No page should contain its
// own category tile markup.
// ============================================================================

import { resolveImageUrl } from "@/lib/image-url"
import { getCategoryIcon } from "@/lib/business-type-config"
import { ANIM, TYPE } from "@/design-system"

// ── Types ─────────────────────────────────────────────────────────────────

export interface StorefrontCategory {
  id: string
  name: string
  slug: string
  image: string | null
  icon: string | null
  color: string | null
  productCount?: number
}

// ── Category card ─────────────────────────────────────────────────────────

interface StorefrontCategoryCardProps {
  category: StorefrontCategory
  brandColor: string
  businessType: string
  onClick: () => void
  /** Show product count badge (optional) */
  showCount?: boolean
}

export function StorefrontCategoryCard({
  category,
  brandColor,
  businessType,
  onClick,
  showCount = false,
}: StorefrontCategoryCardProps) {
  const bg = category.color
    ? `${category.color}20`
    : `${brandColor}18`

  const iconFallback = category.icon || getCategoryIcon(businessType, category.name)
  const imgSrc = category.image ? resolveImageUrl(category.image) : null

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 group ${ANIM.TRANSITION}`}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-gray-200 transition-all"
        style={{ backgroundColor: bg }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={category.name}
            loading="lazy"
            className="w-full h-full object-cover rounded-2xl"
          />
        ) : (
          <span className="text-2xl">{iconFallback}</span>
        )}
      </div>

      <span className={`${TYPE.NAV_LABEL} w-16`}>{category.name}</span>

      {showCount && typeof category.productCount === "number" && (
        <span className="text-[10px] text-gray-400 -mt-1">
          {category.productCount} items
        </span>
      )}
    </button>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────

export function StorefrontCategoryCardSkeleton() {
  return (
    <div className={`flex flex-col items-center gap-2 ${ANIM.SKELETON}`}>
      <div className="w-16 h-16 rounded-2xl bg-gray-100" />
      <div className="h-3 bg-gray-100 rounded w-14" />
    </div>
  )
}
