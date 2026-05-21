"use client"

import React, { useCallback, useEffect, useState } from "react"
import { formatINR } from "@/lib/currency"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useCartStore } from "@/stores/cart-store"
import { ArrowLeft, Heart, ShoppingCart, Trash2, Loader2, Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"
import { showSuccess, showError } from "@/lib/toast-utils"

interface FavoriteItem {
  id: string
  productId: string
  addedAt: string
  product: {
    name: string
    slug: string
    images: string[]
    status: string
    category: { id: string; name: string } | null
    price: number | null
    mrp: number | null
    discountPrice: number | null
    discountPercent: number | null
  }
}

export function CustomerWishlist() {
  const { setCustomerPage, currentBusinessPrimaryColor } = useAdminStore()
  const { token } = useAuthStore()
  const addItem = useCartStore((s) => s.addItem)
  const brandColor = currentBusinessPrimaryColor || "#10B981"

  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/core/storefront/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setItems(json.data || [])
    } catch {
      showError("Failed to load saved products")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchFavorites() }, [fetchFavorites])

  const handleRemove = async (productId: string) => {
    setRemoving(productId)
    try {
      const res = await fetch(`/api/core/storefront/favorites?productId=${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.productId !== productId))
        showSuccess("Removed from saved products")
      } else {
        showError("Failed to remove")
      }
    } catch {
      showError("Failed to remove")
    } finally {
      setRemoving(null)
    }
  }

  const handleAddToCart = (item: FavoriteItem) => {
    const { product } = item
    const price = product.discountPrice ?? product.price
    if (!price) { showError("Product not available"); return }
    addItem({
      productId: item.productId,
      variantId: "default",
      name: product.name,
      variantName: "",
      price,
      mrp: product.mrp ?? price,
      quantity: 1,
      image: product.images[0] ?? "",
      isVeg: false,
    })
    showSuccess(`${product.name} added to cart`)
  }


  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setCustomerPage("profile")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Saved Products</h1>
          {!loading && (
            <p className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-sm font-semibold text-gray-600 mb-1">No saved products</h3>
          <p className="text-xs text-gray-400 mb-4">Tap the heart icon on any product to save it here</p>
          <Button
            onClick={() => setCustomerPage("products")}
            className="text-white text-xs h-9 px-5 rounded-xl"
            style={{ backgroundColor: brandColor }}
          >
            Browse Products
          </Button>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {items.map((item) => {
            const { product } = item
            const price = product.discountPrice ?? product.price
            const originalPrice = product.mrp ?? product.price

            return (
              <div key={item.id} className="flex gap-3 bg-white border border-gray-100 rounded-xl p-3">
                {/* Image */}
                <div className="w-20 h-20 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement
                        el.style.display = "none"
                      }}
                    />
                  ) : (
                    <Leaf className="w-8 h-8 text-gray-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
                  {product.category && (
                    <p className="text-[10px] text-gray-400 mb-1">{product.category.name}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {price != null && (
                      <span className="text-sm font-bold text-gray-900">{formatINR(price)}</span>
                    )}
                    {originalPrice != null && originalPrice !== price && (
                      <span className="text-[10px] text-gray-400 line-through">{formatINR(originalPrice)}</span>
                    )}
                    {product.discountPercent != null && product.discountPercent > 0 && (
                      <span
                        className="text-[10px] font-semibold px-1 rounded"
                        style={{ color: brandColor, backgroundColor: `${brandColor}15` }}
                      >
                        {product.discountPercent}% off
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleRemove(item.productId)}
                      disabled={removing === item.productId}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      {removing === item.productId ? (
                        <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleAddToCart(item)}
                      disabled={price == null}
                      className="flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ backgroundColor: brandColor }}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
