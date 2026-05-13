"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { useProducts, useCategories } from "@/hooks/use-api"
import { setBusinessContext } from "@/lib/api-client"
import { getDemoCategories, getDemoProducts } from "@/lib/demo-data"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/loading-states"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Plus, Minus, Leaf, X, SlidersHorizontal } from "lucide-react"

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
  const { setCustomerPage, setSelectedProductId, currentBusinessType } = useAdminStore()
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"default" | "price-low" | "price-high" | "discount">("default")

  // Use dynamic business ID from admin store
  const BIZ_ID = "biz_1"

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
    setBusinessContext(BIZ_ID)
  }, [])

  // Fetch products with filters
  const { data: productsData, isLoading: productsLoading, error: productsError, refetch } = useProducts(BIZ_ID, {
    status: "ACTIVE",
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
    return prods.map((p: Record<string, unknown>) => ({
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

  // Client-side sort
  const filteredProducts = useMemo(() => {
    let result = allProducts

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      )
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
  }, [allProducts, searchQuery, sortBy])

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
    setCustomerPage("product-detail")
  }

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`

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
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-10 rounded-xl bg-gray-50 border-gray-200 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !selectedCategory
              ? "bg-emerald-500 text-white"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              cat.id === selectedCategory
                ? "text-white"
                : "bg-gray-100 text-gray-600"
            }`}
            style={
              cat.id === selectedCategory
                ? { backgroundColor: cat.color || "#10B981" }
                : {}
            }
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Sort & Results */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-gray-500">
          {productsLoading ? "Loading..." : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs text-gray-600 bg-transparent border-none outline-none cursor-pointer"
          >
            <option value="default">Relevance</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="discount">Discount</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {productsLoading ? (
        <div className="grid grid-cols-2 gap-2.5 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <div className="p-2.5 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
                <Skeleton className="h-6 w-full rounded-lg" />
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
        <div className="grid grid-cols-2 gap-2.5 px-4">
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
                className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => handleProductClick(product.id)}
                  className="w-full"
                  disabled={isOutOfStock}
                >
                  <div
                    className="h-32 flex items-center justify-center relative"
                    style={{ backgroundColor: `${catColor}10` }}
                  >
                    <Leaf className="w-10 h-10 text-gray-300" />
                    {product.isVeg && (
                      <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border border-green-600 flex items-center justify-center rounded-sm">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                      </div>
                    )}
                    {savings > 0 && !isOutOfStock && (
                      <Badge className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[9px] px-1 py-0 h-4">
                        {Math.round((savings / defaultVariant.mrp) * 100)}% OFF
                      </Badge>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">Out of Stock</span>
                      </div>
                    )}
                  </div>
                </button>
                <div className="p-2.5">
                  <button onClick={() => handleProductClick(product.id)} disabled={isOutOfStock}>
                    <p className="text-xs font-medium text-gray-800 line-clamp-1">{product.name}</p>
                    <p className="text-[10px] text-gray-400">{defaultVariant.name}</p>
                  </button>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-sm font-bold text-gray-900">{formatPrice(defaultVariant.price)}</span>
                    {savings > 0 && (
                      <span className="text-[10px] text-gray-400 line-through">{formatPrice(defaultVariant.mrp)}</span>
                    )}
                  </div>
                  {!isOutOfStock && (
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
