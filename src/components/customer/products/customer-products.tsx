"use client"

import React, { useState, useMemo } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { categories, products } from "@/components/customer/data"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Plus, Minus, Leaf, X, SlidersHorizontal } from "lucide-react"

export function CustomerProducts() {
  const { setCustomerPage, setSelectedProductId } = useAdminStore()
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"default" | "price-low" | "price-high" | "discount">("default")

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.status === "ACTIVE")

    if (selectedCategory) {
      result = result.filter((p) => p.categoryId === selectedCategory)
    }

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
  }, [selectedCategory, searchQuery, sortBy])

  const getCartQty = (productId: string, variantId: string) => {
    const item = items.find((i) => i.productId === productId && i.variantId === variantId)
    return item?.quantity || 0
  }

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
                ? { backgroundColor: cat.color }
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
          {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
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
      {filteredProducts.length === 0 ? (
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
            const cartQty = getCartQty(product.id, defaultVariant.id)
            const savings = defaultVariant.mrp - defaultVariant.price
            const catColor = categories.find((c) => c.id === product.categoryId)?.color || "#10B981"
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
