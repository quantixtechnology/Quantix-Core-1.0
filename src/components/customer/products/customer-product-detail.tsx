"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useProduct, useProducts } from "@/hooks/use-api"
import { setBusinessContext } from "@/lib/api-client"
import { getDemoProducts, getDemoCategories } from "@/lib/demo-data"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/loading-states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Minus, Leaf, Share2, Heart, Truck, Clock, ShieldCheck, Loader2 } from "lucide-react"

export function CustomerProductDetail() {
  const { selectedProductId, setSelectedProductId, setCustomerPage, currentBusinessType, currentBusinessId } = useAdminStore()
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(false)

  const BIZ_ID = currentBusinessId || ""

  useEffect(() => {
    if (BIZ_ID) setBusinessContext(BIZ_ID)
  }, [BIZ_ID])

  // Fetch single product by ID
  const { data: productData, isLoading: productLoading, error: productError, refetch } = useProduct(selectedProductId || "")

  // Fetch related products (same business, for similar products)
  const { data: relatedData } = useProducts(BIZ_ID, { limit: 20 })

  // Demo product from business context (business-type-aware)
  const demoProduct = useMemo(() => {
    const allDemoProducts = getDemoProducts(currentBusinessType)
    const found = allDemoProducts.find((p) => p.id === selectedProductId)
    if (!found) return null
    return {
      id: found.id,
      name: found.name,
      categoryId: found.categoryId,
      category: found.category,
      status: found.status,
      isVeg: found.isVeg,
      isFeatured: found.isFeatured,
      image: found.image,
      shortDesc: null as string | null,
      variants: found.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        mrp: v.mrp,
        stock: v.stock as number | undefined,
        isDefault: v.isDefault as boolean | undefined,
      })),
    }
  }, [currentBusinessType, selectedProductId])

  // Parse product from API
  const apiProduct = useMemo(() => {
    if (!productData?.data) return null
    const p = productData.data as unknown as Record<string, unknown>
    return {
      id: p.id as string,
      name: p.name as string,
      categoryId: (p.category as Record<string, string>)?.id || "",
      category: (p.category as Record<string, string>)?.name || "",
      status: p.status as string,
      isVeg: p.isVeg as boolean | null,
      isFeatured: p.isFeatured as boolean,
      image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as string) : "",
      shortDesc: p.shortDesc as string | null,
      variants: Array.isArray(p.variants)
        ? (p.variants as Array<Record<string, unknown>>).map((v) => ({
            id: v.id as string,
            name: v.name as string,
            price: v.price as number,
            mrp: v.mrp as number,
            stock: v.stock as number | undefined,
            isDefault: v.isDefault as boolean | undefined,
          }))
        : [],
    }
  }, [productData])

  // Merge: prefer demo product, fall back to API
  const product = demoProduct || apiProduct

  const activeVariant = useMemo(() => {
    if (!product) return null
    if (selectedVariantId) {
      return product.variants.find((v) => v.id === selectedVariantId) || product.variants[0]
    }
    return product.variants.find((v) => v.isDefault) || product.variants[0]
  }, [product, selectedVariantId])

  const catColor = useMemo(() => {
    if (!product) return "#10B981"
    // Simple color mapping by category name
    const colorMap: Record<string, string> = {
      "Fruits & Vegetables": "#10B981",
      "Dairy & Eggs": "#3B82F6",
      "Bakery": "#F59E0B",
      "Snacks & Chips": "#EF4444",
      "Beverages": "#8B5CF6",
      "Rice & Grains": "#D97706",
      "Spices & Masala": "#DC2626",
      "Personal Care": "#EC4899",
      "Cleaning": "#0891B2",
      "Frozen Foods": "#6366F1",
    }
    return colorMap[product.category] || "#10B981"
  }, [product])

  const savings = activeVariant ? activeVariant.mrp - activeVariant.price : 0
  const savingsPercent = activeVariant ? Math.round((savings / activeVariant.mrp) * 100) : 0

  const cartItem = product && activeVariant
    ? items.find((i) => i.productId === product.id && i.variantId === activeVariant.id)
    : null
  const cartQty = cartItem?.quantity || 0

  // Related products — prefer demo data, fall back to API
  const relatedProducts = useMemo(() => {
    if (!product) return []
    // Try demo products first
    const demoRelated = getDemoProducts(currentBusinessType)
      .filter((p) => p.categoryId === product.categoryId && p.id !== product.id && p.status === "ACTIVE")
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        variants: p.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          mrp: v.mrp,
          isDefault: v.isDefault as boolean | undefined,
        })),
      }))
    if (demoRelated.length > 0) return demoRelated
    // Fall back to API data
    if (!relatedData?.data) return []
    const prods = (Array.isArray(relatedData.data) ? relatedData.data : []) as unknown as Record<string, unknown>[]
    return prods
      .filter((p) => {
        const catId = (p.category as Record<string, string>)?.id
        return catId === product.categoryId && p.id !== product.id && p.status === "ACTIVE"
      })
      .slice(0, 4)
      .map((p) => ({
        id: p.id as string,
        name: p.name as string,
        category: (p.category as Record<string, string>)?.name || "",
        variants: Array.isArray(p.variants)
          ? (p.variants as Array<Record<string, unknown>>).map((v) => ({
              id: v.id as string,
              name: v.name as string,
              price: v.price as number,
              mrp: v.mrp as number,
              isDefault: v.isDefault as boolean | undefined,
            }))
          : [],
      }))
  }, [product, relatedData, currentBusinessType])

  const handleAddToCart = () => {
    if (!product || !activeVariant) return
    addItem({
      productId: product.id,
      variantId: activeVariant.id,
      name: product.name,
      variantName: activeVariant.name,
      price: activeVariant.price,
      mrp: activeVariant.mrp,
      image: product.image,
      isVeg: product.isVeg ?? true,
    })
    setQuantity(1)
  }

  const handleBack = () => {
    setSelectedProductId(null)
    setCustomerPage("products")
  }

  const handleRelatedClick = (productId: string) => {
    setSelectedProductId(productId)
    setSelectedVariantId(null)
    setQuantity(1)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  const isOutOfStock = product?.status === "OUT_OF_STOCK" || (activeVariant?.stock !== undefined && activeVariant.stock === 0)

  // Loading state
  if (productLoading) {
    return (
      <div className="pb-20">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-56 w-full" />
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  // Error state
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
          description="We couldn't load this product. It may have been removed or is temporarily unavailable."
          onRetry={() => refetch()}
          className="py-20"
        />
      </div>
    )
  }

  return (
    <div className="pb-20">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <button
          onClick={handleBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
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

      {/* Product Image */}
      <div
        className="h-56 flex items-center justify-center relative"
        style={{ backgroundColor: `${catColor}10` }}
      >
        <Leaf className="w-20 h-20 text-gray-300" />
        {product.isVeg && (
          <div className="absolute top-3 left-3 w-5 h-5 border-2 border-green-600 flex items-center justify-center rounded-sm bg-white">
            <div className="w-3 h-3 bg-green-600 rounded-full" />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-500 bg-gray-200 px-4 py-2 rounded-lg">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1">
            <Badge variant="outline" className="text-[10px] mb-1.5" style={{ borderColor: catColor, color: catColor }}>
              {product.category}
            </Badge>
            <h1 className="text-lg font-bold text-gray-900">{product.name}</h1>
          </div>
        </div>

        {/* Variant Selector */}
        {product.variants.length > 1 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Select Size</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => {
                    setSelectedVariantId(variant.id)
                    setQuantity(1)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    variant.id === activeVariant.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {variant.name}
                  <span className="ml-1 text-[10px] opacity-70">{formatPrice(variant.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="mt-4 flex items-end gap-2">
          <span className="text-2xl font-bold text-gray-900">{formatPrice(activeVariant.price)}</span>
          {savings > 0 && (
            <>
              <span className="text-base text-gray-400 line-through">{formatPrice(activeVariant.mrp)}</span>
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                {savingsPercent}% OFF
              </Badge>
            </>
          )}
        </div>
        {savings > 0 && (
          <p className="text-xs text-emerald-600 font-medium mt-1">
            You save {formatPrice(savings)} on this item
          </p>
        )}

        {/* Stock */}
        <div className="mt-3 flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isOutOfStock ? "bg-red-500" : (activeVariant.stock !== undefined && activeVariant.stock < 10) ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span className="text-xs text-gray-500">
            {isOutOfStock ? "Out of stock" : (activeVariant.stock !== undefined && activeVariant.stock < 10) ? `Only ${activeVariant.stock} left` : "In Stock"}
          </span>
        </div>

        {/* Quantity Selector */}
        {!isOutOfStock && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500">Quantity</span>
            <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition-colors"
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

        {/* Delivery Info */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3">
            <Truck className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] text-gray-600 text-center">Free delivery above ₹500</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3">
            <Clock className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] text-gray-600 text-center">30 min delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] text-gray-600 text-center">Quality assured</span>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Similar Products</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {relatedProducts.map((rp) => {
                const rpVariant = rp.variants.find((v) => v.isDefault) || rp.variants[0]
                if (!rpVariant) return null
                const rpColorMap: Record<string, string> = {
                  "Fruits & Vegetables": "#10B981",
                  "Dairy & Eggs": "#3B82F6",
                  "Bakery": "#F59E0B",
                  "Snacks & Chips": "#EF4444",
                  "Beverages": "#8B5CF6",
                  "Rice & Grains": "#D97706",
                  "Spices & Masala": "#DC2626",
                  "Personal Care": "#EC4899",
                  "Cleaning": "#0891B2",
                  "Frozen Foods": "#6366F1",
                }
                const rpColor = rpColorMap[rp.category] || "#10B981"

                return (
                  <button
                    key={rp.id}
                    onClick={() => handleRelatedClick(rp.id)}
                    className="flex-shrink-0 w-32 bg-white border border-gray-100 rounded-xl overflow-hidden"
                  >
                    <div
                      className="h-24 flex items-center justify-center"
                      style={{ backgroundColor: `${rpColor}10` }}
                    >
                      <Leaf className="w-8 h-8 text-gray-300" />
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-gray-800 line-clamp-1">{rp.name}</p>
                      <p className="text-[10px] text-gray-400">{rpVariant.name}</p>
                      <span className="text-xs font-bold">{formatPrice(rpVariant.price)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Add to Cart */}
      {!isOutOfStock && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-3 z-40">
          {cartQty === 0 ? (
            <Button
              onClick={handleAddToCart}
              className="w-full h-11 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Cart — {formatPrice(activeVariant.price * quantity)}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-between bg-emerald-500 rounded-xl h-11 flex-1 px-2">
                <button
                  onClick={() =>
                    cartQty === 1
                      ? removeItem(product.id, activeVariant.id)
                      : updateQuantity(product.id, activeVariant.id, cartQty - 1)
                  }
                  className="w-8 h-8 flex items-center justify-center text-white"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-white">{cartQty} in cart</span>
                <button
                  onClick={() => updateQuantity(product.id, activeVariant.id, cartQty + 1)}
                  className="w-8 h-8 flex items-center justify-center text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <Button
                onClick={() => setCustomerPage("cart")}
                className="h-11 px-5 text-sm font-bold rounded-xl bg-gray-900 hover:bg-gray-800 text-white"
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
