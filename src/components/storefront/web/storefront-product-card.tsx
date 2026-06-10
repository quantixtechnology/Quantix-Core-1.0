"use client"

// ============================================================================
// StorefrontProductCard — Material 3 elevated card.
//
// Zone 1 — IMAGE   shrink-0  aspect-[4/3] with rounded top corners
// Zone 2 — INFO    flex-1    name (2 lines) · variant/desc · price row
// Zone 3 — ACTION  shrink-0  round ADD button or stepper (always visible)
//
// Business brand color flows through brandColor prop — no hardcoded values.
// ============================================================================

import { useCartStore } from "@/stores/cart-store"
import { useAdminStore } from "@/stores/admin-store"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { resolveImageUrl } from "@/lib/image-url"
import { formatINR } from "@/lib/currency"
import { Plus, Minus } from "lucide-react"
import { ProductImage } from "./product-image"
import type { WebNav } from "./storefront-website"
import { getCardClasses, TYPE } from "@/design-system"
import { usePwaModeCtx } from "@/contexts/pwa-mode-context"

// ── Shared types ───────────────────────────────────────────────────────────

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

// ── Skeleton ───────────────────────────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden animate-pulse shadow-sm border border-gray-100">
      <div className="w-full aspect-[4/3] bg-gray-100" />
      <div className="p-2.5 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="w-8 h-8 bg-gray-100 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ── Fallback emoji ─────────────────────────────────────────────────────────

function defaultEmojiFor(businessType: string): string {
  switch (businessType) {
    case "MEAT_DELIVERY": return "🥩"
    case "GROCERY":       return "🛒"
    case "FOOD_DELIVERY": return "🍽️"
    case "PHARMACY":      return "💊"
    default:              return "📦"
  }
}

// ── Card ───────────────────────────────────────────────────────────────────

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
  const isPwa = usePwaModeCtx()
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const { currentImageConfig, currentBusinessTheme } = useAdminStore()
  const btConfig = getBusinessTypeConfig(businessType)

  const images = Array.isArray(product.images) ? product.images : []
  const meta   = product.metadata && typeof product.metadata === "object" ? product.metadata : {}
  const imgSrc = resolveImageUrl(images[0])
  const emoji  = defaultEmojiFor(businessType)

  const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
  const price       = defaultVariant?.price ?? 0
  const mrp         = defaultVariant?.mrp   ?? 0
  const hasDiscount = mrp > price && mrp > 0
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0

  const cartItem = defaultVariant
    ? items.find((i) => i.productId === product.id && i.variantId === defaultVariant.id)
    : undefined

  const showHalal    = btConfig.productMeta.some((m) => m.key === "isHalal"      && m.showOnCard)
  const showFresh    = btConfig.productMeta.some((m) => m.key === "freshnessTag" && m.showOnCard)
  const isOutOfStock = product.hasInventory && product.stockStatus === "OUT_OF_STOCK"

  // ── Cart handlers (UNCHANGED) ──────────────────────────────────────────
  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation()
    if (!defaultVariant || isOutOfStock || storeClosed) return
    addItem({
      productId:   product.id,
      variantId:   defaultVariant.id,
      name:        product.name,
      variantName: defaultVariant.name !== "Default" ? defaultVariant.name : "",
      price:       defaultVariant.price,
      mrp:         defaultVariant.mrp,
      quantity:    1,
      image:       imgSrc || "",
      isVeg:       product.isVeg ?? null,
    })
  }

  function handleIncrease(e: React.MouseEvent) {
    e.stopPropagation()
    if (!cartItem || !defaultVariant) return
    updateQuantity(product.id, defaultVariant.id, cartItem.quantity + 1)
  }

  function handleDecrease(e: React.MouseEvent) {
    e.stopPropagation()
    if (!cartItem || !defaultVariant) return
    if (cartItem.quantity <= 1) removeItem(product.id, defaultVariant.id)
    else updateQuantity(product.id, defaultVariant.id, cartItem.quantity - 1)
  }

  // ── PWA: Blinkit-style card ─────────────────────────────────────────────
  if (isPwa) {
    return (
      <div
        className="bg-white rounded-2xl overflow-hidden cursor-pointer border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.04)] active:scale-[0.985] transition-transform duration-150 flex flex-col"
        onClick={() => nav.go("product", { productId: product.id })}
      >
        {/* Image */}
        <div className="relative shrink-0 overflow-hidden w-full aspect-[4/3] bg-gray-50">
          <ProductImage src={imgSrc} alt={product.name} fallbackEmoji={emoji} className="w-full h-full" config={currentImageConfig} />
          <div className="absolute top-1.5 left-1.5 flex gap-1 flex-wrap max-w-[calc(100%-12px)]">
            {isOutOfStock ? (
              <span className="px-1.5 py-0.5 bg-gray-700/80 backdrop-blur-sm text-white text-[8px] font-bold rounded-md tracking-wide">SOLD OUT</span>
            ) : (
              <>
                {product.isVeg === true && <span className="px-1.5 py-0.5 bg-green-500 text-white text-[8px] font-bold rounded-md">VEG</span>}
                {product.isVeg === false && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded-md">NON-VEG</span>}
                {showHalal && !!meta.isHalal && <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] font-bold rounded-md">HALAL</span>}
              </>
            )}
          </div>
          {hasDiscount && !isOutOfStock && (
            <span
              className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-white text-[8px] font-bold rounded-md"
              style={{ backgroundColor: brandColor }}
            >
              {discountPct}% OFF
            </span>
          )}
          {showFresh && !!meta.freshnessTag && !hasDiscount && (
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm text-[8px] font-semibold text-gray-700 rounded-md border border-gray-200">
              {String(meta.freshnessTag)}
            </div>
          )}
        </div>

        {/* Info + Price + Action — price and action are always separate rows */}
        <div className="flex flex-col px-2.5 pt-2 pb-2.5" style={{ minHeight: 96 }}>
          {/* Name */}
          <p className="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2">
            {product.name}
          </p>

          {/* Unit / variant */}
          {defaultVariant && defaultVariant.name !== "Default" ? (
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{defaultVariant.name}</p>
          ) : product.shortDesc ? (
            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{product.shortDesc}</p>
          ) : null}

          {/* Spacer — pushes price+action to bottom */}
          <div className="flex-1" />

          {/* Price row — always its own row */}
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-[15px] font-bold leading-none" style={{ color: brandColor }}>
              {formatINR(price)}
            </span>
            {hasDiscount && (
              <span className="text-[10px] text-gray-400 line-through leading-none">
                {formatINR(mrp)}
              </span>
            )}
          </div>

          {/* Action row — always its own row, full width, never shares with price */}
          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
            {(isOutOfStock || storeClosed) ? (
              <div className="w-full h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                  {isOutOfStock ? "Sold Out" : "Closed"}
                </span>
              </div>
            ) : cartItem ? (
              <div
                className="flex items-center h-8 rounded-xl border-[1.5px] bg-white select-none"
                style={{ borderColor: brandColor }}
              >
                <button
                  onClick={handleDecrease}
                  className="flex-1 h-full flex items-center justify-center active:opacity-60"
                  style={{ color: brandColor }}
                >
                  <Minus className="w-[10px] h-[10px]" strokeWidth={2.5} />
                </button>
                <span className="w-6 text-center text-[12px] font-bold" style={{ color: brandColor }}>
                  {cartItem.quantity}
                </span>
                <button
                  onClick={handleIncrease}
                  className="flex-1 h-full flex items-center justify-center active:opacity-60"
                  style={{ color: brandColor }}
                >
                  <Plus className="w-[10px] h-[10px]" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className="w-full h-8 rounded-xl border-[1.5px] flex items-center justify-center gap-1 active:opacity-70 transition-opacity"
                style={{ borderColor: brandColor, color: brandColor, backgroundColor: `${brandColor}08` }}
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus className="w-3 h-3" strokeWidth={2.5} />
                <span className="text-[11px] font-bold tracking-wide">ADD</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Web card ────────────────────────────────────────────────────────────
  return (
    <div
      className="bg-white rounded-2xl overflow-hidden cursor-pointer border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] active:scale-[0.985] transition-all duration-200 flex flex-col"
      onClick={() => nav.go("product", { productId: product.id })}
    >

      {/* ── Zone 1: IMAGE ───────────────────────────────────────────── */}
      <div className="relative shrink-0 overflow-hidden w-full aspect-[4/3] bg-gray-50">
        <ProductImage
          src={imgSrc}
          alt={product.name}
          fallbackEmoji={emoji}
          className="w-full h-full"
          config={currentImageConfig}
        />

        {/* Top-left badges */}
        <div className="absolute top-1.5 left-1.5 flex gap-1 flex-wrap max-w-[calc(100%-12px)]">
          {isOutOfStock ? (
            <span className="px-1.5 py-0.5 bg-gray-700/80 backdrop-blur-sm text-white text-[9px] font-bold rounded-full">
              OUT OF STOCK
            </span>
          ) : (
            <>
              {product.isVeg === true && (
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

        {/* Freshness tag — top-right */}
        {showFresh && !!meta.freshnessTag && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm text-[9px] font-semibold text-gray-700 rounded-full border border-gray-200">
            {String(meta.freshnessTag)}
          </div>
        )}
      </div>

      {/* ── Zone 2: INFO ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-2.5 pt-2 pb-0 min-h-0">
        <p className="text-[12px] font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2.2em]">
          {product.name}
        </p>

        {defaultVariant && defaultVariant.name !== "Default" ? (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{defaultVariant.name}</p>
        ) : product.shortDesc ? (
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{product.shortDesc}</p>
        ) : null}
      </div>

      {/* ── Zone 3: PRICE + ACTION ────────────────────────────────── */}
      <div className="shrink-0 px-2.5 pb-2.5 pt-1.5 flex items-center justify-between gap-1">
        {/* Price */}
        <div className="flex items-baseline gap-1 flex-wrap min-w-0">
          <span className="text-[13px] font-bold" style={{ color: brandColor }}>
            {formatINR(price)}
          </span>
          {hasDiscount && (
            <span className="text-[10px] text-gray-400 line-through">{formatINR(mrp)}</span>
          )}
        </div>

        {/* Action: out of stock / store closed */}
        {(isOutOfStock || storeClosed) && (
          <div className="h-7 px-2 flex items-center justify-center rounded-xl bg-gray-100">
            <span className="text-[10px] font-semibold text-gray-400 select-none whitespace-nowrap">
              {isOutOfStock ? "Out of Stock" : "Closed"}
            </span>
          </div>
        )}

        {/* Action: in cart → compact stepper */}
        {!isOutOfStock && !storeClosed && cartItem && (
          <div
            className="flex items-center h-7 rounded-xl overflow-hidden select-none shrink-0"
            style={{ backgroundColor: brandColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDecrease}
              className="w-7 h-full flex items-center justify-center text-white active:opacity-70"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-[12px] font-bold text-white">
              {cartItem.quantity}
            </span>
            <button
              onClick={handleIncrease}
              className="w-7 h-full flex items-center justify-center text-white active:opacity-70"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Action: not in cart → round ADD pill */}
        {!isOutOfStock && !storeClosed && !cartItem && (
          <button
            onClick={handleAdd}
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform border-2"
            style={{ borderColor: brandColor, color: brandColor, backgroundColor: `${brandColor}10` }}
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
