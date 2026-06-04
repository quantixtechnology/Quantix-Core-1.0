"use client"

import React, { useState, useMemo, useEffect } from "react"
import { formatINR } from "@/lib/currency"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useProducts, useCategories } from "@/hooks/use-api"
import { setBusinessContext } from "@/lib/api-client"
import { getDemoCategories, getDemoProducts } from "@/lib/demo-data"
import { getProductFilters } from "@/lib/business-type-config"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/loading-states"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Plus, Minus, ShoppingBag, X, SlidersHorizontal, ChevronDown } from "lucide-react"

interface ProductItem {
  id: string
  name: string
  categoryId: string
  category: string
  status: string
  isVeg: boolean | null
  isFeatured: boolean
  image: string
  variants: Array<{
    id: string
    name: string
    price: number
    mrp: number
    stock?: number
    isDefault?: boolean
  }>
}

export function CustomerProducts() {
  const { setCustomerPage, pushCustomerPage, setSelectedProductId, currentBusinessType, currentBusinessId, currentStoreId, currentBusinessPrimaryColor } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"default" | "price-low" | "price-high" | "discount">("default")
  const [showFilters, setShowFilters] = useState(false)
  const [toggleFilters, setToggleFilters] = useState<Record<string, boolean>>({})
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000])

  const productFilters = useMemo(() => getProductFilters(currentBusinessType), [currentBusinessType])

  const BIZ_ID = currentBusinessId || ""

  // Dynamic fallback categories from business context
  const fallbackCategories = useMemo(() =>
    getDemoCategories(currentBusinessType).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    [currentBusinessType]
  )

  useEffect(() => {
    if (BIZ_ID) setBusinessContext(BIZ_ID)
  }, [BIZ_ID])

  // Fetch products with filters
  const { data: productsData, isLoading: productsLoading, error: productsError, refetch } = useProducts(BIZ_ID, {
    status: "ACTIVE",
    ...(currentStoreId ? { storeId: currentStoreId } : {}),
    ...(selectedCategory ? { categoryId: selectedCategory } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
    limit: 50,
  })

  // Fetch categories
  const { data: categoriesData } = useCategories(BIZ_ID)

  // Parse categories from API or fallback
  const categories = useMemo(() => {
    if (categoriesData?.data && Array.isArray(categoriesData.data) && categoriesData.data.length > 0) {
      return (categoriesData.data as Array<Record<string, unknown>>).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        color: (c as Record<string, unknown>).color as string | undefined || "#10B981",
      }))
    }
    return fallbackCategories
  }, [categoriesData])

  // Demo products from business context (business-type-aware)
  const demoProductsList: ProductItem[] = useMemo(() => {
    return getDemoProducts(currentBusinessType)
      .filter((p) => p.status === "ACTIVE")
      .map((p) => ({
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

  // Parse products from API
  const apiProducts: ProductItem[] = useMemo(() => {
    if (!productsData?.data) return []
    const prods = Array.isArray(productsData.data) ? productsData.data : []
    return prods.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      categoryId: (p.category as Record<string, string>)?.id || "",
      category: (p.category as Record<string, string>)?.name || "",
      status: p.status as string,
      isVeg: p.isVeg as boolean | null,
      isFeatured: p.isFeatured as boolean,
      image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as string) : "",
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
    }))
  }, [productsData])

  // Merge: prefer demo products when demo context is active (business-type-aware),
  // fall back to API data only when no demo context
  const allProducts: ProductItem[] = useMemo(() => {
    if (demoProductsList.length > 0) return demoProductsList
    if (apiProducts.length > 0) return apiProducts
    return []
  }, [demoProductsList, apiProducts])

  // Client-side filter + sort
  const filteredProducts = useMemo(() => {
    let result = allProducts

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)
      )
    }

    // Apply toggle filters (halal, fresh_today, availability, etc.)
    for (const [filterId, active] of Object.entries(toggleFilters)) {
      if (!active) continue
      const filterDef = productFilters.find((f) => f.id === filterId)
      if (!filterDef?.metaKey) continue
      if (filterId === "availability") {
        result = result.filter((p) => {
          const v = p.variants.find((v) => v.isDefault) || p.variants[0]
          return !v || (v.stock == null || v.stock > 0)
        })
      }
      // Other meta-based filters: pass through (metadata is on API products, not demo products)
    }

    // Price range filter
    const [minPrice, maxPrice] = priceRange
    if (minPrice > 0 || maxPrice < 5000) {
      result = result.filter((p) => {
        const price = (p.variants.find((v) => v.isDefault) || p.variants[0])?.price || 0
        return price >= minPrice && price <= maxPrice
      })
    }

    switch (sortBy) {
      case "price-low":
        result = [...result].sort((a, b) => {
          const aPrice = a.variants.find((v) => v.isDefault)?.price || 0
          const bPrice = b.variants.find((v) => v.isDefault)?.price || 0
          return aPrice - bPrice
        })
        break
      case "price-high":
        result = [...result].sort((a, b) => {
          const aPrice = a.variants.find((v) => v.isDefault)?.price || 0
          const bPrice = b.variants.find((v) => v.isDefault)?.price || 0
          return bPrice - aPrice
        })
        break
      case "discount":
        result = [...result].sort((a, b) => {
          const aDisc = a.variants.find((v) => v.isDefault)
          const bDisc = b.variants.find((v) => v.isDefault)
          const aPct = aDisc ? ((aDisc.mrp - aDisc.price) / aDisc.mrp) * 100 : 0
          const bPct = bDisc ? ((bDisc.mrp - bDisc.price) / bDisc.mrp) * 100 : 0
          return bPct - aPct
        })
        break
    }

    return result
  }, [allProducts, searchQuery, sortBy, toggleFilters, priceRange, productFilters])

  const activeFilterCount = Object.values(toggleFilters).filter(Boolean).length + (priceRange[0] > 0 || priceRange[1] < 5000 ? 1 : 0)

  const getCartQty = (productId: string, variantId: string) => {
    const item = items.find((i) => i.productId === productId && i.variantId === variantId)
    return item?.quantity || 0
  }

  const handleAddToCart = (product: ProductItem) => {
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
      {/* Search bar — M3 pill */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-11 rounded-full bg-gray-100 border-gray-200 text-sm focus:ring-1"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Category filter chips — pill style */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            !selectedCategory ? "text-white shadow-sm" : "bg-gray-100 text-gray-600"
          }`}
          style={!selectedCategory ? { backgroundColor: brandColor } : undefined}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              cat.id === selectedCategory ? "text-white shadow-sm" : "bg-gray-100 text-gray-600"
            }`}
            style={cat.id === selectedCategory ? { backgroundColor: cat.color || "#10B981" } : {}}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Sort & Filter Bar */}
      <div className="flex items-center justify-between px-4 py-2 gap-2">
        <span className="text-xs text-gray-500 shrink-0">
          {productsLoading ? "Loading..." : `${filteredProducts.length} item${filteredProducts.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-medium border transition-colors"
            style={activeFilterCount > 0
              ? { borderColor: brandColor, color: brandColor, backgroundColor: `${brandColor}10` }
              : { borderColor: "#e5e7eb", color: "#6b7280" }
            }
          >
            <SlidersHorizontal className="w-3 h-3" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 h-7">
            <ChevronDown className="w-3 h-3 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-[11px] text-gray-600 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value="default">Relevance</option>
              <option value="price-low">Price ↑</option>
              <option value="price-high">Price ↓</option>
              <option value="discount">Discount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="mx-4 mb-3 bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
          {/* Toggle filters */}
          {productFilters.filter((f) => f.type === "toggle").map((filter) => (
            <div key={filter.id} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{filter.label}</span>
              <button
                onClick={() => setToggleFilters((prev) => ({ ...prev, [filter.id]: !prev[filter.id] }))}
                className={`w-10 h-5 rounded-full relative transition-colors`}
                style={toggleFilters[filter.id] ? { backgroundColor: brandColor } : { backgroundColor: "#e5e7eb" }}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${toggleFilters[filter.id] ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          ))}
          {/* Price range */}
          {productFilters.find((f) => f.type === "range") && (() => {
            const f = productFilters.find((f) => f.type === "range")!
            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">{f.label}</span>
                  <span className="text-xs font-medium" style={{ color: brandColor }}>
                    {formatINR(priceRange[0])} – {formatINR(priceRange[1])}
                  </span>
                </div>
                <input
                  type="range"
                  min={f.min ?? 0}
                  max={f.max ?? 5000}
                  step={f.step ?? 50}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  className="w-full accent-current"
                  style={{ accentColor: brandColor }}
                />
              </div>
            )
          })()}
          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setToggleFilters({}); setPriceRange([0, 5000]) }}
              className="w-full text-xs font-medium text-red-500 hover:text-red-600 pt-1"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* Product Grid */}
      {productsLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_14px_rgba(0,0,0,0.07)]">
              <Skeleton className="h-44 w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3.5 w-4/5 rounded-full" />
                <Skeleton className="h-2.5 w-2/5 rounded-full" />
                <Skeleton className="h-5 w-1/2 rounded-full" />
                <Skeleton className="h-9 w-full rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : productsError ? (
        <ErrorState
          title="Could not load products"
          description="Something went wrong while fetching products."
          onRetry={() => refetch()}
          className="py-16"
        />
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Search className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-800">No products found</p>
          <p className="text-xs text-gray-400 mt-1">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4">
          {filteredProducts.map((product) => {
            const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
            if (!defaultVariant) return null
            const cartQty = getCartQty(product.id, defaultVariant.id)
            const savings = defaultVariant.mrp - defaultVariant.price
            const catColor = getCatColor(product.categoryId)
            const isOutOfStock = product.status === "OUT_OF_STOCK" || defaultVariant.stock === 0

            return (
              <div
                key={product.id}
                className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_14px_rgba(0,0,0,0.09)]"
              >
                <button
                  onClick={() => handleProductClick(product.id)}
                  className="w-full"
                  disabled={isOutOfStock}
                >
                  <div
                    className="h-44 flex items-center justify-center relative overflow-hidden"
                    style={{ backgroundColor: `${catColor}12` }}
                  >
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const t = e.target as HTMLImageElement
                          t.style.display = "none"
                          t.nextElementSibling?.classList.remove("hidden")
                        }}
                      />
                    ) : null}
                    <div className={`${product.image ? "hidden" : ""} absolute inset-0 flex items-center justify-center`}>
                      <ShoppingBag className="w-10 h-10" style={{ color: `${catColor}40` }} />
                    </div>
                    {product.isVeg && (
                      <div className="absolute top-2 left-2 w-4 h-4 bg-white border-2 border-green-600 flex items-center justify-center rounded-sm shadow-sm">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                      </div>
                    )}
                    {savings > 0 && !isOutOfStock && (
                      <Badge
                        className="absolute top-2 right-2 text-white text-[9px] px-1.5 py-0 h-4 font-bold shadow-sm"
                        style={{ backgroundColor: brandColor }}
                      >
                        {Math.round((savings / defaultVariant.mrp) * 100)}% OFF
                      </Badge>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-gray-500 bg-white px-3 py-1.5 rounded-xl shadow-sm">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                </button>
                <div className="p-2.5">
                  <button onClick={() => handleProductClick(product.id)} disabled={isOutOfStock} className="w-full text-left">
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{defaultVariant.name}</p>
                  </button>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-sm font-extrabold text-gray-900">{formatINR(defaultVariant.price)}</span>
                    {savings > 0 && (
                      <span className="text-[10px] text-gray-400 line-through">{formatINR(defaultVariant.mrp)}</span>
                    )}
                  </div>
                  {!isOutOfStock && (
                    <div className="mt-2">
                      {cartQty === 0 ? (
                        <Button
                          onClick={() => handleAddToCart(product)}
                          className="w-full h-8 text-xs font-bold border rounded-xl"
                          style={{ backgroundColor: `${brandColor}12`, color: brandColor, borderColor: `${brandColor}35` }}
                          variant="ghost"
                          size="sm"
                        >
                          ADD
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between rounded-xl h-8 px-2" style={{ backgroundColor: brandColor }}>
                          <button
                            onClick={() => cartQty === 1 ? removeItem(product.id, defaultVariant.id) : updateQuantity(product.id, defaultVariant.id, cartQty - 1)}
                            className="w-5 h-5 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-white w-4 text-center">{cartQty}</span>
                          <button
                            onClick={() => updateQuantity(product.id, defaultVariant.id, cartQty + 1)}
                            className="w-5 h-5 flex items-center justify-center text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
