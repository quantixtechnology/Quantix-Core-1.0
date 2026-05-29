"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { resolveImageUrl } from "@/lib/image-url"
import { formatINR } from "@/lib/currency"
import { Search, SlidersHorizontal, ChevronDown, X, Plus, Minus, Package } from "lucide-react"
import type { WebNav } from "./storefront-website"

interface Category {
  id: string
  name: string
  slug: string
  image: string | null
}

interface Variant {
  id: string
  name: string
  price: number
  mrp: number
  isDefault: boolean
}

interface Product {
  id: string
  name: string
  shortDesc: string | null
  images: string[]
  isVeg: boolean | null
  isFeatured: boolean
  metadata: Record<string, unknown>
  variants: Variant[]
  category: { id: string; name: string } | null
  stockStatus: string
  availableStock: number
  hasInventory: boolean
}

type SortOption = "default" | "price_asc" | "price_desc" | "name_asc"

function getDefaultProductEmoji(businessType: string): string {
  switch (businessType) {
    case "MEAT_DELIVERY":  return "🥩"
    case "GROCERY":        return "🛒"
    case "FOOD_DELIVERY":  return "🍽️"
    case "PHARMACY":       return "💊"
    default:               return "📦"
  }
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-28 bg-gray-100" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/3 mt-2" />
      </div>
    </div>
  )
}

function ProductCard({
  product,
  brandColor,
  nav,
  businessType,
}: {
  product: Product
  brandColor: string
  nav: WebNav
  businessType: string
}) {
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const config = getBusinessTypeConfig(businessType)
  const [imgError, setImgError] = useState(false)

  const images = Array.isArray(product.images) ? product.images : []
  const meta   = (product.metadata && typeof product.metadata === "object") ? product.metadata : {}
  const imgSrc = resolveImageUrl(images[0])

  const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
  const price = defaultVariant?.price ?? 0
  const mrp   = defaultVariant?.mrp   ?? 0
  const hasDiscount  = mrp > price && mrp > 0
  const discountPct  = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0

  const cartItem = defaultVariant
    ? items.find((i) => i.productId === product.id && i.variantId === defaultVariant.id)
    : undefined

  // Gate badges by business type config
  const showHalal  = config.productMeta.some((m) => m.key === "isHalal"      && m.showOnCard)
  const showFresh  = config.productMeta.some((m) => m.key === "freshnessTag" && m.showOnCard)
  const defaultEmoji = getDefaultProductEmoji(businessType)

  const isOutOfStock = product.hasInventory && product.stockStatus === 'OUT_OF_STOCK'

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!defaultVariant || isOutOfStock) return
    addItem({
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      variantName: defaultVariant.name !== "Default" ? defaultVariant.name : "",
      price: defaultVariant.price,
      mrp: defaultVariant.mrp,
      quantity: 1,
      image: imgSrc || "",
      isVeg: product.isVeg ?? false,
    })
  }

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cartItem || !defaultVariant) return
    updateQuantity(product.id, defaultVariant.id, cartItem.quantity + 1)
  }

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cartItem || !defaultVariant) return
    if (cartItem.quantity <= 1) {
      removeItem(product.id, defaultVariant.id)
    } else {
      updateQuantity(product.id, defaultVariant.id, cartItem.quantity - 1)
    }
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer group hover:shadow-md hover:border-gray-200 transition-all duration-200"
      onClick={() => nav.go("product", { productId: product.id })}
    >
      <div className="relative overflow-hidden">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => {
              console.warn(`[CategoryCard] image load failed: ${imgSrc}`)
              setImgError(true)
            }}
          />
        ) : (
          <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-3xl">
            {defaultEmoji}
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-1 flex-wrap max-w-[calc(100%-0.5rem)]">
          {isOutOfStock ? (
            <span className="px-1.5 py-0.5 bg-gray-600 text-white text-[9px] font-bold rounded-full">OUT OF STOCK</span>
          ) : (
            <>
              {showHalal && !!meta.isHalal && (
                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full">HALAL</span>
              )}
              {hasDiscount && (
                <span className="px-1.5 py-0.5 text-white text-[9px] font-bold rounded-full" style={{ backgroundColor: brandColor }}>
                  {discountPct}% OFF
                </span>
              )}
            </>
          )}
        </div>

        {showFresh && !!meta.freshnessTag && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm text-[9px] font-semibold text-gray-700 rounded-full border border-gray-200">
            {String(meta.freshnessTag)}
          </div>
        )}
      </div>

      <div className="p-2">
        <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
        {defaultVariant && defaultVariant.name !== "Default" ? (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{defaultVariant.name}</p>
        ) : product.shortDesc ? (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.shortDesc}</p>
        ) : null}
        <div className="mt-1 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold" style={{ color: brandColor }}>
              {formatINR(price)}
            </span>
            {hasDiscount && (
              <span className="ml-1 text-xs text-gray-400 line-through">{formatINR(mrp)}</span>
            )}
          </div>
          {isOutOfStock ? (
            <span className="text-[10px] font-semibold text-gray-400 shrink-0">Unavailable</span>
          ) : cartItem ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleDecrease}
                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{cartItem.quantity}</span>
              <button
                onClick={handleIncrease}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: brandColor }}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: brandColor }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface StorefrontCategoryPageProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontCategoryPage({ brandColor, nav }: StorefrontCategoryPageProps) {
  const { currentBusinessId, currentBusinessType, currentStoreId } = useAdminStore()

  const config = getBusinessTypeConfig(currentBusinessType)
  const labels = config.labels

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [searchQuery, setSearchQuery]   = useState("")
  const [sort, setSort]             = useState<SortOption>("default")
  const [priceMax, setPriceMax]     = useState<number | null>(null)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [sortOpen, setSortOpen]     = useState(false)

  const LIMIT = 12

  // ── Categories ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/core/storefront/categories?businessId=${currentBusinessId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setCategories(j.data || []) })
      .catch(() => {})
  }, [currentBusinessId])

  // ── Products ───────────────────────────────────────────────────
  const fetchProducts = useCallback(() => {
    if (!currentBusinessId) return
    setLoading(true)

    const params = new URLSearchParams({
      businessId: currentBusinessId,
      page: String(page),
      limit: String(LIMIT),
    })
    if (currentStoreId) params.set("storeId", currentStoreId)
    if (nav.categoryId) params.set("categoryId", nav.categoryId)
    if (searchQuery.trim()) params.set("search", searchQuery.trim())

    fetch(`/api/core/storefront/products?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          // API returns { success, data: Product[], pagination: { total } }
          // data IS the array — NOT an object with a .products key
          let prods: Product[] = Array.isArray(j.data) ? j.data : []

          if (priceMax !== null) {
            prods = prods.filter((p) => {
              const v = p.variants.find((vv) => vv.isDefault) || p.variants[0]
              return v ? v.price <= priceMax : true
            })
          }
          if (sort === "price_asc")  prods.sort((a, b) => {
            const av = a.variants.find((v) => v.isDefault) || a.variants[0]
            const bv = b.variants.find((v) => v.isDefault) || b.variants[0]
            return (av?.price ?? 0) - (bv?.price ?? 0)
          })
          if (sort === "price_desc") prods.sort((a, b) => {
            const av = a.variants.find((v) => v.isDefault) || a.variants[0]
            const bv = b.variants.find((v) => v.isDefault) || b.variants[0]
            return (bv?.price ?? 0) - (av?.price ?? 0)
          })
          if (sort === "name_asc")   prods.sort((a, b) => a.name.localeCompare(b.name))

          setProducts(prods)
          setTotal(j.pagination?.total ?? prods.length)

          console.log("[StorefrontCategory] loaded", {
            businessId:   currentBusinessId,
            businessType: currentBusinessType,
            categoryId:   nav.categoryId,
            productCount: prods.length,
            totalInDb:    j.pagination?.total,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId, nav.categoryId, page, searchQuery, sort, priceMax])

  useEffect(() => { setPage(1) }, [nav.categoryId, searchQuery, sort, priceMax])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  const totalPages = Math.ceil(total / LIMIT)

  const SortLabel: Record<SortOption, string> = {
    default:    "Relevance",
    price_asc:  "Price: Low to High",
    price_desc: "Price: High to Low",
    name_asc:   "Name A–Z",
  }

  const Sidebar = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Categories</h3>
        <div className="space-y-0.5">
          <button
            onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
            className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors ${
              !nav.categoryId ? "font-semibold text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
            style={!nav.categoryId ? { backgroundColor: brandColor } : {}}
          >
            All Products
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => nav.go("category", { categoryId: c.id, categoryName: c.name })}
              className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors ${
                nav.categoryId === c.id ? "font-semibold text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
              style={nav.categoryId === c.id ? { backgroundColor: brandColor } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Max Price</h3>
        <div className="space-y-0.5">
          {[null, 200, 500, 1000, 2000].map((val) => (
            <button
              key={val ?? "any"}
              onClick={() => setPriceMax(val)}
              className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors ${
                priceMax === val ? "font-semibold text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
              style={priceMax === val ? { backgroundColor: brandColor } : {}}
            >
              {val === null ? "Any Price" : `Under ₹${val.toLocaleString("en-IN")}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{nav.categoryName || "All Products"}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total > 0 ? `${total} products` : "Browse our selection"}</p>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <Sidebar />
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search + sort bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={labels.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-2 px-4 h-10 text-sm font-medium border border-gray-200 rounded-xl hover:border-gray-300 transition-colors whitespace-nowrap bg-white"
              >
                <SlidersHorizontal className="w-4 h-4 text-gray-500" />
                <span className="hidden sm:block">{SortLabel[sort]}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-12 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-48 py-1 overflow-hidden">
                    {(Object.entries(SortLabel) as [SortOption, string][]).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => { setSort(k); setSortOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          sort === k ? "font-semibold" : "text-gray-700 hover:bg-gray-50"
                        }`}
                        style={sort === k ? { color: brandColor } : {}}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 px-4 h-10 text-sm font-medium border border-gray-200 rounded-xl hover:border-gray-300 transition-colors bg-white"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Product grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {Array.from({ length: LIMIT }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Package className="w-14 h-14 text-gray-200" />
              <p className="text-lg font-semibold text-gray-700">
                {searchQuery || nav.categoryId ? "No products found" : "No products added yet"}
              </p>
              <p className="text-sm text-gray-400">
                {searchQuery || nav.categoryId
                  ? "Try a different category or search term"
                  : "Products are being added. Check back soon."}
              </p>
              {(searchQuery || nav.categoryId) && (
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setPriceMax(null)
                    nav.go("category", { categoryId: undefined, categoryName: "All Products" })
                  }}
                  className="mt-1 px-5 py-2 text-sm font-semibold text-white rounded-xl"
                  style={{ backgroundColor: brandColor }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} brandColor={brandColor} nav={nav} businessType={currentBusinessType} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 h-9 text-sm font-medium border border-gray-200 rounded-xl disabled:opacity-40 hover:border-gray-300 transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className="w-9 h-9 text-sm font-medium rounded-xl transition-colors"
                        style={page === p ? { backgroundColor: brandColor, color: "white" } : { border: "1px solid #e5e7eb" }}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 h-9 text-sm font-medium border border-gray-200 rounded-xl disabled:opacity-40 hover:border-gray-300 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-[90] flex lg:hidden">
          <div className="flex-1 bg-black/40" onClick={() => setMobileFilterOpen(false)} />
          <div className="w-72 bg-white h-full overflow-y-auto p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Filters</h3>
              <button onClick={() => setMobileFilterOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  )
}
