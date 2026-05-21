"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { ChevronRight, ShoppingCart, Plus, Minus, Star, Check, ArrowLeft } from "lucide-react"
import type { WebNav } from "./storefront-website"

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
  images: string
  isVeg: boolean | null
  isFeatured: boolean
  unit: string | null
  unitQuantity: number | null
  preparationTime: number | null
  minOrderQty: number
  maxOrderQty: number
  metadata: string
  variants: Variant[]
  category: { id: string; name: string; slug: string } | null
}

interface StorefrontProductPageProps {
  brandColor: string
  nav: WebNav
}

function SkeletonProduct() {
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
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
          <div className="h-12 bg-gray-100 rounded w-full mt-6" />
        </div>
      </div>
    </div>
  )
}

export function StorefrontProductPage({ brandColor, nav }: StorefrontProductPageProps) {
  const { currentBusinessId } = useAdminStore()
  const { addItem, items, updateQuantity, removeItem } = useCartStore()

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)

  // Meat metadata selectors
  const [selectedCutType, setSelectedCutType] = useState<string | null>(null)
  const [selectedCleaning, setSelectedCleaning] = useState<string | null>(null)
  const [selectedMarinade, setSelectedMarinade] = useState<string | null>(null)
  const [addedToCart, setAddedToCart] = useState(false)

  useEffect(() => {
    if (!nav.productId || !currentBusinessId) return
    setLoading(true)
    setNotFound(false)
    fetch(`/api/core/storefront/products?businessId=${currentBusinessId}&limit=100`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) { setNotFound(true); return }
        const prods: ProductDetail[] = j.data?.products || []
        const found = prods.find((p) => p.id === nav.productId)
        if (!found) { setNotFound(true); return }
        setProduct(found)
        const defaultVar = found.variants.find((v) => v.isDefault) || found.variants[0]
        if (defaultVar) setSelectedVariantId(defaultVar.id)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [nav.productId, currentBusinessId])

  if (loading) return <SkeletonProduct />

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="text-5xl">🔍</div>
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

  const images = (() => { try { return JSON.parse(product.images) as string[] } catch { return [] } })()
  const meta = (() => {
    try { return JSON.parse(product.metadata) as Record<string, unknown> } catch { return {} }
  })()

  const cutTypes = (meta.cutTypes as string[] | undefined) || []
  const cleaningOptions = (meta.cleaningOptions as string[] | undefined) || []
  const marinades = (meta.marinade as string[] | undefined) || []

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId)
    || product.variants.find((v) => v.isDefault)
    || product.variants[0]

  const price = selectedVariant?.price ?? 0
  const mrp = selectedVariant?.mrp ?? 0
  const hasDiscount = mrp > price && mrp > 0
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0

  const cartItem = selectedVariant
    ? items.find((i) => i.productId === product.id && i.variantId === selectedVariant.id)
    : undefined

  const handleAddToCart = () => {
    if (!selectedVariant) return
    if (cartItem) {
      updateQuantity(product.id, selectedVariant.id, cartItem.quantity + qty)
    } else {
      addItem({
        productId: product.id,
        variantId: selectedVariant.id,
        name: product.name,
        variantName: selectedVariant.name !== "Default" ? selectedVariant.name : "",
        price: selectedVariant.price,
        mrp: selectedVariant.mrp,
        quantity: qty,
        image: images[0] || "",
        isVeg: product.isVeg ?? false,
      })
    }
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <button onClick={() => nav.go("home")} className="hover:text-gray-900 transition-colors">Home</button>
        <ChevronRight className="w-3 h-3" />
        <button
          onClick={() => nav.go("category", product.category ? { categoryId: product.category.id, categoryName: product.category.name } : {})}
          className="hover:text-gray-900 transition-colors"
        >
          {product.category?.name || "Products"}
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* ── Image gallery ────────────────────────────────── */}
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
            {images[activeImage] ? (
              <img
                src={images[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">🥩</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    activeImage === i ? "border-gray-800" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <img src={img} alt={`view ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Product info ─────────────────────────────────── */}
        <div className="flex flex-col">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            {product.isVeg === true && (
              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">🌿 VEG</span>
            )}
            {product.isVeg === false && (
              <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">🍖 NON-VEG</span>
            )}
            {!!meta.isHalal && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">✓ HALAL</span>
            )}
            {!!meta.freshnessTag && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                ⭐ {String(meta.freshnessTag)}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>

          {product.shortDesc && (
            <p className="text-gray-500 text-sm mb-4">{product.shortDesc}</p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-extrabold" style={{ color: brandColor }}>
              ₹{price.toLocaleString("en-IN")}
            </span>
            {hasDiscount && (
              <>
                <span className="text-lg text-gray-400 line-through">₹{mrp.toLocaleString("en-IN")}</span>
                <span className="text-sm font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: brandColor }}>
                  {discountPct}% OFF
                </span>
              </>
            )}
          </div>

          {product.unit && (
            <p className="text-xs text-gray-500 -mt-4 mb-5">
              per {product.unitQuantity ? `${product.unitQuantity} ` : ""}{product.unit}
            </p>
          )}

          {/* Variants */}
          {product.variants.length > 1 && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Select Size / Weight</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.filter((v) => v.isActive).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all ${
                      selectedVariantId === v.id ? "border-current text-white" : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                    style={selectedVariantId === v.id ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                  >
                    {v.name}
                    {v.price !== price && <span className="ml-1 opacity-80">₹{v.price.toLocaleString("en-IN")}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cut Types */}
          {cutTypes.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Cut Type</p>
              <div className="flex flex-wrap gap-2">
                {cutTypes.map((cut) => (
                  <button
                    key={cut}
                    onClick={() => setSelectedCutType(selectedCutType === cut ? null : cut)}
                    className={`px-3 py-1.5 text-sm rounded-xl border-2 transition-all flex items-center gap-1.5 ${
                      selectedCutType === cut ? "border-current text-white" : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                    style={selectedCutType === cut ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                  >
                    {selectedCutType === cut && <Check className="w-3 h-3" />}
                    {cut}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cleaning Options */}
          {cleaningOptions.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Cleaning</p>
              <div className="flex flex-wrap gap-2">
                {cleaningOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedCleaning(selectedCleaning === opt ? null : opt)}
                    className={`px-3 py-1.5 text-sm rounded-xl border-2 transition-all flex items-center gap-1.5 ${
                      selectedCleaning === opt ? "border-current text-white" : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                    style={selectedCleaning === opt ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                  >
                    {selectedCleaning === opt && <Check className="w-3 h-3" />}
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Marinade */}
          {marinades.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Marinade</p>
              <div className="flex flex-wrap gap-2">
                {marinades.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMarinade(selectedMarinade === m ? null : m)}
                    className={`px-3 py-1.5 text-sm rounded-xl border-2 transition-all flex items-center gap-1.5 ${
                      selectedMarinade === m ? "border-current text-white" : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                    style={selectedMarinade === m ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                  >
                    {selectedMarinade === m && <Check className="w-3 h-3" />}
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-3 mt-2 mb-6">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl p-1">
              <button
                onClick={() => setQty((q) => Math.max(product.minOrderQty || 1, q - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="w-8 text-center text-base font-bold text-gray-900">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(product.maxOrderQty || 100, q + 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
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
                <>
                  <Check className="w-5 h-5" />
                  Added to Cart!
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Add to Cart · ₹{(price * qty).toLocaleString("en-IN")}
                </>
              )}
            </button>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-2xl text-sm">
            {product.preparationTime && (
              <div>
                <p className="text-gray-500 text-xs">Prep Time</p>
                <p className="font-semibold text-gray-800">{product.preparationTime} mins</p>
              </div>
            )}
            {product.category && (
              <div>
                <p className="text-gray-500 text-xs">Category</p>
                <p className="font-semibold text-gray-800">{product.category.name}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 text-xs">Min Order</p>
              <p className="font-semibold text-gray-800">{product.minOrderQty} {product.unit || "unit"}</p>
            </div>
            {product.unit && (
              <div>
                <p className="text-gray-500 text-xs">Unit</p>
                <p className="font-semibold text-gray-800">{product.unit}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
