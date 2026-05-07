"use client"

import React, { useState, useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { categories, products } from "@/components/customer/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Minus, Leaf, Share2, Heart, Truck, Clock, ShieldCheck } from "lucide-react"

export function CustomerProductDetail() {
  const { selectedProductId, setSelectedProductId, setCustomerPage } = useAdminStore()
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(false)

  const product = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0]
  }, [selectedProductId])

  const activeVariant = useMemo(() => {
    if (selectedVariantId) {
      return product.variants.find((v) => v.id === selectedVariantId) || product.variants[0]
    }
    return product.variants.find((v) => v.isDefault) || product.variants[0]
  }, [product, selectedVariantId])

  const catColor = useMemo(() => {
    return categories.find((c) => c.id === product.categoryId)?.color || "#10B981"
  }, [product])

  const savings = activeVariant.mrp - activeVariant.price
  const savingsPercent = Math.round((savings / activeVariant.mrp) * 100)

  const cartItem = items.find(
    (i) => i.productId === product.id && i.variantId === activeVariant.id
  )
  const cartQty = cartItem?.quantity || 0

  const relatedProducts = products.filter(
    (p) => p.categoryId === product.categoryId && p.id !== product.id && p.status === "ACTIVE"
  ).slice(0, 4)

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      variantId: activeVariant.id,
      name: product.name,
      variantName: activeVariant.name,
      price: activeVariant.price,
      mrp: activeVariant.mrp,
      image: product.image,
      isVeg: product.isVeg,
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

  const isOutOfStock = product.status === "OUT_OF_STOCK" || activeVariant.stock === 0

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
          <div className={`w-2 h-2 rounded-full ${isOutOfStock ? "bg-red-500" : activeVariant.stock < 10 ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span className="text-xs text-gray-500">
            {isOutOfStock ? "Out of stock" : activeVariant.stock < 10 ? `Only ${activeVariant.stock} left` : "In Stock"}
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
                const rpColor = categories.find((c) => c.id === rp.categoryId)?.color || "#10B981"

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
