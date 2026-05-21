"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { ShoppingCart, ChevronRight, Clock, Shield, Star, Truck, Zap, Plus } from "lucide-react"
import type { WebNav } from "./storefront-website"

interface Category {
  id: string
  name: string
  slug: string
  image: string | null
  icon: string | null
  color: string | null
  productCount: number
}

interface Variant {
  id: string
  name: string
  price: number
  mrp: number
  discountPercent: number | null
  isDefault: boolean
}

interface Product {
  id: string
  name: string
  shortDesc: string | null
  images: string
  isVeg: boolean | null
  isFeatured: boolean
  isPopular: boolean
  metadata: string
  variants: Variant[]
  category: { id: string; name: string } | null
}

interface StorefrontHomeProps {
  brandColor: string
  nav: WebNav
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-100" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-100 rounded w-1/3 mt-3" />
      </div>
    </div>
  )
}

function SkeletonCategory() {
  return (
    <div className="flex flex-col items-center gap-2 animate-pulse">
      <div className="w-16 h-16 rounded-2xl bg-gray-100" />
      <div className="h-3 bg-gray-100 rounded w-14" />
    </div>
  )
}

function ProductCard({
  product,
  brandColor,
  nav,
}: {
  product: Product
  brandColor: string
  nav: WebNav
}) {
  const { addItem } = useCartStore()
  const images = (() => { try { return JSON.parse(product.images) as string[] } catch { return [] } })()
  const meta = (() => { try { return JSON.parse(product.metadata) as Record<string, unknown> } catch { return {} } })()
  const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0]
  const price = defaultVariant?.price ?? 0
  const mrp = defaultVariant?.mrp ?? 0
  const hasDiscount = mrp > price && mrp > 0
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!defaultVariant) return
    addItem({
      productId: product.id,
      variantId: defaultVariant.id,
      name: product.name,
      variantName: defaultVariant.name !== "Default" ? defaultVariant.name : "",
      price: defaultVariant.price,
      mrp: defaultVariant.mrp,
      quantity: 1,
      image: images[0] || "",
      isVeg: product.isVeg ?? false,
    })
  }

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer group hover:shadow-md hover:border-gray-200 transition-all duration-200"
      onClick={() => nav.go("product", { productId: product.id })}
    >
      <div className="relative overflow-hidden">
        {images[0] ? (
          <img
            src={images[0]}
            alt={product.name}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-5xl">
            🥩
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {product.isVeg === true && (
            <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">VEG</span>
          )}
          {product.isVeg === false && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">NON-VEG</span>
          )}
          {!!meta.isHalal && (
            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">HALAL</span>
          )}
          {hasDiscount && (
            <span className="px-2 py-0.5 text-white text-[10px] font-bold rounded-full" style={{ backgroundColor: brandColor }}>
              {discountPct}% OFF
            </span>
          )}
        </div>
        {!!meta.freshnessTag && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-[10px] font-semibold text-gray-700 rounded-full border border-gray-200">
            {String(meta.freshnessTag)}
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
        {product.shortDesc && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.shortDesc}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div>
            <span className="text-base font-bold" style={{ color: brandColor }}>
              ₹{price.toLocaleString("en-IN")}
            </span>
            {hasDiscount && (
              <span className="ml-1.5 text-xs text-gray-400 line-through">₹{mrp.toLocaleString("en-IN")}</span>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: brandColor }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function StorefrontHome({ brandColor, nav }: StorefrontHomeProps) {
  const { currentBusinessId, currentBusinessName } = useAdminStore()

  const [categories, setCategories] = useState<Category[]>([])
  const [catLoading, setCatLoading] = useState(true)
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [prodsLoading, setProdsLoading] = useState(true)

  useEffect(() => {
    if (!currentBusinessId) return

    setCatLoading(true)
    fetch(`/api/core/storefront/categories?businessId=${currentBusinessId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setCategories(j.data || []) })
      .catch(() => {})
      .finally(() => setCatLoading(false))
  }, [currentBusinessId])

  useEffect(() => {
    if (!currentBusinessId) return

    setProdsLoading(true)
    Promise.all([
      fetch(`/api/core/storefront/products?businessId=${currentBusinessId}&limit=8`).then((r) => r.json()),
      fetch(`/api/core/storefront/products?businessId=${currentBusinessId}&limit=8`).then((r) => r.json()),
    ])
      .then(([featuredJson, popularJson]) => {
        const allProds: Product[] = featuredJson.success ? (featuredJson.data?.products || []) : []
        setFeaturedProducts(allProds.filter((p: Product) => p.isFeatured).slice(0, 8) || allProds.slice(0, 8))
        setPopularProducts(popularJson.success ? (popularJson.data?.products || []) : [])
      })
      .catch(() => {})
      .finally(() => setProdsLoading(false))
  }, [currentBusinessId])

  const initial = (currentBusinessName || "Q").charAt(0).toUpperCase()

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 60%, #1B1B1B 100%)` }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-white" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl bg-white" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl border-2 border-white/30"
                style={{ backgroundColor: `${brandColor}80` }}
              >
                {initial}
              </div>
              <div>
                <p className="text-white/70 text-sm font-medium">Welcome to</p>
                <h1 className="text-white font-bold text-xl">{currentBusinessName || "Our Store"}</h1>
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
              Fresh. Halal.<br />Delivered Fast.
            </h2>
            <p className="text-white/80 text-base sm:text-lg mb-8 max-w-lg">
              Premium quality meat & poultry, hygienically processed and delivered to your doorstep within hours.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                className="px-6 py-3 bg-white font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                style={{ color: brandColor }}
              >
                Shop Now <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => nav.go("auth")}
                className="px-6 py-3 bg-white/10 border border-white/30 text-white font-semibold text-sm rounded-xl hover:bg-white/20 transition-colors"
              >
                My Orders
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Delivery promise bar ─────────────────────────────── */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Zap, label: "Express Delivery", sub: "Within 2 hours" },
              { icon: Shield, label: "100% Halal", sub: "Certified & fresh" },
              { icon: Star, label: "Premium Quality", sub: "Hand-selected cuts" },
              { icon: Truck, label: "Free Delivery", sub: "On orders ₹499+" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}30` }}>
                  <Icon className="w-4 h-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-[11px] text-gray-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Categories ──────────────────────────────────────── */}
        <section className="py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Shop by Category</h2>
              <p className="text-sm text-gray-500 mt-0.5">Browse our fresh selections</p>
            </div>
            <button
              onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
              className="text-sm font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: brandColor }}
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {catLoading ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCategory key={i} />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No categories yet</div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => nav.go("category", { categoryId: c.id, categoryName: c.name })}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-gray-200 transition-all"
                    style={{ backgroundColor: c.color ? `${c.color}20` : `${brandColor}15` }}
                  >
                    {c.image ? (
                      <img src={c.image} alt={c.name} className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <span className="text-2xl">{c.icon || "🥩"}</span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center leading-tight line-clamp-2">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Featured Products ────────────────────────────────── */}
        <section className="pb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Featured Products</h2>
              <p className="text-sm text-gray-500 mt-0.5">Our most popular picks</p>
            </div>
            <button
              onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
              className="text-sm font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: brandColor }}
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {prodsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No products available yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {featuredProducts.map((p) => (
                <ProductCard key={p.id} product={p} brandColor={brandColor} nav={nav} />
              ))}
            </div>
          )}
        </section>

        {/* ── Popular / All Products ───────────────────────────── */}
        {!prodsLoading && popularProducts.length > 0 && (
          <section className="pb-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Products</h2>
                <p className="text-sm text-gray-500 mt-0.5">Fresh stock updated daily</p>
              </div>
              <button
                onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                className="text-sm font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: brandColor }}
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {popularProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} brandColor={brandColor} nav={nav} />
              ))}
            </div>
          </section>
        )}

        {/* ── Why choose us ────────────────────────────────────── */}
        <section className="py-10 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">Why Choose Us?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { emoji: "🥩", title: "Fresh Daily", desc: "Sourced and processed every morning" },
              { emoji: "✅", title: "Halal Certified", desc: "100% halal slaughter, no compromise" },
              { emoji: "⚡", title: "Fast Delivery", desc: "Delivered within 2 hours of order" },
              { emoji: "🧊", title: "Hygienic Packaging", desc: "Vacuum sealed, temperature maintained" },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="text-center">
                <div className="text-4xl mb-3">{emoji}</div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Banner ───────────────────────────────────────── */}
        <section className="mb-12">
          <div
            className="rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, #1B1B1B 0%, ${brandColor} 100%)` }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl bg-white/5" />
            <div className="relative max-w-lg">
              <p className="text-sm font-semibold text-white/70 mb-2">Limited time offer</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold mb-3">
                First Order?<br />Get 20% Off!
              </h3>
              <p className="text-white/70 text-sm mb-6">
                Sign up and use code <strong className="text-white">WELCOME20</strong> on your first order.
              </p>
              <button
                onClick={() => nav.go("auth")}
                className="px-6 py-3 bg-white font-bold text-sm rounded-xl hover:bg-gray-100 transition-colors"
                style={{ color: brandColor }}
              >
                Claim Offer
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
