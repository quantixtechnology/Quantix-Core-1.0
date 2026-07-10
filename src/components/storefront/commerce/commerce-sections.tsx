"use client"

// Phase 3 — Commerce storefront section components.
//
// Presentation comes from the published section config (contentConfig /
// layoutConfig / styleConfig). Catalogue data comes from the live tenant APIs
// via data-source.ts. These reuse the existing, working catalogue cards
// (StorefrontProductCard / StorefrontCategoryCard / StorefrontBanner) so cart,
// product navigation and store scoping are preserved unchanged.
//
// NO hardcoded category marketing copy lives here — a Grocery/Meat/Neutral
// difference is entirely a function of the published template content.
import { ChevronRight } from "lucide-react"
import type { WebNav } from "@/components/storefront/web/storefront-website"
import { StorefrontProductCard, ProductCardSkeleton } from "@/components/storefront/web/storefront-product-card"
import { StorefrontCategoryCard, StorefrontCategoryCardSkeleton } from "@/components/storefront/web/storefront-category-card"
import { StorefrontBanner } from "@/components/storefront/web/storefront-banner"
import { StorefrontEmptyState } from "@/components/storefront/web/storefront-empty-state"
import { useCategoryData, useProductData } from "./data-source"
import type { LiveSection } from "@/lib/commerce/live-storefront"

export interface RenderContext {
  businessId: string
  storeId: string | null
  businessName: string
  businessType: string
  brandColor: string
  nav: WebNav
  storeClosed: boolean
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback)
const num = (v: unknown, fallback: number): number => (typeof v === "number" && !Number.isNaN(v) ? v : fallback)
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback)

// Resolve a template CTA/navigation destination to a safe storefront action.
// Only known destinations are honoured; javascript:/arbitrary URLs are ignored.
function navigateTo(nav: WebNav, href: string, extBlank = true) {
  const h = String(href || "").trim()
  if (!h || h === "#") { nav.go("category", { categoryName: "All Products" }); return }
  if (/^https?:\/\//i.test(h)) { if (typeof window !== "undefined") window.open(h, extBlank ? "_blank" : "_self", "noopener,noreferrer"); return }
  const key = h.replace(/^\/+/, "").split(/[/?#]/)[0].toLowerCase()
  if (!key || key === "home") { nav.go("home"); return }
  if (key === "products" || key === "product" || key === "category" || key === "categories") { nav.go("category", { categoryName: "All Products" }); return }
  // Any other internal path → a template custom page resolved by the multi-page renderer.
  nav.go("template", { templateSlug: key })
}

// ── HERO ─────────────────────────────────────────────────────────────────
function HeroSection({ section, ctx }: { section: LiveSection; ctx: RenderContext }) {
  const c = section.contentConfig
  const heading = str(c.heading)
  const subheading = str(c.subheading)
  const eyebrow = str(c.eyebrow)
  const ctaText = str(c.ctaText)
  const ctaHref = str(c.ctaHref, "/products")
  const align = str(c.contentAlignment, "left")
  const image = str(c.desktopImage) || str(c.image)
  const overlay = num(c.overlay, 0.25)
  const initial = (ctx.businessName || "Q").charAt(0).toUpperCase()
  const alignCls = align === "center" ? "items-center text-center justify-center" : align === "right" ? "items-end text-right" : "items-start text-left"

  return (
    <section className="relative overflow-hidden" style={{ background: image ? undefined : `linear-gradient(135deg, ${ctx.brandColor} 0%, ${ctx.brandColor}bb 55%, #0f172a 100%)` }}>
      {image && <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {image && <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />}
      <div className={`relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-3 ${alignCls}`}>
        {!image && (
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg border-2 border-white/20" style={{ backgroundColor: `${ctx.brandColor}70` }}>{initial}</div>
        )}
        {eyebrow && <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{eyebrow}</p>}
        <h1 className="text-white font-extrabold text-2xl sm:text-4xl leading-tight max-w-2xl whitespace-pre-line">{heading || ctx.businessName || "Welcome"}</h1>
        {subheading && <p className="text-white/70 text-sm sm:text-base max-w-xl">{subheading}</p>}
        {ctaText && (
          <button onClick={() => navigateTo(ctx.nav, ctaHref)} className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-white hover:bg-gray-50 transition-colors shadow-sm w-max" style={{ color: ctx.brandColor }}>
            {ctaText} <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  )
}

// ── CATEGORY_GRID ──────────────────────────────────────────────────────────
function CategoryGridSection({ section, ctx }: { section: LiveSection; ctx: RenderContext }) {
  const { items, loading } = useCategoryData(ctx.businessId, section.dataSourceConfig)
  const l = section.layoutConfig
  const c = section.contentConfig
  const title = str(c.title) || str(c.heading, "Shop by Category")
  const subtitle = str(c.subtitle)
  const showViewAll = bool(l.showViewAll, true)
  const cols = num(l.columns, 4)
  const mobileCols = num(l.mobileColumns, 2)
  const gridId = `cg-${section.id.replace(/[^a-z0-9]/gi, "")}`

  if (!loading && items.length === 0 && bool(l.hideWhenEmpty, true)) return null
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {showViewAll && (
          <button onClick={() => ctx.nav.go("category", { categoryName: "All Products" })} className="flex items-center gap-0.5 text-sm font-semibold" style={{ color: ctx.brandColor }}>
            View all <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className={`${gridId} grid gap-3 sm:gap-4`}>
        <style>{`.${gridId}{grid-template-columns:repeat(${mobileCols},minmax(0,1fr))}@media(min-width:640px){.${gridId}{grid-template-columns:repeat(${cols},minmax(0,1fr))}}`}</style>
        {loading ? (
          Array.from({ length: cols }).map((_, i) => <StorefrontCategoryCardSkeleton key={i} />)
        ) : (
          items.map((cat) => (
            <StorefrontCategoryCard key={cat.id} category={cat} brandColor={ctx.brandColor} businessType={ctx.businessType} onClick={() => ctx.nav.go("category", { categoryId: cat.id, categoryName: cat.name })} />
          ))
        )}
      </div>
    </section>
  )
}

// ── PRODUCT_GRID ───────────────────────────────────────────────────────────
function ProductGridSection({ section, ctx }: { section: LiveSection; ctx: RenderContext }) {
  const { items, loading } = useProductData(ctx.businessId, ctx.storeId, section.dataSourceConfig)
  const l = section.layoutConfig
  const c = section.contentConfig
  const title = str(c.title) || str(c.heading, "Products")
  const subtitle = str(c.subtitle)
  const cols = num(l.columns, 4)
  const mobileCols = num(l.mobileColumns, 2)
  const gridId = `pg-${section.id.replace(/[^a-z0-9]/gi, "")}`

  if (!loading && items.length === 0) {
    if (bool(l.hideWhenEmpty, false)) return null
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {title && <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{title}</h2>}
        <StorefrontEmptyState variant="no-products" brandColor={ctx.brandColor} onAction={() => ctx.nav.go("category", { categoryName: "All Products" })} />
      </section>
    )
  }
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={() => ctx.nav.go("category", { categoryName: "All Products" })} className="flex items-center gap-0.5 text-sm font-semibold" style={{ color: ctx.brandColor }}>
          View all <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className={`${gridId} grid gap-3 sm:gap-4`}>
        <style>{`.${gridId}{grid-template-columns:repeat(${mobileCols},minmax(0,1fr))}@media(min-width:640px){.${gridId}{grid-template-columns:repeat(${cols},minmax(0,1fr))}}`}</style>
        {loading
          ? Array.from({ length: cols * 2 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : items.map((p) => (
              <StorefrontProductCard key={p.id} product={p} brandColor={ctx.brandColor} nav={ctx.nav} businessType={ctx.businessType} storeClosed={ctx.storeClosed} />
            ))}
      </div>
    </section>
  )
}

// ── OFFER_BANNER / IMAGE_BANNER ──────────────────────────────────────────────
function BannerSection({ section, ctx }: { section: LiveSection; ctx: RenderContext }) {
  const c = section.contentConfig
  const image = str(c.image) || str(c.desktopImage)
  const heading = str(c.heading)
  const subheading = str(c.subheading)
  const ctaText = str(c.ctaText)
  const ctaHref = str(c.ctaHref, "/products")

  // If explicit banner content is configured, render it; otherwise fall back to
  // the tenant's live promotional banners (existing StorefrontBanner).
  if (image || heading) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="relative overflow-hidden rounded-2xl" style={{ background: image ? undefined : `${ctx.brandColor}12`, minHeight: 140 }}>
          {image && <img src={image} alt={heading} className="w-full h-full object-cover" />}
          {(heading || ctaText) && (
            <div className="absolute inset-0 flex flex-col justify-center gap-2 p-6">
              {heading && <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{heading}</h3>}
              {subheading && <p className="text-sm text-gray-600 max-w-md">{subheading}</p>}
              {ctaText && (
                <button onClick={() => navigateTo(ctx.nav, ctaHref)} className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white w-max" style={{ backgroundColor: ctx.brandColor }}>
                  {ctaText} <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    )
  }
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
      <StorefrontBanner businessId={ctx.businessId} storeId={ctx.storeId} brandColor={ctx.brandColor} variant="carousel" />
    </section>
  )
}

// ── CTA ──────────────────────────────────────────────────────────────────
function CtaSection({ section, ctx }: { section: LiveSection; ctx: RenderContext }) {
  const c = section.contentConfig
  const heading = str(c.heading)
  const subheading = str(c.subheading)
  const ctaText = str(c.ctaText, "Shop Now")
  const ctaHref = str(c.ctaHref, "/products")
  if (!heading && !ctaText) return null
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-2xl p-8 text-center flex flex-col items-center gap-3" style={{ backgroundColor: `${ctx.brandColor}10` }}>
        {heading && <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">{heading}</h3>}
        {subheading && <p className="text-sm text-gray-600 max-w-lg">{subheading}</p>}
        <button onClick={() => navigateTo(ctx.nav, ctaHref)} className="mt-1 inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: ctx.brandColor }}>
          {ctaText} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  )
}

// ── TEXT_BLOCK ─────────────────────────────────────────────────────────────
function TextBlockSection({ section, ctx }: { section: LiveSection; ctx: RenderContext }) {
  const c = section.contentConfig
  const heading = str(c.heading)
  const body = str(c.body) || str(c.text)
  const align = str(c.align, "center")
  if (!heading && !body) return null
  return (
    <section className={`max-w-4xl mx-auto px-4 sm:px-6 py-8 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}>
      {heading && <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{heading}</h2>}
      {body && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{body}</p>}
    </section>
  )
}

// ── Registry: sectionType → renderer. Unknown/structural (HEADER/FOOTER) → null
// (HEADER/FOOTER are provided by the functional global chrome, StorefrontLayout).
type SectionComponent = (props: { section: LiveSection; ctx: RenderContext }) => React.ReactElement | null

export const SECTION_COMPONENTS: Record<string, SectionComponent> = {
  HERO: HeroSection,
  CATEGORY_GRID: CategoryGridSection,
  CATEGORY_CAROUSEL: CategoryGridSection,
  PRODUCT_GRID: ProductGridSection,
  PRODUCT_CAROUSEL: ProductGridSection,
  OFFER_BANNER: BannerSection,
  IMAGE_BANNER: BannerSection,
  PROMO_SECTION: BannerSection,
  CTA: CtaSection,
  TEXT_BLOCK: TextBlockSection,
}

// Structural sections intentionally rendered by the global chrome, not the body.
export const CHROME_SECTIONS = new Set(["HEADER", "FOOTER"])
