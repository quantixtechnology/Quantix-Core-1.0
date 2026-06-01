"use client"

// ============================================================================
// StorefrontProductCard — single shared product card for all listing surfaces.
//
// Replaces the duplicate ProductCard components that existed separately in
// storefront-home.tsx and storefront-category.tsx.
//
// Image zone height:  driven by useAdminStore().currentImageConfig — no h-28.
// Qty controls:       shows stepper when item is already in cart, + otherwise.
// Badges:             VEG / NON-VEG / HALAL / freshnessTag / discount — all
//                     gated by businessType config (no hard-coded business logic).
// ============================================================================

import { useCartStore } from "@/stores/cart-store"
import { useAdminStore } from "@/stores/admin-store"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { resolveImageUrl } from "@/lib/image-url"
import { formatINR } from "@/lib/currency"
import { Plus, Minus } from "lucide-react"
import { ProductImage } from "./product-image"
import type { WebNav } from "./storefront-website"
import { getCardClasses, TYPE, BTN_ICON, iconBtnStyle } from "@/design-system"

// ── Shared product type ───────────────────────────────────────────────────────
// This mirrors the storefront API shape and replaces the local interface that
// was duplicated in both home and category files.

export interface StorefrontVariant {
  id: string
  name: string
  price: number
  mrp: number
  isDefault: boolean
  stock?: number
  isActive?: boolean
  sku?: string
}

export interface StorefrontProduct {
  id: string
  name: string
  slug: string
  shortDesc: string | null
  description: string | null
  images: string[]
  variants: StorefrontVariant[]
  category?: { id: string; name: string } | null
  isVeg?: boolean | null
  isFeatured?: boolean
  isPopular?: boolean
  hasInventory: boolean
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK"
  metadata?: Record<string, unknown> | null
}

// ── Shared skeleton ───────────────────────────────────────────────────────────
// Exported so callers can render shimmer grids while data loads.

export function ProductCardSkeleton() {
  const { currentImageConfig, currentBusinessTheme } = useAdminStore()
  return (
    <div className={`${getCardClasses(currentBusinessTheme.cardStyle)} animate-pulse`}>
      <div className="bg-gray-100" style={{ height: currentImageConfig.cardHeight }} />
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/3 mt-2" />
      </div>
    </div>
  )
}

// ── Business-type emoji helper ────────────────────────────────────────────────

function defaultEmojiFor(businessType: string): string {
  switch (businessType) {
    case "MEAT_DELIVERY":  return "🥩"
    case "GROCERY":        return "🛒"
    case "FOOD_DELIVERY":  return "🍽️"
    case "PHARMACY":       return "💊"
    default:               return "📦"
  }
}

// ── Shared product card ───────────────────────────────────────────────────────

interface StorefrontProductCardProps {
  product: StorefrontProduct
  brandColor: string
  nav: WebNav
  businessType: string
  storeClosed?: boolean
}

export function StorefrontProductCard({
  product,
  brandColor,
  nav,
  businessType,
  storeClosed = false,
}: StorefrontProductCardProps) {
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const { currentImageConfig, currentBusinessTheme } = useAdminStore()
  const btConfig = getBusinessTypeConfig(businessType)

  const images = Array.isArray(product.images) ? product.images : []
  const meta   = product.metadata && typeof product.metadata === "object"
    ? product.metadata
    : {}
  const imgSrc = resolveImageUrl(images[0])

  const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
  const price = defaultVariant?.price ?? 0
  const mrp   = defaultVariant?.mrp   ?? 0
  const hasDiscount = mrp > price && mrp > 0
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0

  const cartItem = defaultVariant
    ? items.find((i) => i.productId === product.id && i.variantId === defaultVariant.id)
    : undefined

  const showHalal = btConfig.productMeta.some((m) => m.key === "isHalal"      && m.showOnCard)
  const showFresh = btConfig.productMeta.some((m) => m.key === "freshnessTag" && m.showOnCard)
  const emoji     = defaultEmojiFor(businessType)
  const isOutOfStock = product.hasInventory && product.stockStatus === "OUT_OF_STOCK"

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!defaultVariant || isOutOfStock) return
    addItem({
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      variantName: defaultVariant.name !== "Default" ? defaultVariant.name : "",
      price: defaultVariant.price,
      mrp: defaultVariant.mrp,
      quantity: 1,
      image: imgSrc || "",
      isVeg: product.isVeg ?? false,
    })
  }

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cartItem || !defaultVariant) return
    updateQuantity(product.id, defaultVariant.id, cartItem.quantity + 1)
  }

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cartItem || !defaultVariant) return
    if (cartItem.quantity <= 1) removeItem(product.id, defaultVariant.id)
    else updateQuantity(product.id, defaultVariant.id, cartItem.quantity - 1)
  }

  return (
    <div
      className={getCardClasses(currentBusinessTheme.cardStyle)}
      onClick={() => nav.go("product", { productId: product.id })}
    >
      {/* ── Fixed image zone — height driven by config, not a Tailwind class ── */}
      <div
        className="relative overflow-hidden"
        style={{ height: currentImageConfig.cardHeight }}
      >
        <ProductImage
          src={imgSrc}
          alt={product.name}
          fallbackEmoji={emoji}
          className="w-full h-full"
          config={currentImageConfig}
        />

        {/* ── Overlay badges ───────────────────────────────────────── */}
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap max-w-[calc(100%-0.5rem)]">
          {isOutOfStock ? (
            <span className="px-1.5 py-0.5 bg-gray-600 text-white text-[9px] font-bold rounded-full">
              OUT OF STOCK
            </span>
          ) : (
            <>
              {product.isVeg === true  && (
                <span className="px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">VEG</span>
              )}
              {product.isVeg === false && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">NON-VEG</span>
              )}
              {showHalal && !!meta.isHalal && (
                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full">HALAL</span>
              )}
              {hasDiscount && (
                <span
                  className="px-1.5 py-0.5 text-white text-[9px] font-bold rounded-full"
                  style={{ backgroundColor: brandColor }}
                >
                  {discountPct}% OFF
                </span>
              )}
            </>
          )}
        </div>

        {showFresh && !!meta.freshnessTag && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm text-[9px] font-semibold text-gray-700 rounded-full border border-gray-200">
            {String(meta.freshnessTag)}
          </div>
        )}
      </div>

      {/* ── Fixed info + action zone ──────────────────────────────── */}
      <div className="p-2">
        <p className={TYPE.CARD_NAME}>{product.name}</p>
        {defaultVariant && defaultVariant.name !== "Default" ? (
          <p className={TYPE.CARD_VARIANT}>{defaultVariant.name}</p>
        ) : product.shortDesc ? (
          <p className={TYPE.CARD_DESC}>{product.shortDesc}</p>
        ) : null}

        <div className="mt-1 flex items-center justify-between">
          {/* ── Price zone ─── */}
          <div>
            <span className={TYPE.PRICE_MAIN} style={{ color: brandColor }}>
              {formatINR(price)}
            </span>
            {hasDiscount && (
              <span className={TYPE.PRICE_STRIKE}>{formatINR(mrp)}</span>
            )}
          </div>

          {/* ── Action zone ── */}
          {isOutOfStock ? (
            <span className="text-[10px] font-semibold text-gray-400 shrink-0">Unavailable</span>
          ) : storeClosed ? (
            <span className="text-[10px] font-semibold text-gray-400 shrink-0">Closed</span>
          ) : cartItem ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={handleDecrease} className={`${BTN_ICON} border border-gray-200 hover:bg-gray-100`}>
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{cartItem.quantity}</span>
              <button onClick={handleIncrease} className={BTN_ICON} style={iconBtnStyle(brandColor)}>
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button onClick={handleAdd} className={`${BTN_ICON} shadow-sm`} style={iconBtnStyle(brandColor)}>
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
