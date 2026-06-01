"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { getBusinessTypeConfig } from "@/lib/business-type-config"
import { ChevronRight, Zap, Shield, Star, Truck } from "lucide-react"
import type { WebNav } from "./storefront-website"
import { StorefrontProductCard, ProductCardSkeleton } from "./storefront-product-card"
import type { StorefrontProduct } from "./storefront-product-card"
import { StorefrontCategoryCard, StorefrontCategoryCardSkeleton } from "./storefront-category-card"
import type { StorefrontCategory } from "./storefront-category-card"
import { StorefrontBanner } from "./storefront-banner"
import { StorefrontEmptyState } from "./storefront-empty-state"
import { PwaInstallBanner } from "./pwa-install-banner"
import { TYPE, PRODUCT_GRID, GRID_GAP, CATEGORY_GRID, CAT_GAP, PAGE_X, SECTION_Y, BTN_LG, BTN_GHOST, primaryBtnStyle } from "@/design-system"

// ── Local type aliases ────────────────────────────────────────────────────
type Category = StorefrontCategory
type Product  = StorefrontProduct

// ── Business-type helpers ────────────────────────────────────────────────

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

function getWhyChooseUs(businessType: string) {
  switch (businessType) {
    case "MEAT_DELIVERY":
      return [
        { emoji: "🥩", title: "Fresh Daily",       desc: "Sourced and processed every morning" },
        { emoji: "✅", title: "Halal Certified",  desc: "100% halal, no compromise" },
        { emoji: "⚡", title: "Fast Delivery",    desc: "Within 2 hours of order" },
        { emoji: "🧊", title: "Hygienic Packing", desc: "Vacuum sealed, temp maintained" },
      ]
    case "GROCERY":
      return [
        { emoji: "🌿", title: "Farm Fresh",   desc: "Direct from farms to your home" },
        { emoji: "💰", title: "Best Prices",  desc: "Everyday low prices, guaranteed" },
        { emoji: "⚡", title: "30-min",        desc: "Express delivery in your area" },
        { emoji: "🔄", title: "Easy Returns", desc: "No-questions-asked returns" },
      ]
    default:
      return [
        { emoji: "✅", title: "Quality",      desc: "Verified and genuine products" },
        { emoji: "⚡", title: "Fast",         desc: "Express delivery options" },
        { emoji: "💰", title: "Best Prices",  desc: "Competitive pricing daily" },
        { emoji: "🔄", title: "Easy Returns", desc: "Hassle-free returns" },
      ]
  }
}

// ── Main component ───────────────────────────────────────────────────────

interface StorefrontHomeProps { brandColor: string; nav: WebNav; storeClosed?: boolean }

export function StorefrontHome({ brandColor, nav, storeClosed = false }: StorefrontHomeProps) {
  const { currentBusinessId, currentBusinessName, currentBusinessType, currentStoreId } = useAdminStore()
  const initial = (currentBusinessName || "Q").charAt(0).toUpperCase()

  const config      = getBusinessTypeConfig(currentBusinessType)
  const heroContent = getHeroContent(currentBusinessType)
  const whyChoose   = getWhyChooseUs(currentBusinessType)
  const deliveryCfg = config.deliveryConfig
  const labels      = config.labels

  const [categories, setCategories]       = useState<Category[]>([])
  const [catLoading, setCatLoading]       = useState(true)
  const [products, setProducts]           = useState<Product[]>([])
  const [prodsLoading, setProdsLoading]   = useState(true)

  // ── Categories ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentBusinessId) return
    setCatLoading(true)
    fetch(`/api/core/storefront/categories?businessId=${currentBusinessId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setCategories(j.data || []) })
      .catch(() => {})
      .finally(() => setCatLoading(false))
  }, [currentBusinessId])

  // ── Products ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentBusinessId) return
    setProdsLoading(true)

    const productParams = new URLSearchParams({ businessId: currentBusinessId, limit: "16" })
    if (currentStoreId) productParams.set("storeId", currentStoreId)
    fetch(`/api/core/storefront/products?${productParams}`)
      .then((r) => r.json())
      .then((j) => {
        // The API returns { success, data: Product[], pagination: { total } }
        // data IS the array — NOT an object with a .products key.
        const prods: Product[] = Array.isArray(j.data) ? j.data : []

        console.log("[StorefrontHome] products loaded", {
          businessId:   currentBusinessId,
          businessType: currentBusinessType,
          storeId:      currentStoreId,
          returned:     prods.length,
          apiSuccess:   j.success,
          paginationTotal: j.pagination?.total,
        })

        setProducts(prods)
      })
      .catch((err) => {
        console.error("[StorefrontHome] products fetch error", err)
      })
      .finally(() => setProdsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId])

  // Split into featured + rest — both from the SAME fetch
  const featured        = products.filter((p) => p.isFeatured)
  const displayProducts = featured.length > 0 ? featured.slice(0, 8) : products.slice(0, 8)
  const moreProducts    = featured.length > 0 ? products.filter((p) => !p.isFeatured).slice(0, 8) : products.slice(8, 16)

  const promiseItems = [
    { icon: Zap,    label: deliveryCfg.promiseHeadline, sub: deliveryCfg.promiseSubtext },
    { icon: Shield, label: "Verified Store",  sub: "Quality guaranteed" },
    { icon: Star,   label: "Top Rated",       sub: "Trusted by customers" },
    { icon: Truck,  label: "Free Delivery",   sub: "On qualifying orders" },
  ]

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
        <div className={`relative max-w-7xl mx-auto ${PAGE_X} py-16 sm:py-24`}>
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4 whitespace-pre-line">
              {heroContent.headline}
            </h2>
            <p className="text-white/80 text-base sm:text-lg mb-8 max-w-lg">{heroContent.sub}</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => nav.go("category", { categoryId: undefined, categoryName: "All Products" })}
                className={`${BTN_LG} bg-white hover:bg-gray-50 gap-2`}
                style={{ color: brandColor }}
              >
                {heroContent.cta} <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => nav.go("orders")}
                className={BTN_GHOST}
              >
                My Orders
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Delivery promise bar ─────────────────────────────── */}
      <section className="bg-gray-900 text-white">
        <div className={`max-w-7xl mx-auto ${PAGE_X} py-4`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {promiseItems.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}30` }}>
                  <Icon className="w-4 h-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">{label}</p>
                  <p className="text-[11px] text-gray-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={`max-w-7xl mx-auto ${PAGE_X}`}>

        {/* ── PWA install prompt ───────────────────────────────── */}
        <PwaInstallBanner brandColor={brandColor} />

        {/* ── Banner carousel ──────────────────────────────────── */}
        {currentBusinessId && (
          <section className={SECTION_Y}>
            <StorefrontBanner
              businessId={currentBusinessId}
              storeId={currentStoreId || null}
              brandColor={brandColor}
              variant="carousel"
            />
          </section>
        )}

        {/* ── Categories ──────────────────────────────────────── */}
        <section className={SECTION_Y}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className={TYPE.SECTION_TITLE}>{labels.categoryHeading}</h2>
              <p className={TYPE.SECTION_SUB}>Browse our selections</p>
            </div>
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
              {Array.from({ length: 8 }).map((_, i) => <StorefrontCategoryCardSkeleton key={i} />)}
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

        {/* ── Featured / primary products ──────────────────────── */}
        <section className="pb-10">
          <div className="flex items-center justify-between mb-6">
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
                <StorefrontProductCard key={p.id} product={p} brandColor={brandColor} nav={nav} businessType={currentBusinessType} storeClosed={storeClosed} />
              ))}
            </div>
          )}
        </section>

        {/* ── More / best sellers ───────────────────────────────── */}
        {!prodsLoading && moreProducts.length > 0 && (
          <section className="pb-12">
            <div className="flex items-center justify-between mb-6">
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
                <StorefrontProductCard key={p.id} product={p} brandColor={brandColor} nav={nav} businessType={currentBusinessType} storeClosed={storeClosed} />
              ))}
            </div>
          </section>
        )}

        {/* ── Why choose us ────────────────────────────────────── */}
        <section className="py-10 border-t border-gray-100">
          <h2 className={`${TYPE.SECTION_TITLE} mb-8 text-center`}>Why Choose Us?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {whyChoose.map(({ emoji, title, desc }) => (
              <div key={title} className="text-center">
                <div className="text-4xl mb-3">{emoji}</div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
