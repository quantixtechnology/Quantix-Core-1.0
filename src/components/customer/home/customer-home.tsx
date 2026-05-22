"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { formatINR } from "@/lib/currency"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useProducts, useCategories } from "@/hooks/use-api"
import { useNearestStore } from "@/hooks/use-nearest-store"
import { setBusinessContext } from "@/lib/api-client"
import { getDemoCategories, getDemoProducts } from "@/lib/demo-data"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Search,
  ChevronDown,
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
  MapPin,
} from "lucide-react"

import { getBanners, getOffers } from "@/components/customer/data"
import { StorePickerModal } from "@/components/customer/store-picker/store-picker-modal"
import { getDeliveryPromise, getLabels } from "@/lib/business-type-config"
import { Zap, ShieldCheck, Star } from "lucide-react"

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

// Fallback categories for when API categories are loading or unavailable
interface CategoryItem {
  id: string
  name: string
  icon?: string
  color?: string
  slug?: string
  productCount?: number
}

export function CustomerHome() {
  const { setCustomerPage, pushCustomerPage, setSelectedProductId, customerLoggedIn, currentBusinessName, currentBusinessType, currentBusinessId, currentStoreId, currentStoreName, currentBusinessPrimaryColor } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const storeId = currentStoreId || undefined
  const businessName = currentBusinessName || "My Store"
  const { addItem, items, updateQuantity, removeItem, setCartStoreId } = useCartStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentBanner, setCurrentBanner] = useState(0)
  const [storePickerOpen, setStorePickerOpen] = useState(false)

  const bizId = currentBusinessId || ""

  // Auto-resolve nearest store via GPS if no storeId is set yet
  useNearestStore()

  // Set business context for API calls whenever bizId changes
  useEffect(() => {
    if (bizId) setBusinessContext(bizId)
  }, [bizId])

  // Sync store ID into cart store so checkout always sends the right storeId
  useEffect(() => {
    if (currentStoreId) setCartStoreId(currentStoreId)
  }, [currentStoreId, setCartStoreId])

  // Live API data
  const { data: productsData } = useProducts(bizId, { status: "ACTIVE", limit: 50, storeId })
  const { data: categoriesData } = useCategories(bizId)

  // Demo fallback data (business-type-aware)
  const demoCategories: CategoryItem[] = useMemo(() => {
    return getDemoCategories(currentBusinessType).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      slug: c.slug,
      productCount: 0,
    }))
  }, [currentBusinessType])

  const demoProducts = useMemo(() => {
    return getDemoProducts(currentBusinessType).filter((p) => p.status === "ACTIVE").map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      category: p.category,
      status: p.status,
      isVeg: p.isVeg,
      isFeatured: p.isFeatured,
      image: p.image,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        mrp: v.mrp,
        stock: v.stock,
        isDefault: v.isDefault,
      })),
    }))
  }, [currentBusinessType])

  // Resolve live categories, fall back to demo
  const categories: CategoryItem[] = useMemo(() => {
    const live = categoriesData?.data
    if (Array.isArray(live) && live.length > 0) {
      return (live as unknown as Record<string, unknown>[]).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        icon: (c.icon as string | undefined) || "Leaf",
        color: (c.color as string | undefined) || "#10B981",
        slug: c.slug as string | undefined,
        productCount: (c._count as Record<string, number> | undefined)?.products || 0,
      }))
    }
    return demoCategories
  }, [categoriesData, demoCategories])

  // Resolve live products, fall back to demo
  const allProducts = useMemo(() => {
    const live = productsData?.data
    if (Array.isArray(live) && live.length > 0) {
      return (live as unknown as Record<string, unknown>[]).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        categoryId: (p.category as Record<string, string> | undefined)?.id || (p.categoryId as string) || "",
        category: (p.category as Record<string, string> | undefined)?.name || "",
        status: p.status as string,
        isVeg: p.isVeg as boolean | null,
        isFeatured: p.isFeatured as boolean,
        image: Array.isArray(p.images) && (p.images as string[]).length > 0 ? (p.images as string[])[0] : "",
        variants: Array.isArray(p.variants)
          ? (p.variants as unknown as Record<string, unknown>[]).map((v) => ({
              id: v.id as string,
              name: v.name as string,
              price: v.price as number,
              mrp: (v.mrp as number) || (v.price as number),
              stock: v.stock as number | undefined,
              isDefault: v.isDefault as boolean | undefined,
            }))
          : [],
      }))
    }
    return demoProducts
  }, [productsData, demoProducts])

  // Context-aware banners and offers
  const banners = useMemo(() => getBanners(currentBusinessType), [currentBusinessType])
  const offers = useMemo(() => getOffers(currentBusinessType), [currentBusinessType])
  const deliveryPromise = useMemo(() => getDeliveryPromise(currentBusinessType), [currentBusinessType])
  const labels = useMemo(() => getLabels(currentBusinessType), [currentBusinessType])

  // Auto-scroll banner
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [banners.length])

  const featuredProducts = allProducts.filter((p) => p.isFeatured)
  const recentProducts = allProducts.slice(0, 4)

  const getCartQty = useCallback(
    (productId: string, variantId: string) => {
      const item = items.find((i) => i.productId === productId && i.variantId === variantId)
      return item?.quantity || 0
    },
    [items]
  )

  const handleAddToCart = (product: typeof allProducts[0]) => {
    const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
    if (!defaultVariant) return
    addItem({
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      variantName: defaultVariant.name,
      price: defaultVariant.price,
      mrp: defaultVariant.mrp,
      image: product.image,
      isVeg: product.isVeg ?? true,
    })
  }

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId)
    pushCustomerPage("product-detail")
  }


  const getCatColor = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.color || "#10B981"
  }

  return (
    <div className="pb-4">
      {/* Search Bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={`Search for ${businessName.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setCustomerPage("products")}
            className="pl-10 h-10 rounded-xl bg-gray-50 border-gray-200 text-sm"
            readOnly
          />
        </div>
      </div>

      {/* Store Selector */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setStorePickerOpen(true)}
          className="flex items-center gap-1.5 text-xs w-full text-left"
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: brandColor }} />
          <span className="text-gray-500">Delivering from</span>
          <span className="font-semibold text-gray-800 truncate flex-1">
            {currentStoreName || "Select a store"}
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
        </button>
        <StorePickerModal open={storePickerOpen} onClose={() => setStorePickerOpen(false)} />
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

      {/* Delivery Promise */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl p-3 flex items-center gap-3 border" style={{ backgroundColor: `${brandColor}08`, borderColor: `${brandColor}20` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}15` }}>
            <Zap className="w-5 h-5" style={{ color: brandColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{deliveryPromise.promiseHeadline}</p>
            <p className="text-[11px] text-gray-500">{deliveryPromise.promiseSubtext}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: brandColor }} />
              <span className="text-[10px] font-medium" style={{ color: brandColor }}>Hygienic</span>
            </div>
            <div className="w-px h-3 bg-gray-200" />
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5" style={{ color: brandColor }} />
              <span className="text-[10px] font-medium" style={{ color: brandColor }}>Fresh</span>
            </div>
          </div>
        </div>
      </div>

      {/* Offers Row */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <h2 className="text-sm font-bold text-gray-900">Offers & Deals</h2>
          <button className="text-xs font-medium" style={{ color: brandColor }}>View All</button>
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto pb-1 scrollbar-hide">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex-shrink-0 w-44 rounded-xl p-3 border"
              style={{ backgroundColor: `${brandColor}08`, borderColor: `${brandColor}20` }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Tag className="w-3.5 h-3.5" style={{ color: brandColor }} />
                <span className="text-xs font-bold" style={{ color: brandColor }}>{offer.title}</span>
              </div>
              <p className="text-[11px] text-gray-500 mb-2">{offer.description}</p>
              <div className="text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded inline-block" style={{ backgroundColor: brandColor }}>
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
            className="text-xs font-medium" style={{ color: brandColor }}
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
                style={{ backgroundColor: `${cat.color || "#10B981"}15` }}
              >
                <span style={{ color: cat.color || "#10B981" }}>
                  {categoryIcons[cat.icon || ""] || <Sparkles className="w-6 h-6" />}
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
            className="text-xs font-medium" style={{ color: brandColor }}
          >
            View All
          </button>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="px-4 text-center py-8 text-xs text-gray-400">
            No featured products available right now.
          </div>
        ) : (
          <div className="flex gap-3 px-4 overflow-x-auto pb-1 scrollbar-hide">
            {featuredProducts.map((product) => {
              const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
              if (!defaultVariant) return null
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
                      style={{ backgroundColor: `${getCatColor(product.categoryId)}10` }}
                    >
                      <Leaf className="w-10 h-10 text-gray-300" />
                      {product.isVeg && (
                        <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border border-green-600 flex items-center justify-center rounded-sm">
                          <div className="w-2 h-2 bg-green-600 rounded-full" />
                        </div>
                      )}
                      {savings > 0 && (
                        <Badge className="absolute top-1.5 right-1.5 text-white text-[9px] px-1 py-0 h-4" style={{ backgroundColor: brandColor }}>
                          {Math.round((savings / defaultVariant.mrp) * 100)}% OFF
                        </Badge>
                      )}
                    </div>
                  </button>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 line-clamp-1">{product.name}</p>
                    <p className="text-[10px] text-gray-400">{defaultVariant.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-bold text-gray-900">{formatINR(defaultVariant.price)}</span>
                      {savings > 0 && (
                        <span className="text-[10px] text-gray-400 line-through">{formatINR(defaultVariant.mrp)}</span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      {cartQty === 0 ? (
                        <Button
                          onClick={() => handleAddToCart(product)}
                          className="w-full h-7 text-xs font-semibold border rounded-lg"
                          style={{ backgroundColor: `${brandColor}15`, color: brandColor, borderColor: `${brandColor}40` }}
                          variant="ghost"
                          size="sm"
                        >
                          ADD
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between rounded-lg h-7 px-1" style={{ backgroundColor: brandColor }}>
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
        )}
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
              if (!defaultVariant) return null
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
                      style={{ backgroundColor: `${getCatColor(product.categoryId)}10` }}
                    >
                      <Leaf className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{product.name}</p>
                      <p className="text-[10px] text-gray-400">{defaultVariant.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{formatINR(defaultVariant.price)}</span>
                        {defaultVariant.mrp > defaultVariant.price && (
                          <span className="text-[10px] text-gray-400 line-through">{formatINR(defaultVariant.mrp)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex-shrink-0">
                    {cartQty === 0 ? (
                      <Button
                        onClick={() => handleAddToCart(product)}
                        className="h-7 px-3 text-xs font-semibold border rounded-lg"
                        style={{ backgroundColor: `${brandColor}15`, color: brandColor, borderColor: `${brandColor}40` }}
                        variant="ghost"
                        size="sm"
                      >
                        ADD
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 rounded-lg h-7 px-1" style={{ backgroundColor: brandColor }}>
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

      {/* Footer */}
      <div className="mx-4 mt-6 mb-4 rounded-2xl overflow-hidden border border-gray-100">
        <div className="p-4" style={{ backgroundColor: `${brandColor}08` }}>
          <p className="text-sm font-bold text-gray-900 mb-0.5">{businessName}</p>
          <p className="text-[11px] text-gray-500 mb-3">{labels.searchPlaceholder.replace("Search ", "").replace("...", "")}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setCustomerPage("home")} className="text-[11px] text-gray-500 hover:underline">Home</button>
            <button onClick={() => setCustomerPage("products")} className="text-[11px] text-gray-500 hover:underline">Products</button>
            <button onClick={() => setCustomerPage("orders")} className="text-[11px] text-gray-500 hover:underline">My Orders</button>
            <button onClick={() => setCustomerPage("support")} className="text-[11px] text-gray-500 hover:underline">Support</button>
          </div>
        </div>
        <div className="px-4 py-2 bg-white border-t border-gray-100 text-center">
          <p className="text-[9px] text-gray-300">Powered by Quantix Technology · All rights reserved</p>
        </div>
      </div>
    </div>
  )
}
