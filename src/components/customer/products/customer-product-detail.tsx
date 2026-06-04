"use client"

import React, { useState, useMemo, useEffect } from "react"
import { formatINR } from "@/lib/currency"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useProduct, useProducts } from "@/hooks/use-api"
import { setBusinessContext } from "@/lib/api-client"
import { getDemoProducts } from "@/lib/demo-data"
import { resolveImageUrl } from "@/lib/image-url"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/loading-states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft, Plus, Minus, Share2, Heart, Truck, Clock, ShieldCheck,
  Flame, Droplets, Scissors, Leaf, ChefHat, Sparkles,
} from "lucide-react"

// Meat-delivery metadata: these keys are stored in product.metadata JSON
interface MeatMeta {
  freshnessTag?: string          // e.g. "Farm Fresh Today"
  cleaningOptions?: string[]     // e.g. ["Full Clean", "With Skin", "Without Skin"]
  cutTypes?: string[]            // e.g. ["Whole", "Curry Cut", "Boneless", "Keema"]
  marinade?: string[]            // e.g. ["Plain", "Tandoori", "Pepper Garlic"]
  isHalal?: boolean
  isOrganic?: boolean
}

// Inline image with fallback
function ProductImage({ src, alt, catColor }: { src?: string; alt: string; catColor: string }) {
  const [error, setError] = useState(false)
  if (src && !error) {
    return (
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    )
  }
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${catColor}10` }}>
      <Leaf className="w-20 h-20 text-gray-200" />
    </div>
  )
}

// Single-select pill row for meat options
function OptionSelector({
  label,
  icon: Icon,
  options,
  value,
  onChange,
  brandColor,
}: {
  label: string
  icon: React.ElementType
  options: string[]
  value: string | null
  onChange: (v: string) => void
  brandColor: string
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <p className="text-xs font-semibold text-gray-600">{label}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={active
                ? { borderColor: brandColor, backgroundColor: `${brandColor}12`, color: brandColor }
                : { borderColor: '#e5e7eb', color: '#4b5563' }
              }
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CustomerProductDetail() {
  const {
    selectedProductId, setSelectedProductId, setCustomerPage, pushCustomerPage, popCustomerPage,
    currentBusinessType, currentBusinessId, currentBusinessPrimaryColor,
  } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#E53E3E"
  const { addItem, items, updateQuantity, removeItem } = useCartStore()

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [selectedCleaning, setSelectedCleaning] = useState<string | null>(null)
  const [selectedCutType, setSelectedCutType] = useState<string | null>(null)
  const [selectedMarinade, setSelectedMarinade] = useState<string | null>(null)

  const BIZ_ID = currentBusinessId || ""

  useEffect(() => {
    if (BIZ_ID) setBusinessContext(BIZ_ID)
  }, [BIZ_ID])

  const { data: productData, isLoading: productLoading, error: productError, refetch } = useProduct(selectedProductId || "")
  const { data: relatedData } = useProducts(BIZ_ID, { limit: 20 })

  const demoProduct = useMemo(() => {
    const allDemoProducts = getDemoProducts(currentBusinessType)
    const found = allDemoProducts.find((p) => p.id === selectedProductId)
    if (!found) return null
    return {
      id: found.id, name: found.name, categoryId: found.categoryId,
      category: found.category, status: found.status,
      isVeg: found.isVeg, isFeatured: found.isFeatured,
      images: found.image ? [found.image] : [],
      shortDesc: null as string | null, meta: null as MeatMeta | null,
      variants: found.variants.map((v) => ({
        id: v.id, name: v.name, price: v.price, mrp: v.mrp,
        stock: v.stock as number | undefined, isDefault: v.isDefault as boolean | undefined,
      })),
    }
  }, [currentBusinessType, selectedProductId])

  const apiProduct = useMemo(() => {
    if (!productData?.data) return null
    const p = productData.data as unknown as Record<string, unknown>
    let meta: MeatMeta | null = null
    try {
      const raw = p.metadata
      if (typeof raw === "string") meta = JSON.parse(raw) as MeatMeta
      else if (raw && typeof raw === "object") meta = raw as MeatMeta
    } catch { /* ignore */ }

    return {
      id: p.id as string, name: p.name as string,
      categoryId: (p.category as Record<string, string>)?.id || "",
      category: (p.category as Record<string, string>)?.name || "",
      status: p.status as string, isVeg: p.isVeg as boolean | null,
      isFeatured: p.isFeatured as boolean,
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
      shortDesc: p.shortDesc as string | null, meta,
      variants: Array.isArray(p.variants)
        ? (p.variants as Array<Record<string, unknown>>).map((v) => ({
            id: v.id as string, name: v.name as string,
            price: v.price as number, mrp: v.mrp as number,
            stock: v.stock as number | undefined, isDefault: v.isDefault as boolean | undefined,
          }))
        : [],
    }
  }, [productData])

  const product = demoProduct || apiProduct

  const activeVariant = useMemo(() => {
    if (!product) return null
    if (selectedVariantId) return product.variants.find((v) => v.id === selectedVariantId) || product.variants[0]
    return product.variants.find((v) => v.isDefault) || product.variants[0]
  }, [product, selectedVariantId])

  const meta = product?.meta
  const savings = activeVariant ? activeVariant.mrp - activeVariant.price : 0
  const savingsPercent = activeVariant ? Math.round((savings / activeVariant.mrp) * 100) : 0
  const cartItem = product && activeVariant
    ? items.find((i) => i.productId === product.id && i.variantId === activeVariant.id)
    : null
  const cartQty = cartItem?.quantity || 0
  const isOutOfStock = product?.status === "OUT_OF_STOCK" || (activeVariant?.stock !== undefined && activeVariant.stock === 0)

  const relatedProducts = useMemo(() => {
    if (!product) return []
    const demoRelated = getDemoProducts(currentBusinessType)
      .filter((p) => p.categoryId === product.categoryId && p.id !== product.id && p.status === "ACTIVE")
      .slice(0, 4)
      .map((p) => ({
        id: p.id, name: p.name, category: p.category,
        image: p.image || "",
        variants: p.variants.map((v) => ({
          id: v.id, name: v.name, price: v.price, mrp: v.mrp,
          isDefault: v.isDefault as boolean | undefined,
        })),
      }))
    if (demoRelated.length > 0) return demoRelated
    if (!relatedData?.data) return []
    const prods = (Array.isArray(relatedData.data) ? relatedData.data : []) as unknown as Record<string, unknown>[]
    return prods
      .filter((p) => {
        const catId = (p.category as Record<string, string>)?.id
        return catId === product.categoryId && p.id !== product.id && p.status === "ACTIVE"
      })
      .slice(0, 4)
      .map((p) => ({
        id: p.id as string, name: p.name as string,
        category: (p.category as Record<string, string>)?.name || "",
        image: Array.isArray(p.images) ? (p.images[0] as string || "") : "",
        variants: Array.isArray(p.variants)
          ? (p.variants as Array<Record<string, unknown>>).map((v) => ({
              id: v.id as string, name: v.name as string,
              price: v.price as number, mrp: v.mrp as number,
              isDefault: v.isDefault as boolean | undefined,
            }))
          : [],
      }))
  }, [product, relatedData, currentBusinessType])

  const buildOptionsLabel = () => {
    const parts: string[] = []
    if (selectedCutType) parts.push(selectedCutType)
    if (selectedCleaning) parts.push(selectedCleaning)
    if (selectedMarinade) parts.push(selectedMarinade)
    return parts.length > 0 ? ` (${parts.join(", ")})` : ""
  }

  const handleAddToCart = () => {
    if (!product || !activeVariant) return
    addItem({
      productId: product.id,
      variantId: activeVariant.id,
      name: product.name,
      variantName: `${activeVariant.name}${buildOptionsLabel()}`,
      price: activeVariant.price,
      mrp: activeVariant.mrp,
      image: product.images[0] || "",
      isVeg: product.isVeg ?? true,
    })
    setQuantity(1)
  }


  const handleBack = () => { setSelectedProductId(null); popCustomerPage() }
  const handleRelatedClick = (id: string) => {
    setSelectedProductId(id); setSelectedVariantId(null); setQuantity(1)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (productLoading) {
    return (
      <div className="pb-20">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <Skeleton className="w-9 h-9 rounded-full" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (productError || !product || !activeVariant) {
    return (
      <div className="pb-20">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        <ErrorState
          title="Product not found"
          description="This product may have been removed or is temporarily unavailable."
          onRetry={() => refetch()}
          className="py-20"
        />
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsWishlisted(!isWishlisted)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <Heart className={`w-5 h-5 ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <Share2 className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Product Image — taller for app-like immersion */}
      <div className="relative h-72 bg-gray-50 overflow-hidden">
        <ProductImage src={resolveImageUrl(product.images[0])} alt={product.name} catColor={brandColor} />
        {/* Veg / Non-veg indicator */}
        <div className="absolute top-3 left-3">
          <div className={`w-5 h-5 border-2 flex items-center justify-center rounded-sm bg-white ${product.isVeg ? "border-green-600" : "border-red-600"}`}>
            <div className={`w-3 h-3 rounded-full ${product.isVeg ? "bg-green-600" : "bg-red-600"}`} />
          </div>
        </div>
        {/* Freshness tag */}
        {meta?.freshnessTag && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="text-[11px] font-semibold text-gray-700">{meta.freshnessTag}</span>
          </div>
        )}
        {/* Halal / Organic badges */}
        {(meta?.isHalal || meta?.isOrganic) && (
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            {meta.isHalal && (
              <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HALAL</span>
            )}
            {meta.isOrganic && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ORGANIC</span>
            )}
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl border">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="px-4 pt-4">
        <Badge variant="outline" className="text-[10px] mb-1.5" style={{ borderColor: brandColor, color: brandColor }}>
          {product.category}
        </Badge>
        <h1 className="text-lg font-bold text-gray-900">{product.name}</h1>

        {product.shortDesc && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{product.shortDesc}</p>
        )}

        {/* Weight / Variant Selector */}
        {product.variants.length > 1 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Select Weight</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const active = variant.id === activeVariant.id
                return (
                  <button
                    key={variant.id}
                    onClick={() => { setSelectedVariantId(variant.id); setQuantity(1) }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={active ? { borderColor: brandColor, backgroundColor: `${brandColor}15`, color: brandColor } : undefined}
                  >
                    {variant.name}
                    <span className="ml-1 text-[10px] opacity-70">{formatINR(variant.price)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Meat-Specific Selectors */}
        {meta?.cutTypes && meta.cutTypes.length > 0 && (
          <OptionSelector
            label="Cut Type"
            icon={Scissors}
            options={meta.cutTypes}
            value={selectedCutType}
            onChange={setSelectedCutType}
            brandColor={brandColor}
          />
        )}
        {meta?.cleaningOptions && meta.cleaningOptions.length > 0 && (
          <OptionSelector
            label="Cleaning"
            icon={Droplets}
            options={meta.cleaningOptions}
            value={selectedCleaning}
            onChange={setSelectedCleaning}
            brandColor={brandColor}
          />
        )}
        {meta?.marinade && meta.marinade.length > 0 && (
          <OptionSelector
            label="Marinade"
            icon={ChefHat}
            options={meta.marinade}
            value={selectedMarinade}
            onChange={setSelectedMarinade}
            brandColor={brandColor}
          />
        )}

        {/* Price */}
        <div className="mt-4 flex items-end gap-2">
          <span className="text-2xl font-bold text-gray-900">{formatINR(activeVariant.price)}</span>
          {savings > 0 && (
            <>
              <span className="text-base text-gray-400 line-through">{formatINR(activeVariant.mrp)}</span>
              <Badge className="text-white text-[10px]" style={{ backgroundColor: brandColor }}>
                {savingsPercent}% OFF
              </Badge>
            </>
          )}
        </div>
        {savings > 0 && (
          <p className="text-xs font-medium mt-0.5" style={{ color: brandColor }}>
            You save {formatINR(savings)} on this item
          </p>
        )}

        {/* Stock status */}
        <div className="mt-2 flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${isOutOfStock ? "bg-red-500" : (activeVariant.stock !== undefined && activeVariant.stock < 10) ? "bg-amber-500" : ""}`}
            style={!isOutOfStock && !(activeVariant.stock !== undefined && activeVariant.stock < 10) ? { backgroundColor: brandColor } : undefined}
          />
          <span className="text-xs text-gray-500">
            {isOutOfStock ? "Out of stock" : (activeVariant.stock !== undefined && activeVariant.stock < 10) ? `Only ${activeVariant.stock} left` : "In Stock"}
          </span>
        </div>

        {/* Quantity Selector */}
        {!isOutOfStock && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500">Quantity</span>
            <div className="flex items-center gap-0 border border-gray-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40"
                disabled={quantity <= 1}
              >
                <Minus className="w-4 h-4 text-gray-500" />
              </button>
              <span className="w-10 h-9 flex items-center justify-center text-sm font-semibold border-x border-gray-200">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* Delivery Info Badges */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3">
            <Truck className="w-5 h-5" style={{ color: brandColor }} />
            <span className="text-[10px] text-gray-600 text-center">Free delivery above ₹500</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3">
            <Flame className="w-5 h-5" style={{ color: brandColor }} />
            <span className="text-[10px] text-gray-600 text-center">Same day fresh cuts</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3">
            <ShieldCheck className="w-5 h-5" style={{ color: brandColor }} />
            <span className="text-[10px] text-gray-600 text-center">Quality assured</span>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-3">You May Also Like</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {relatedProducts.map((rp) => {
                const rpVariant = rp.variants.find((v) => v.isDefault) || rp.variants[0]
                if (!rpVariant) return null
                return (
                  <button
                    key={rp.id}
                    onClick={() => handleRelatedClick(rp.id)}
                    className="flex-shrink-0 w-32 bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                  >
                    <div className="h-28 bg-gray-50 overflow-hidden">
                      {rp.image ? (
                        <img src={resolveImageUrl(rp.image)} alt={rp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Leaf className="w-8 h-8 text-gray-200" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-gray-800 line-clamp-1">{rp.name}</p>
                      <p className="text-[10px] text-gray-400">{rpVariant.name}</p>
                      <span className="text-xs font-bold">{formatINR(rpVariant.price)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Add to Cart — positioned above bottom nav with safe-area awareness */}
      {!isOutOfStock && (
        <div
          className="fixed left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 pt-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {cartQty === 0 ? (
            <Button
              onClick={handleAddToCart}
              className="w-full h-12 text-sm font-bold rounded-2xl text-white shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
              style={{ backgroundColor: brandColor }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Cart — {formatINR(activeVariant.price * quantity)}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-between rounded-2xl h-12 flex-1 px-2" style={{ backgroundColor: brandColor }}>
                <button
                  onClick={() =>
                    cartQty === 1
                      ? removeItem(product.id, activeVariant.id)
                      : updateQuantity(product.id, activeVariant.id, cartQty - 1)
                  }
                  className="w-9 h-9 flex items-center justify-center text-white"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-white">{cartQty} in cart</span>
                <button
                  onClick={() => updateQuantity(product.id, activeVariant.id, cartQty + 1)}
                  className="w-9 h-9 flex items-center justify-center text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <Button
                onClick={() => pushCustomerPage("cart")}
                className="h-12 px-5 text-sm font-bold rounded-2xl bg-gray-900 hover:bg-gray-800 text-white"
              >
                View Cart
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
