"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { ChevronRight, Search } from "lucide-react"
import type { WebNav } from "./storefront-website"
import { StorefrontProductCard, ProductCardSkeleton } from "./storefront-product-card"
import type { StorefrontProduct } from "./storefront-product-card"
import { StorefrontCategoryCard, StorefrontCategoryCardSkeleton } from "./storefront-category-card"
import type { StorefrontCategory } from "./storefront-category-card"
import { StorefrontBanner } from "./storefront-banner"
import { StorefrontEmptyState } from "./storefront-empty-state"
import { StorefrontLaundryHome } from "./storefront-laundry-home"
import { PwaInstallBanner } from "./pwa-install-banner"
import { usePwaModeCtx } from "@/contexts/pwa-mode-context"
import {
  TYPE, PRODUCT_GRID, GRID_GAP, CATEGORY_GRID, CAT_GAP,
  PAGE_X, SECTION_Y, BTN_LG, BTN_GHOST,
} from "@/design-system"

type Category = StorefrontCategory
type Product  = StorefrontProduct

// ── Business-type hero copy (web only) ────────────────────────────────────
function getHeroContent(businessType: string) {
  switch (businessType) {
    case "MEAT_DELIVERY":
      return { headline: "Fresh. Halal.\nDelivered Fast.", sub: "Premium quality meat & poultry, hygienically processed and delivered to your doorstep.", cta: "Shop Now" }
    case "GROCERY":
      return { headline: "Fresh Groceries,\nDelivered Daily.", sub: "Everything you need — vegetables, dairy, grains and more — delivered in minutes.", cta: "Shop Now" }
    case "FOOD_DELIVERY":
      return { headline: "Delicious Food,\nDelivered Hot.", sub: "Restaurant-quality meals at your door in 30–45 minutes.", cta: "Order Now" }
    case "PHARMACY":
      return { headline: "Medicines\nDelivered in 30 min.", sub: "Genuine medicines and vitamins from licensed pharmacists.", cta: "Order Now" }
    default:
      return { headline: "Quality Products,\nDelivered Fast.", sub: "Browse our selection and get everything you need delivered to your door.", cta: "Shop Now" }
  }
}

// ── PWA: delivery meta for promise chips ─────────────────────────────────
function getDeliveryMeta(businessType: string) {
  switch (businessType) {
    case "MEAT_DELIVERY":  return { time: "30-45 min", tag: "Fresh & Halal" }
    case "GROCERY":        return { time: "20-40 min", tag: "Daily Fresh" }
    case "FOOD_DELIVERY":  return { time: "25-40 min", tag: "Hot & Fresh" }
    case "PHARMACY":       return { time: "30 min",    tag: "Genuine Meds" }
    default:               return { time: "30-60 min", tag: "Fast Delivery" }
  }
}

// ── PWA section header ────────────────────────────────────────────────────
function PwaSectionHeader({
  title, sub, brandColor, onViewAll,
}: { title: string; sub?: string; brandColor: string; onViewAll: () => void }) {
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

// ── PWA carousel skeleton ─────────────────────────────────────────────────
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
    currentBusinessId, currentBusinessName,
    currentBusinessType, currentStoreId,
    storefrontWhyChooseUs, storefrontPromiseBar,
  } = useAdminStore()

  const isPwa      = usePwaModeCtx()

  // LAUNDRY workspaces are service-driven (Services/Garments/Pricing/
  // Subscriptions), not ecommerce Product-driven. Render the laundry home and
  // skip the ecommerce Product/ProductCategory flow entirely. Non-laundry
  // storefronts are unaffected.
  const config     = getBusinessTypeConfig(currentBusinessType)
  const heroContent  = getHeroContent(currentBusinessType)
  const deliveryMeta = getDeliveryMeta(currentBusinessType)
  const deliveryCfg  = config.deliveryConfig
  const labels       = config.labels
  const initial      = (currentBusinessName || "Q").charAt(0).toUpperCase()

  const [categories, setCategories]     = useState<Category[]>([])
  const [catLoading, setCatLoading]     = useState(true)
  const [products, setProducts]         = useState<Product[]>([])
  const [prodsLoading, setProdsLoading] = useState(true)
  const [searchQuery, setSearchQuery]   = useState("")

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

  // Featured / best-sellers split — UNCHANGED
  const featured        = products.filter((p) => p.isFeatured)
  const displayProducts = featured.length > 0 ? featured.slice(0, 8) : products.slice(0, 8)
  const moreProducts    = featured.length > 0
    ? products.filter((p) => !p.isFeatured).slice(0, 8)
    : products.slice(8, 16)

  // Promise bar — unchanged logic
  const promiseItems = storefrontPromiseBar.length > 0
    ? storefrontPromiseBar.map(({ emoji, label, sub }) => ({ emoji, label, sub }))
    : [{ emoji: "⚡", label: deliveryCfg.promiseHeadline, sub: deliveryCfg.promiseSubtext }]

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchQuery.trim()) {
      nav.go("category", { categoryId: undefined, categoryName: `Search: ${searchQuery.trim()}` })
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // LAUNDRY HOME — service-driven (Services/Garments/Pricing/Subscriptions).
  // Bypasses the ecommerce Product/ProductCategory flow entirely.
  // ══════════════════════════════════════════════════════════════════════
  if (currentBusinessType === "LAUNDRY") {
    return <StorefrontLaundryHome brandColor={brandColor} nav={nav} storeClosed={storeClosed} />
  }

  // ══════════════════════════════════════════════════════════════════════
  // PWA HOME — installed app experience
  // Compact promise chips + search + banner carousel + category chips +
  // horizontal product carousel + 2-col grid best sellers
  // ══════════════════════════════════════════════════════════════════════
  if (isPwa) {
    return (
      <div className="pb-4">
        {/* Hero — search + service chips, flows seamlessly from app bar */}
        <div className="bg-white px-4 pt-3 pb-4" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.06)" }}>
          {/* Search — primary action */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder={`Search in ${currentBusinessName || "store"}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="w-full h-11 pl-10 pr-4 text-sm bg-gray-50 rounded-2xl border border-gray-200 focus:outline-none focus:bg-white focus:border-gray-300 transition-colors placeholder:text-gray-400"
            />
          </div>

          {/* Service chips + store status — compact, below search */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {storeClosed ? (
              <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600">
                <span>🔴</span><span>Store Closed</span>
              </div>
            ) : promiseItems.slice(0, 3).map(({ emoji, label }) => (
              <div
                key={label}
                className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: `${brandColor}10`, color: brandColor }}
              >
                <span className="text-sm leading-none">{emoji}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PWA install banner */}
        <div className="px-4 pt-2">
          <PwaInstallBanner brandColor={brandColor} />
        </div>

        {/* Banner carousel */}
        {currentBusinessId && (
          <div className="mt-3 px-3">
            <StorefrontBanner
              businessId={currentBusinessId}
              storeId={currentStoreId || null}
              brandColor={brandColor}
              variant="carousel"
            />
          </div>
        )}

        {/* Category chips — horizontal scroll */}
        <section className="mt-5">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-[15px] font-bold text-gray-900">{labels.categoryHeading}</h2>
            <button
              onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
              className="flex items-center gap-0.5 text-[12px] font-semibold active:opacity-70"
              style={{ color: brandColor }}
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-none px-4 pb-1">
            {catLoading ? (
              Array.from({ length: 7 }).map((_, i) => <StorefrontCategoryCardSkeleton key={i} />)
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No categories yet</p>
            ) : (
              <>
                <button
                  onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                  className="flex flex-col items-center gap-1.5 shrink-0 active:scale-[0.91] transition-transform duration-100"
                >
                  <div
                    className="rounded-xl flex items-center justify-center text-[26px] border-[1.5px] bg-white"
                    style={{ borderColor: `${brandColor}60`, width: 72, height: 72 }}
                  >
                    🛒
                  </div>
                  <span className="text-[11px] font-semibold text-gray-800 text-center leading-tight" style={{ width: 72 }}>All</span>
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

        {/* Popular picks — horizontal scroll carousel */}
        <section className="mt-6">
          <div className="px-4">
            <PwaSectionHeader
              title={labels.featuredHeading}
              sub="Fresh stock, updated daily"
              brandColor={brandColor}
              onViewAll={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
            />
          </div>
          {prodsLoading ? (
            <CarouselSkeleton />
          ) : displayProducts.length === 0 ? (
            <div className="px-4">
              <StorefrontEmptyState
                variant="no-products"
                brandColor={brandColor}
                onAction={() => nav.go("category")}
              />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto scrollbar-none px-4 pb-2">
              {displayProducts.map((p) => (
                <div key={p.id} className="w-[152px] shrink-0">
                  <StorefrontProductCard
                    product={p}
                    brandColor={brandColor}
                    nav={nav}
                    businessType={currentBusinessType}
                    storeClosed={storeClosed}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Best sellers — 2-col grid */}
        {!prodsLoading && moreProducts.length > 0 && (
          <section className="mt-6 px-4">
            <PwaSectionHeader
              title={labels.bestSellersHeading}
              sub="Customer favourites"
              brandColor={brandColor}
              onViewAll={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
            />
            <div className="grid grid-cols-2 gap-3">
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

        {/* Why choose us */}
        {storefrontWhyChooseUs.length > 0 && (
          <section className="mt-8 mx-4">
            <div
              className="rounded-2xl p-5 grid grid-cols-2 gap-4"
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

  // ══════════════════════════════════════════════════════════════════════
  // WEB HOME — desktop website + mobile browser
  // Compact hero strip → promise bar → categories (primary, above fold) →
  // banner carousel → featured products → best sellers → why choose us
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* ── Hero — compact brand strip (~50% of previous height) ───────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}bb 55%, #0f172a 100%)` }}
      >
        {/* Subtle glow — no tall decorative circles */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <div className="absolute -top-8 right-0 w-72 h-72 rounded-full blur-3xl bg-white" />
        </div>

        <div className={`relative max-w-7xl mx-auto ${PAGE_X} py-5 sm:py-7`}>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Brand avatar */}
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-white font-black text-base sm:text-lg border-2 border-white/20 shrink-0"
              style={{ backgroundColor: `${brandColor}70` }}
            >
              {initial}
            </div>

            {/* Headline copy */}
            <div className="flex-1 min-w-0">
              <p className="text-white/60 text-[11px] font-medium leading-none mb-0.5 hidden sm:block">
                {currentBusinessName || "Our Store"}
              </p>
              <h1 className="text-white font-extrabold text-base sm:text-xl leading-snug">
                {heroContent.headline.replace(/\n/g, " ")}
              </h1>
              <p className="text-white/60 text-[11px] sm:text-xs mt-0.5 line-clamp-1 hidden sm:block">
                {heroContent.sub}
              </p>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm"
                style={{ color: brandColor }}
              >
                {heroContent.cta} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Delivery promise bar — compact single row ───────────────────── */}
      <section className="bg-gray-900 text-white">
        <div className={`max-w-7xl mx-auto ${PAGE_X} py-2.5`}>
          <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto scrollbar-none">
            {promiseItems.map(({ emoji, label, sub }) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <span className="text-base leading-none">{emoji}</span>
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold text-white leading-tight">{label}</p>
                  {sub && <p className="text-[10px] text-gray-500 hidden sm:block">{sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={`max-w-7xl mx-auto ${PAGE_X}`}>

        {/* ── PWA install prompt ───────────────────────────────────────── */}
        <PwaInstallBanner brandColor={brandColor} />

        {/* ═══════════════════════════════════════════════════════════════
            Categories — PRIMARY browsing element, immediately above fold.
            Blinkit-style: large square image cards, 4→10 cols responsive.
            Placed BEFORE the banner so they are always visible on load.
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-5 pb-4 sm:pt-6 sm:pb-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">{labels.categoryHeading}</h2>
            <button
              onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
              className={TYPE.VIEW_ALL}
              style={{ color: brandColor }}
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {catLoading ? (
            <div className={`${CATEGORY_GRID} ${CAT_GAP}`}>
              {Array.from({ length: 10 }).map((_, i) => <StorefrontCategoryCardSkeleton key={i} />)}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No categories added yet</p>
          ) : (
            <div className={`${CATEGORY_GRID} ${CAT_GAP}`}>
              {categories.map((c) => (
                <StorefrontCategoryCard
                  key={c.id}
                  category={c}
                  brandColor={brandColor}
                  businessType={currentBusinessType}
                  onClick={() => nav.go("category", { categoryId: c.id, categoryName: c.name })}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Banner carousel — secondary, after categories ──────────────── */}
        {currentBusinessId && (
          <section className="pb-6 sm:pb-8">
            <StorefrontBanner
              businessId={currentBusinessId}
              storeId={currentStoreId || null}
              brandColor={brandColor}
              variant="carousel"
            />
          </section>
        )}

        {/* ── Featured products ─────────────────────────────────────────── */}
        <section className="pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className={TYPE.SECTION_TITLE}>{labels.featuredHeading}</h2>
              <p className={TYPE.SECTION_SUB}>Fresh stock, updated daily</p>
            </div>
            <button
              onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
              className={TYPE.VIEW_ALL}
              style={{ color: brandColor }}
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {prodsLoading ? (
            <div className={`${PRODUCT_GRID} ${GRID_GAP}`}>
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : displayProducts.length === 0 ? (
            <StorefrontEmptyState
              variant="no-products"
              brandColor={brandColor}
              onAction={() => nav.go("category")}
            />
          ) : (
            <div className={`${PRODUCT_GRID} ${GRID_GAP}`}>
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

        {/* ── Best sellers ─────────────────────────────────────────────── */}
        {!prodsLoading && moreProducts.length > 0 && (
          <section className="pb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={TYPE.SECTION_TITLE}>{labels.bestSellersHeading}</h2>
                <p className={TYPE.SECTION_SUB}>Customer favourites</p>
              </div>
              <button
                onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                className={TYPE.VIEW_ALL}
                style={{ color: brandColor }}
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className={`${PRODUCT_GRID} ${GRID_GAP}`}>
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

        {/* ── Why choose us ─────────────────────────────────────────────── */}
        {storefrontWhyChooseUs.length > 0 && (
          <section className="py-8 border-t border-gray-100">
            <h2 className={`${TYPE.SECTION_TITLE} mb-6 text-center`}>Why Choose Us?</h2>
            <div
              className={`grid gap-5 ${
                storefrontWhyChooseUs.length <= 3
                  ? `grid-cols-${storefrontWhyChooseUs.length}`
                  : "grid-cols-2 md:grid-cols-4"
              }`}
            >
              {storefrontWhyChooseUs.map(({ emoji, title, desc }) => (
                <div key={title} className="text-center">
                  <div className="text-3xl mb-2">{emoji}</div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
