"use client"

import { useState, useEffect, useRef } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { ChevronRight, Star, Clock, Zap, Search } from "lucide-react"
import type { WebNav } from "./storefront-website"
import { StorefrontProductCard, ProductCardSkeleton } from "./storefront-product-card"
import type { StorefrontProduct } from "./storefront-product-card"
import { StorefrontCategoryCard, StorefrontCategoryCardSkeleton } from "./storefront-category-card"
import type { StorefrontCategory } from "./storefront-category-card"
import { StorefrontBanner } from "./storefront-banner"
import { StorefrontEmptyState } from "./storefront-empty-state"
import { PwaInstallBanner } from "./pwa-install-banner"

type Category = StorefrontCategory
type Product  = StorefrontProduct

// ── Business-type delivery copy ────────────────────────────────────────────
function getDeliveryMeta(businessType: string) {
  switch (businessType) {
    case "MEAT_DELIVERY":
      return { time: "30-45 min", tag: "Fresh & Halal" }
    case "GROCERY":
      return { time: "20-40 min", tag: "Daily Fresh" }
    case "FOOD_DELIVERY":
      return { time: "25-40 min", tag: "Hot & Fresh" }
    case "PHARMACY":
      return { time: "30 min", tag: "Genuine Meds" }
    default:
      return { time: "30-60 min", tag: "Fast Delivery" }
  }
}

// ── Horizontal product carousel card (narrow) ─────────────────────────────
function CarouselProductCard({
  product,
  brandColor,
  nav,
  businessType,
  storeClosed,
}: {
  product: StorefrontProduct
  brandColor: string
  nav: WebNav
  businessType: string
  storeClosed: boolean
}) {
  return (
    <div className="w-[152px] shrink-0">
      <StorefrontProductCard
        product={product}
        brandColor={brandColor}
        nav={nav}
        businessType={businessType}
        storeClosed={storeClosed}
      />
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({
  title,
  sub,
  brandColor,
  onViewAll,
}: {
  title: string
  sub?: string
  brandColor: string
  onViewAll: () => void
}) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{title}</h2>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={onViewAll}
        className="flex items-center gap-0.5 text-[12px] font-semibold active:opacity-70"
        style={{ color: brandColor }}
      >
        See all <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Skeleton for carousel products ────────────────────────────────────────
function CarouselSkeleton() {
  return (
    <div className="flex gap-3 px-4 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-[152px] shrink-0 animate-pulse">
          <div className="w-full aspect-[4/3] bg-gray-100 rounded-2xl mb-2" />
          <div className="h-3 bg-gray-100 rounded w-4/5 mb-1.5" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface StorefrontHomeProps {
  brandColor: string
  nav: WebNav
  storeClosed?: boolean
}

export function StorefrontHome({ brandColor, nav, storeClosed = false }: StorefrontHomeProps) {
  const {
    currentBusinessId,
    currentBusinessName,
    currentBusinessLogo,
    currentBusinessType,
    currentStoreId,
    storefrontWhyChooseUs,
    storefrontPromiseBar,
  } = useAdminStore()

  const config      = getBusinessTypeConfig(currentBusinessType)
  const labels      = config.labels
  const deliveryMeta = getDeliveryMeta(currentBusinessType)

  const [categories, setCategories]     = useState<Category[]>([])
  const [catLoading, setCatLoading]     = useState(true)
  const [products, setProducts]         = useState<Product[]>([])
  const [prodsLoading, setProdsLoading] = useState(true)
  const [searchQuery, setSearchQuery]   = useState("")

  const searchRef = useRef<HTMLInputElement>(null)

  // ── Data fetching — UNCHANGED ──────────────────────────────────────────
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
    const productParams = new URLSearchParams({ businessId: currentBusinessId, limit: "16" })
    if (currentStoreId) productParams.set("storeId", currentStoreId)
    fetch(`/api/core/storefront/products?${productParams}`)
      .then((r) => r.json())
      .then((j) => {
        const prods: Product[] = Array.isArray(j.data) ? j.data : []
        console.log("[StorefrontHome] products loaded", {
          businessId:      currentBusinessId,
          businessType:    currentBusinessType,
          storeId:         currentStoreId,
          returned:        prods.length,
          apiSuccess:      j.success,
          paginationTotal: j.pagination?.total,
        })
        setProducts(prods)
      })
      .catch((err) => { console.error("[StorefrontHome] products fetch error", err) })
      .finally(() => setProdsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId])

  // Split featured / rest — UNCHANGED logic
  const featured        = products.filter((p) => p.isFeatured)
  const displayProducts = featured.length > 0 ? featured.slice(0, 8) : products.slice(0, 8)
  const moreProducts    = featured.length > 0
    ? products.filter((p) => !p.isFeatured).slice(0, 8)
    : products.slice(8, 16)

  // ── Search handler ────────────────────────────────────────────────────
  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchQuery.trim()) {
      nav.go("category", { categoryId: undefined, categoryName: `Search: ${searchQuery.trim()}` })
    }
  }

  const promiseItems = storefrontPromiseBar.length > 0
    ? storefrontPromiseBar
    : [
        { emoji: "⚡", label: deliveryMeta.time, sub: "Delivery time" },
        { emoji: "✓", label: deliveryMeta.tag,  sub: "Quality assured" },
      ]

  return (
    <div className="pb-4">

      {/* ── Brand Header (mobile) ─────────────────────────────────────── */}
      {/* Desktop sees the standard header; on mobile we add a richer brand section */}
      <div className="md:hidden bg-white px-4 pt-1 pb-3">

        {/* Promise chips — e.g. "30-45 min · Fresh & Halal" */}
        <div className="flex items-center gap-3 mb-3 overflow-x-auto scrollbar-none">
          {promiseItems.slice(0, 3).map(({ emoji, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
            >
              <span className="text-base leading-none">{emoji}</span>
              <span>{label}</span>
            </div>
          ))}
          {storeClosed && (
            <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
              <span>🔴</span>
              <span>Store Closed</span>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchRef}
            type="search"
            placeholder={`Search ${currentBusinessName || "products"}…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="w-full h-11 pl-10 pr-4 text-sm bg-gray-100 rounded-2xl border border-transparent focus:outline-none focus:bg-white focus:border-gray-300 transition-colors placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* ── Desktop: store-closed banner ─────────────────────────────── */}
      {storeClosed && (
        <div className="hidden md:block bg-red-50 border-b border-red-100 text-center py-2 text-sm font-medium text-red-600">
          🔴 Store is currently closed
        </div>
      )}

      {/* ── PWA install prompt ────────────────────────────────────────── */}
      <div className="px-4 md:max-w-7xl md:mx-auto md:px-8">
        <PwaInstallBanner brandColor={brandColor} />
      </div>

      {/* ── Banner carousel ──────────────────────────────────────────── */}
      {currentBusinessId && (
        <div className="mt-2 px-3 md:px-8 md:max-w-7xl md:mx-auto">
          <StorefrontBanner
            businessId={currentBusinessId}
            storeId={currentStoreId || null}
            brandColor={brandColor}
            variant="carousel"
          />
        </div>
      )}

      {/* ── Category chips ─────────────────────────────────────────── */}
      <section className="mt-5">
        <div className="flex items-center justify-between px-4 md:max-w-7xl md:mx-auto md:px-8 mb-3">
          <h2 className="text-[15px] font-bold text-gray-900">{labels.categoryHeading}</h2>
          <button
            onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
            className="flex items-center gap-0.5 text-[12px] font-semibold active:opacity-70"
            style={{ color: brandColor }}
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto scrollbar-none px-4 md:px-8 pb-1">
          {catLoading ? (
            <>
              {Array.from({ length: 7 }).map((_, i) => (
                <StorefrontCategoryCardSkeleton key={i} />
              ))}
            </>
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No categories yet</p>
          ) : (
            <>
              {/* "All" chip */}
              <button
                onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div
                  className="w-[60px] h-[60px] rounded-2xl flex items-center justify-center text-2xl border-2 border-transparent transition-all"
                  style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}30` }}
                >
                  🛒
                </div>
                <span className="text-[11px] font-medium text-gray-700 text-center leading-tight w-[60px]">
                  All
                </span>
              </button>
              {categories.map((c) => (
                <StorefrontCategoryCard
                  key={c.id}
                  category={c}
                  brandColor={brandColor}
                  businessType={currentBusinessType}
                  onClick={() => nav.go("category", { categoryId: c.id, categoryName: c.name })}
                />
              ))}
            </>
          )}
        </div>
      </section>

      {/* ── Popular Picks — horizontal carousel ──────────────────────── */}
      <section className="mt-6">
        <div className="px-4 md:max-w-7xl md:mx-auto md:px-8">
          <SectionHeader
            title={labels.featuredHeading}
            sub="Fresh stock, updated daily"
            brandColor={brandColor}
            onViewAll={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
          />
        </div>

        {prodsLoading ? (
          <CarouselSkeleton />
        ) : displayProducts.length === 0 ? (
          <div className="px-4 md:max-w-7xl md:mx-auto md:px-8">
            <StorefrontEmptyState
              variant="no-products"
              brandColor={brandColor}
              onAction={() => nav.go("category")}
            />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-none px-4 pb-2 md:hidden">
            {displayProducts.map((p) => (
              <CarouselProductCard
                key={p.id}
                product={p}
                brandColor={brandColor}
                nav={nav}
                businessType={currentBusinessType}
                storeClosed={storeClosed}
              />
            ))}
          </div>
        )}

        {/* Desktop: standard 2-col → 5-col grid */}
        {!prodsLoading && displayProducts.length > 0 && (
          <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-8 max-w-7xl mx-auto">
            {displayProducts.map((p) => (
              <StorefrontProductCard
                key={p.id}
                product={p}
                brandColor={brandColor}
                nav={nav}
                businessType={currentBusinessType}
                storeClosed={storeClosed}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Best Sellers — 2-col grid on mobile ─────────────────────── */}
      {!prodsLoading && moreProducts.length > 0 && (
        <section className="mt-6 px-4 md:max-w-7xl md:mx-auto md:px-8">
          <SectionHeader
            title={labels.bestSellersHeading}
            sub="Customer favourites"
            brandColor={brandColor}
            onViewAll={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {moreProducts.map((p) => (
              <StorefrontProductCard
                key={p.id}
                product={p}
                brandColor={brandColor}
                nav={nav}
                businessType={currentBusinessType}
                storeClosed={storeClosed}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Promise / Why choose us strip ──────────────────────────── */}
      {storefrontWhyChooseUs.length > 0 && (
        <section className="mt-8 mx-4 md:max-w-7xl md:mx-auto md:px-8">
          <div
            className="rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4"
            style={{ backgroundColor: `${brandColor}08` }}
          >
            {storefrontWhyChooseUs.map(({ emoji, title, desc }) => (
              <div key={title} className="flex items-start gap-2.5">
                <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                <div>
                  <p className="text-[13px] font-bold text-gray-900 leading-tight">{title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
