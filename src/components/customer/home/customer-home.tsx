"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { banners, offers, categories, products, recentlyOrdered } from "@/components/customer/data"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Search,
  ChevronRight,
  Plus,
  Minus,
  Tag,
  Clock,
  Sparkles,
  Apple,
  Milk,
  Croissant,
  Cookie,
  Coffee,
  Wheat,
  Flame,
  Sparkles as SparklesIcon,
  SprayCan,
  Snowflake,
  Leaf,
} from "lucide-react"

const categoryIcons: Record<string, React.ReactNode> = {
  Apple: <Apple className="w-6 h-6" />,
  Milk: <Milk className="w-6 h-6" />,
  Croissant: <Croissant className="w-6 h-6" />,
  Cookie: <Cookie className="w-6 h-6" />,
  Coffee: <Coffee className="w-6 h-6" />,
  Wheat: <Wheat className="w-6 h-6" />,
  Flame: <Flame className="w-6 h-6" />,
  Sparkles: <SparklesIcon className="w-6 h-6" />,
  SprayCan: <SprayCan className="w-6 h-6" />,
  Snowflake: <Snowflake className="w-6 h-6" />,
}

export function CustomerHome() {
  const { setCustomerPage, setSelectedProductId, customerLoggedIn } = useAdminStore()
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentBanner, setCurrentBanner] = useState(0)

  // Auto-scroll banner
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const featuredProducts = products.filter((p) => p.isFeatured && p.status === "ACTIVE")
  const recentProducts = products.filter((p) => recentlyOrdered.includes(p.id) && p.status === "ACTIVE")

  const getCartQty = useCallback(
    (productId: string, variantId: string) => {
      const item = items.find((i) => i.productId === productId && i.variantId === variantId)
      return item?.quantity || 0
    },
    [items]
  )

  const handleAddToCart = (product: typeof products[0]) => {
    const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
    addItem({
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      variantName: defaultVariant.name,
      price: defaultVariant.price,
      mrp: defaultVariant.mrp,
      image: product.image,
      isVeg: product.isVeg,
    })
  }

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId)
    setCustomerPage("product-detail")
  }

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

  return (
    <div className="pb-4">
      {/* Search Bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search for groceries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setCustomerPage("products")}
            className="pl-10 h-10 rounded-xl bg-gray-50 border-gray-200 text-sm"
            readOnly
          />
        </div>
      </div>

      {/* Delivery Location */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Leaf className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-gray-500">Delivering to</span>
          <span className="font-semibold text-gray-800">Home - Andheri West</span>
          <ChevronRight className="w-3 h-3 text-gray-400" />
        </div>
      </div>

      {/* Banner Carousel */}
      <div className="px-4 mb-4">
        <div className="relative overflow-hidden rounded-2xl h-36">
          {banners.map((banner, idx) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-all duration-500 ease-in-out flex items-center px-5 ${
                idx === currentBanner ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
              }`}
              style={{ backgroundColor: banner.color }}
            >
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg leading-tight">{banner.title}</h3>
                <p className="text-white/80 text-sm mt-1">{banner.subtitle}</p>
                {banner.link && (
                  <button
                    onClick={() => setCustomerPage("products")}
                    className="mt-2 bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full"
                  >
                    Shop Now →
                  </button>
                )}
              </div>
              <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
                <Leaf className="w-10 h-10 text-white/60" />
              </div>
            </div>
          ))}
          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBanner(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentBanner ? "bg-white w-4" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Offers Row */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <h2 className="text-sm font-bold text-gray-900">Offers & Deals</h2>
          <button className="text-xs text-emerald-600 font-medium">View All</button>
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto pb-1 scrollbar-hide">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex-shrink-0 w-44 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-3"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">{offer.title}</span>
              </div>
              <p className="text-[11px] text-gray-500 mb-2">{offer.description}</p>
              <div className="bg-emerald-500 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded inline-block">
                {offer.code}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Grid */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <h2 className="text-sm font-bold text-gray-900">Shop by Category</h2>
          <button
            onClick={() => setCustomerPage("products")}
            className="text-xs text-emerald-600 font-medium"
          >
            See All
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 px-4">
          {categories.slice(0, 8).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setCustomerPage("products")
              }}
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${cat.color}15` }}
              >
                <span style={{ color: cat.color }}>
                  {categoryIcons[cat.icon] || <Sparkles className="w-6 h-6" />}
                </span>
              </div>
              <span className="text-[10px] font-medium text-gray-700 text-center leading-tight line-clamp-2">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Featured Products */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-900">Featured Products</h2>
          </div>
          <button
            onClick={() => setCustomerPage("products")}
            className="text-xs text-emerald-600 font-medium"
          >
            View All
          </button>
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto pb-1 scrollbar-hide">
          {featuredProducts.map((product) => {
            const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
            const cartQty = getCartQty(product.id, defaultVariant.id)
            const savings = defaultVariant.mrp - defaultVariant.price

            return (
              <div
                key={product.id}
                className="flex-shrink-0 w-36 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => handleProductClick(product.id)}
                  className="w-full"
                >
                  <div
                    className="h-28 flex items-center justify-center relative"
                    style={{ backgroundColor: `${categories.find((c) => c.id === product.categoryId)?.color || "#10B981"}10` }}
                  >
                    <Leaf className="w-10 h-10 text-gray-300" />
                    {product.isVeg && (
                      <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border border-green-600 flex items-center justify-center rounded-sm">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                      </div>
                    )}
                    {savings > 0 && (
                      <Badge className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[9px] px-1 py-0 h-4">
                        {Math.round((savings / defaultVariant.mrp) * 100)}% OFF
                      </Badge>
                    )}
                  </div>
                </button>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-800 line-clamp-1">{product.name}</p>
                  <p className="text-[10px] text-gray-400">{defaultVariant.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-sm font-bold text-gray-900">{formatPrice(defaultVariant.price)}</span>
                    {savings > 0 && (
                      <span className="text-[10px] text-gray-400 line-through">{formatPrice(defaultVariant.mrp)}</span>
                    )}
                  </div>
                  <div className="mt-1.5">
                    {cartQty === 0 ? (
                      <Button
                        onClick={() => handleAddToCart(product)}
                        className="w-full h-7 text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                        variant="ghost"
                        size="sm"
                      >
                        ADD
                      </Button>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-500 rounded-lg h-7 px-1">
                        <button
                          onClick={() =>
                            cartQty === 1
                              ? removeItem(product.id, defaultVariant.id)
                              : updateQuantity(product.id, defaultVariant.id, cartQty - 1)
                          }
                          className="w-6 h-6 flex items-center justify-center text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-white">{cartQty}</span>
                        <button
                          onClick={() => updateQuantity(product.id, defaultVariant.id, cartQty + 1)}
                          className="w-6 h-6 flex items-center justify-center text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recently Ordered */}
      {customerLoggedIn && recentProducts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between px-4 mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">Buy Again</h2>
            </div>
          </div>
          <div className="space-y-2 px-4">
            {recentProducts.slice(0, 4).map((product) => {
              const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
              const cartQty = getCartQty(product.id, defaultVariant.id)

              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-2.5"
                >
                  <button
                    onClick={() => handleProductClick(product.id)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div
                      className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${categories.find((c) => c.id === product.categoryId)?.color || "#10B981"}10` }}
                    >
                      <Leaf className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{product.name}</p>
                      <p className="text-[10px] text-gray-400">{defaultVariant.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{formatPrice(defaultVariant.price)}</span>
                        {defaultVariant.mrp > defaultVariant.price && (
                          <span className="text-[10px] text-gray-400 line-through">{formatPrice(defaultVariant.mrp)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex-shrink-0">
                    {cartQty === 0 ? (
                      <Button
                        onClick={() => handleAddToCart(product)}
                        className="h-7 px-3 text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                        variant="ghost"
                        size="sm"
                      >
                        ADD
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 bg-emerald-500 rounded-lg h-7 px-1">
                        <button
                          onClick={() =>
                            cartQty === 1
                              ? removeItem(product.id, defaultVariant.id)
                              : updateQuantity(product.id, defaultVariant.id, cartQty - 1)
                          }
                          className="w-6 h-6 flex items-center justify-center text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-white w-4 text-center">{cartQty}</span>
                        <button
                          onClick={() => updateQuantity(product.id, defaultVariant.id, cartQty + 1)}
                          className="w-6 h-6 flex items-center justify-center text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
