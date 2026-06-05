"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { resolveImageUrl } from "@/lib/image-url"
import { formatINR } from "@/lib/currency"
import {
  ChevronLeft, ChevronRight, ShoppingCart, Plus, Minus,
  Check, Package, ChevronDown,
} from "lucide-react"
import type { WebNav } from "./storefront-website"
import { ProductImage } from "./product-image"
import { usePwaMode } from "@/hooks/use-pwa-mode"

interface Variant {
  id: string
  name: string
  price: number
  mrp: number
  discountPrice: number | null
  discountPercent: number | null
  isDefault: boolean
  isActive: boolean
  sku: string | null
  attributes: string
}

interface ProductDetail {
  id: string
  name: string
  description: string | null
  shortDesc: string | null
  images: string[]
  isVeg: boolean | null
  isFeatured: boolean
  unit: string | null
  unitQuantity: number | null
  preparationTime: number | null
  minOrderQty: number
  maxOrderQty: number
  metadata: Record<string, unknown>
  variants: Variant[]
  category: { id: string; name: string; slug: string } | null
  stockStatus: string
  availableStock: number
  hasInventory: boolean
}

interface StorefrontProductPageProps {
  brandColor: string
  nav: WebNav
}

function getDefaultProductEmoji(businessType: string): string {
  switch (businessType) {
    case "MEAT_DELIVERY":  return "🥩"
    case "GROCERY":        return "🛒"
    case "FOOD_DELIVERY":  return "🍽️"
    case "PHARMACY":       return "💊"
    default:               return "📦"
  }
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonProduct({ isPwa }: { isPwa: boolean }) {
  if (isPwa) {
    return (
      <div className="animate-pulse">
        <div className="w-full aspect-[4/3] bg-gray-100" />
        <div className="px-4 pt-4 space-y-3">
          <div className="h-6 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
        </div>
      </div>
    )
  }
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl bg-gray-100" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="w-20 h-20 rounded-xl bg-gray-100" />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-7 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
          <div className="h-12 bg-gray-100 rounded w-full mt-6" />
        </div>
      </div>
    </div>
  )
}

// ── Option chip helper ──────────────────────────────────────────────────────
function OptionChip({
  label, selected, onClick, brandColor,
}: { label: string; selected: boolean; onClick: () => void; brandColor: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm rounded-xl border-2 transition-all flex items-center gap-1.5"
      style={
        selected
          ? { backgroundColor: brandColor, borderColor: brandColor, color: "#fff" }
          : { borderColor: "#E5E7EB", color: "#374151" }
      }
    >
      {selected && <Check className="w-3 h-3" />}
      {label}
    </button>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export function StorefrontProductPage({ brandColor, nav }: StorefrontProductPageProps) {
  const { currentBusinessId, currentBusinessType, currentStoreId } = useAdminStore()
  const { addItem, items, updateQuantity } = useCartStore()
  const isPwa = usePwaMode()

  const config   = getBusinessTypeConfig(currentBusinessType)
  const checkout = config.checkoutOptions

  const showHalal = config.productMeta.some((m) => m.key === "isHalal"      && m.showOnDetail)
  const showFresh = config.productMeta.some((m) => m.key === "freshnessTag" && m.showOnDetail)

  const [product, setProduct]                     = useState<ProductDetail | null>(null)
  const [loading, setLoading]                     = useState(true)
  const [notFound, setNotFound]                   = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [activeImage, setActiveImage]             = useState(0)
  const [qty, setQty]                             = useState(1)
  const [selectedCutType, setSelectedCutType]     = useState<string | null>(null)
  const [selectedCleaning, setSelectedCleaning]   = useState<string | null>(null)
  const [selectedMarinade, setSelectedMarinade]   = useState<string | null>(null)
  const [addedToCart, setAddedToCart]             = useState(false)
  const [descExpanded, setDescExpanded]           = useState(false)

  // ── Data fetching — UNCHANGED ──────────────────────────────────────────
  useEffect(() => {
    if (!nav.productId || !currentBusinessId) return
    setLoading(true)
    setNotFound(false)
    setProduct(null)

    const params = new URLSearchParams({ businessId: currentBusinessId, limit: "100" })
    if (currentStoreId) params.set("storeId", currentStoreId)

    fetch(`/api/core/storefront/products?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) { setNotFound(true); return }
        const prods: ProductDetail[] = Array.isArray(j.data) ? j.data : []
        const found = prods.find((p) => p.id === nav.productId)
        console.log("[StorefrontProduct] lookup", {
          productId:    nav.productId,
          businessId:   currentBusinessId,
          businessType: currentBusinessType,
          foundInBatch: !!found,
          totalInBatch: prods.length,
        })
        if (!found) { setNotFound(true); return }
        setProduct(found)
        const defaultVar = found.variants.find((v) => v.isDefault) || found.variants[0]
        if (defaultVar) setSelectedVariantId(defaultVar.id)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.productId, currentBusinessId])

  if (loading) return <SkeletonProduct isPwa={isPwa} />

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <Package className="w-14 h-14 text-gray-200" />
        <h2 className="text-xl font-bold text-gray-800">Product not found</h2>
        <p className="text-sm text-gray-500">This product may no longer be available.</p>
        <button
          onClick={() => nav.go("category")}
          className="mt-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
          style={{ backgroundColor: brandColor }}
        >
          Browse Products
        </button>
      </div>
    )
  }

  const images         = Array.isArray(product.images) ? product.images : []
  const resolvedImages = images.map(resolveImageUrl).filter(Boolean)
  const meta           = (product.metadata && typeof product.metadata === "object") ? product.metadata : {}

  const cutTypes        = checkout.showCutType  ? ((meta.cutTypes        as string[] | undefined) || []) : []
  const cleaningOptions = checkout.showCleaning ? ((meta.cleaningOptions as string[] | undefined) || []) : []
  const marinades       = checkout.showMarinade ? ((meta.marinade        as string[] | undefined) || []) : []

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId)
    || product.variants.find((v) => v.isDefault)
    || product.variants[0]

  const price       = selectedVariant?.price ?? 0
  const mrp         = selectedVariant?.mrp   ?? 0
  const hasDiscount = mrp > price && mrp > 0
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0

  const cartItem    = selectedVariant
    ? items.find((i) => i.productId === product.id && i.variantId === selectedVariant.id)
    : undefined

  const isOutOfStock = product.hasInventory && product.stockStatus === "OUT_OF_STOCK"
  const activeVariants = product.variants.filter((v) => v.isActive)

  const handleAddToCart = () => {
    if (!selectedVariant || isOutOfStock) return
    if (cartItem) {
      updateQuantity(product.id, selectedVariant.id, cartItem.quantity + qty)
    } else {
      addItem({
        productId:   product.id,
        variantId:   selectedVariant.id,
        name:        product.name,
        variantName: selectedVariant.name !== "Default" ? selectedVariant.name : "",
        price:       selectedVariant.price,
        mrp:         selectedVariant.mrp,
        quantity:    qty,
        image:       resolvedImages[0] || "",
        isVeg:       product.isVeg ?? false,
      })
    }
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const defaultEmoji = getDefaultProductEmoji(currentBusinessType)

  // ── Shared product info section (used by both PWA and web layouts) ─────
  const ProductInfo = (
    <div className="flex flex-col">
      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {product.isVeg === true && (
          <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">🌿 VEG</span>
        )}
        {product.isVeg === false && (
          <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100">🍖 NON-VEG</span>
        )}
        {showHalal && !!meta.isHalal && (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100">✓ HALAL</span>
        )}
        {showFresh && !!meta.freshnessTag && (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100">
            ⭐ {String(meta.freshnessTag)}
          </span>
        )}
      </div>

      <h1 className={`font-bold text-gray-900 leading-snug mb-1 ${isPwa ? "text-xl" : "text-2xl sm:text-3xl"}`}>
        {product.name}
      </h1>

      {product.shortDesc && (
        <p className="text-sm text-gray-500 mb-3 leading-relaxed">{product.shortDesc}</p>
      )}

      {selectedVariant && selectedVariant.name !== "Default" && activeVariants.length === 1 && (
        <p className="text-sm font-medium text-gray-600 mb-2">{selectedVariant.name}</p>
      )}

      {/* Price */}
      <div className="flex items-baseline gap-2.5 mb-1 flex-wrap">
        <span className={`font-extrabold ${isPwa ? "text-2xl" : "text-3xl"}`} style={{ color: brandColor }}>
          {formatINR(price)}
        </span>
        {hasDiscount && (
          <>
            <span className="text-base text-gray-400 line-through">{formatINR(mrp)}</span>
            <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: brandColor }}>
              {discountPct}% OFF
            </span>
          </>
        )}
      </div>

      {product.unit && (
        <p className="text-xs text-gray-400 mb-4">
          per {product.unitQuantity ? `${product.unitQuantity} ` : ""}{product.unit}
        </p>
      )}

      {/* Variants */}
      {activeVariants.length > 1 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Size / Weight</p>
          <div className="flex flex-wrap gap-2">
            {activeVariants.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariantId(v.id)}
                className="px-3.5 py-2 text-sm font-medium rounded-xl border-2 transition-all"
                style={
                  selectedVariantId === v.id
                    ? { backgroundColor: brandColor, borderColor: brandColor, color: "#fff" }
                    : { borderColor: "#E5E7EB", color: "#374151" }
                }
              >
                {v.name}
                {v.price !== price && <span className="ml-1 opacity-80 text-xs">· {formatINR(v.price)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cut type / Cleaning / Marinade */}
      {cutTypes.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cut Type</p>
          <div className="flex flex-wrap gap-2">
            {cutTypes.map((cut) => (
              <OptionChip
                key={cut}
                label={cut}
                selected={selectedCutType === cut}
                onClick={() => setSelectedCutType(selectedCutType === cut ? null : cut)}
                brandColor={brandColor}
              />
            ))}
          </div>
        </div>
      )}

      {cleaningOptions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cleaning</p>
          <div className="flex flex-wrap gap-2">
            {cleaningOptions.map((opt) => (
              <OptionChip
                key={opt}
                label={opt}
                selected={selectedCleaning === opt}
                onClick={() => setSelectedCleaning(selectedCleaning === opt ? null : opt)}
                brandColor={brandColor}
              />
            ))}
          </div>
        </div>
      )}

      {marinades.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Marinade</p>
          <div className="flex flex-wrap gap-2">
            {marinades.map((m) => (
              <OptionChip
                key={m}
                label={m}
                selected={selectedMarinade === m}
                onClick={() => setSelectedMarinade(selectedMarinade === m ? null : m)}
                brandColor={brandColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Meta: info cards on web, inline text rows on PWA */}
      {!isPwa ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {product.preparationTime && (
            <div className="px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Prep Time</p>
              <p className="text-xs font-semibold text-gray-800">{product.preparationTime} min</p>
            </div>
          )}
          {product.category && (
            <div className="px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Category</p>
              <p className="text-xs font-semibold text-gray-800">{product.category.name}</p>
            </div>
          )}
          <div className="px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400">Min Order</p>
            <p className="text-xs font-semibold text-gray-800">{product.minOrderQty} {product.unit || "unit"}</p>
          </div>
        </div>
      ) : (product.preparationTime || product.category) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[12px] text-gray-500">
          {product.preparationTime && <span>⏱ {product.preparationTime} min prep</span>}
          {product.category && <span>· {product.category.name}</span>}
        </div>
      )}

      {/* Description — collapsible in PWA, always shown on web */}
      {product.description && (
        <div className="mb-4">
          {isPwa ? (
            <>
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="flex items-center justify-between w-full text-sm font-bold text-gray-900 mb-1"
              >
                <span>Description</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${descExpanded ? "rotate-180" : ""}`} />
              </button>
              {descExpanded && (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // PWA PRODUCT PAGE — edge-to-edge hero + overlay back + sticky bottom bar
  // ══════════════════════════════════════════════════════════════════════
  if (isPwa) {
    return (
      <div className="relative pb-[80px]">
        {/* Overlay back button */}
        <button
          onClick={() => nav.goBack("category")}
          className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full bg-white/85 backdrop-blur-md shadow flex items-center justify-center active:opacity-70"
        >
          <ChevronLeft className="w-5 h-5 text-gray-800" />
        </button>

        {/* Hero image — edge-to-edge, 45% viewport height */}
        <div className="relative w-full bg-gray-50 overflow-hidden" style={{ height: "45vh" }}>
          <ProductImage
            src={resolvedImages[activeImage]}
            alt={product.name}
            fallbackEmoji={defaultEmoji}
            className="w-full h-full"
          />
        </div>

        {/* Thumbnail strip */}
        {resolvedImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 pt-3 pb-1">
            {resolvedImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  activeImage === i ? "" : "border-transparent opacity-60"
                }`}
                style={activeImage === i ? { borderColor: brandColor } : {}}
              >
                <ProductImage src={img} alt={`view ${i + 1}`} className="w-full h-full" />
              </button>
            ))}
          </div>
        )}

        {/* Product info */}
        <div className="px-4 pt-4">
          {ProductInfo}
        </div>

        {/* Sticky bottom CTA bar */}
        <div
          className="fixed bottom-[64px] inset-x-0 z-30 bg-white border-t border-gray-100 px-4 py-3"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
        >
          {isOutOfStock ? (
            <div className="h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
              <span className="text-sm font-bold text-gray-500">Out of Stock</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center rounded-2xl overflow-hidden h-12 border-2"
                style={{ borderColor: brandColor }}
              >
                <button
                  onClick={() => setQty((q) => Math.max(product.minOrderQty || 1, q - 1))}
                  className="w-11 h-full flex items-center justify-center active:opacity-60"
                  style={{ color: brandColor }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-9 text-center text-base font-bold" style={{ color: brandColor }}>
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(product.maxOrderQty || 100, q + 1))}
                  className="w-11 h-full flex items-center justify-center active:opacity-60"
                  style={{ color: brandColor }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-1 h-12 font-bold text-sm text-white rounded-2xl flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                style={{ backgroundColor: brandColor }}
              >
                {addedToCart ? (
                  <><Check className="w-5 h-5" /> Added!</>
                ) : (
                  <><ShoppingCart className="w-[18px] h-[18px]" /> {config.labels.addToCart} · {formatINR(price * qty)}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // WEB PRODUCT PAGE — breadcrumb + side-by-side layout + inline CTA
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 flex-wrap">
        <button onClick={() => nav.go("home")} className="hover:text-gray-900 transition-colors">Home</button>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <button
          onClick={() => nav.go("category", product.category
            ? { categoryId: product.category.id, categoryName: product.category.name }
            : { categoryId: undefined, categoryName: "All Products" })}
          className="hover:text-gray-900 transition-colors"
        >
          {product.category?.name || "Products"}
        </button>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Image gallery */}
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl overflow-hidden border border-gray-100">
            <ProductImage
              src={resolvedImages[activeImage]}
              alt={product.name}
              fallbackEmoji={defaultEmoji}
              className="w-full h-full"
            />
          </div>
          {resolvedImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {resolvedImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    activeImage === i ? "" : "border-transparent hover:border-gray-300"
                  }`}
                  style={activeImage === i ? { borderColor: brandColor } : {}}
                >
                  <ProductImage src={img} alt={`view ${i + 1}`} className="w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info + inline CTA */}
        <div>
          {ProductInfo}

          {/* Qty + Add to Cart — inline on web */}
          <div className="flex items-center gap-3 mt-2 mb-6">
            {isOutOfStock ? (
              <div className="flex-1 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <span className="text-sm font-bold text-gray-500">Out of Stock</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl p-1">
                  <button
                    onClick={() => setQty((q) => Math.max(product.minOrderQty || 1, q - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="w-8 text-center text-base font-bold text-gray-900">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(product.maxOrderQty || 100, q + 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 h-12 font-bold text-sm text-white rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  {addedToCart ? (
                    <><Check className="w-5 h-5" /> Added to Cart!</>
                  ) : (
                    <><ShoppingCart className="w-5 h-5" /> {config.labels.addToCart} · {formatINR(price * qty)}</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
