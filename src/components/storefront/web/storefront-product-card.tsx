"use client"

// ============================================================================
// StorefrontProductCard — rigid 3-zone layout, platform-wide.
//
// Zone 1 — IMAGE   shrink-0  fixed height (config.cardHeight)
// Zone 2 — INFO    flex-1    product name (2 lines max) · variant · price
// Zone 3 — ACTION  shrink-0  52 px  always visible, never pushed off-screen
//
// The card itself is flex-col so CSS grid stretches it to the tallest sibling,
// giving every row perfectly equal heights.
//
// Business theme colors flow in via brandColor — zero hardcoded values.
// All listing surfaces (home, category, search) inherit automatically.
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

// ── Shared product types ───────────────────────────────────────────────────────

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

// ── Skeleton ───────────────────────────────────────────────────────────────────

export function ProductCardSkeleton() {
  const { currentImageConfig, currentBusinessTheme } = useAdminStore()
  return (
    <div className={`${getCardClasses(currentBusinessTheme.cardStyle)} flex flex-col animate-pulse`}>
      {/* Zone 1 — image placeholder */}
      <div className="shrink-0 bg-gray-100" style={{ height: currentImageConfig.cardHeight }} />

      {/* Zone 2 — info placeholder */}
      <div className="flex-1 px-2.5 pt-2 pb-0 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="h-4 bg-gray-100 rounded w-1/3 mt-2" />
      </div>

      {/* Zone 3 — action placeholder */}
      <div className="shrink-0 px-2.5 pb-2.5 pt-1.5">
        <div className="h-9 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}

// ── Business-type fallback emoji ───────────────────────────────────────────────

function defaultEmojiFor(businessType: string): string {
  switch (businessType) {
    case "MEAT_DELIVERY":  return "🥩"
    case "GROCERY":        return "🛒"
    case "FOOD_DELIVERY":  return "🍽️"
    case "PHARMACY":       return "💊"
    default:               return "📦"
  }
}

// ── Card ───────────────────────────────────────────────────────────────────────

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

  // ── Cart handlers ──────────────────────────────────────────────────────────

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
      isVeg:       product.isVeg ?? false,
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`${getCardClasses(currentBusinessTheme.cardStyle)} flex flex-col`}
      onClick={() => nav.go("product", { productId: product.id })}
    >

      {/* ══════════════════════════════════════════════════════════════════
          Zone 1 — IMAGE
          shrink-0 · height driven by imageConfig.cardHeight
          Image never compressed, always object-contain on white bg.
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ height: currentImageConfig.cardHeight }}
      >
        <ProductImage
          src={imgSrc}
          alt={product.name}
          fallbackEmoji={emoji}
          className="w-full h-full"
          config={currentImageConfig}
        />

        {/* Overlay badges — top-left */}
        <div className="absolute top-1.5 left-1.5 flex gap-1 flex-wrap max-w-[calc(100%-0.75rem)]">
          {isOutOfStock ? (
            <span className="px-1.5 py-0.5 bg-gray-600/90 text-white text-[9px] font-bold rounded-full">
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

      {/* ══════════════════════════════════════════════════════════════════
          Zone 2 — INFO
          flex-1 · absorbs all remaining vertical space.
          Price is pushed to the bottom with mt-auto so it's always
          adjacent to the action zone regardless of name length.
      ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col px-2.5 pt-2 pb-0 min-h-0">
        {/* Product name — 2 lines max, never pushes action zone */}
        <p className={TYPE.CARD_NAME}>{product.name}</p>

        {/* Variant / short description */}
        {defaultVariant && defaultVariant.name !== "Default" ? (
          <p className={TYPE.CARD_VARIANT}>{defaultVariant.name}</p>
        ) : product.shortDesc ? (
          <p className={TYPE.CARD_DESC}>{product.shortDesc}</p>
        ) : null}

        {/* Price — mt-auto anchors it directly above the action zone */}
        <div className="mt-auto pt-1.5 flex items-baseline gap-1 flex-wrap">
          <span className={TYPE.PRICE_MAIN} style={{ color: brandColor }}>
            {formatINR(price)}
          </span>
          {hasDiscount && (
            <span className={TYPE.PRICE_STRIKE}>{formatINR(mrp)}</span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Zone 3 — ACTION
          shrink-0 · 52 px total (6 top + 36 button + 10 bottom).
          Physically impossible to push down — it is always the last
          flex item and the card is fixed to the grid row height.
      ══════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 px-2.5 pb-2.5 pt-1.5">

        {/* ── State: out of stock or store closed ── */}
        {(isOutOfStock || storeClosed) && (
          <div className="h-9 flex items-center justify-center rounded-xl bg-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 select-none">
              {isOutOfStock ? "Out of Stock" : "Store Closed"}
            </span>
          </div>
        )}

        {/* ── State: item in cart — full-width stepper ── */}
        {!isOutOfStock && !storeClosed && cartItem && (
          <div
            className="h-9 flex items-stretch rounded-xl overflow-hidden select-none"
            style={{ backgroundColor: brandColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDecrease}
              className="w-10 flex items-center justify-center shrink-0 text-white transition-opacity active:opacity-70 hover:opacity-90"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <span className="flex-1 flex items-center justify-center text-sm font-bold text-white">
              {cartItem.quantity}
            </span>

            <button
              onClick={handleIncrease}
              className="w-10 flex items-center justify-center shrink-0 text-white transition-opacity active:opacity-70 hover:opacity-90"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── State: not in cart — Add button ── */}
        {!isOutOfStock && !storeClosed && !cartItem && (
          <button
            onClick={handleAdd}
            className="w-full h-9 flex items-center justify-center gap-1.5 rounded-xl border-2 font-bold text-xs transition-all duration-150 active:scale-[0.97] hover:opacity-90 select-none"
            style={{ borderColor: brandColor, color: brandColor, backgroundColor: "white" }}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
            <span>Add</span>
          </button>
        )}
      </div>
    </div>
  )
}
