"use client"

import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { ChevronRight, Clock, Phone, MapPin } from "lucide-react"
import type { WebNav } from "./storefront-website"
import { StorefrontBanner } from "./storefront-banner"
import { PwaInstallBanner } from "./pwa-install-banner"
import { PAGE_X, TYPE } from "@/design-system"

import type { StorefrontProduct } from "./storefront-product-card"
import type { StorefrontCategory } from "./storefront-category-card"

type Category = StorefrontCategory
type Product = StorefrontProduct

const PROCESS_STEPS = [
  { icon: "📱", title: "Schedule Pickup", desc: "Book a pickup time that works for you" },
  { icon: "🚚", title: "We Pickup", desc: "Our partner collects your laundry" },
  { icon: "🫧", title: "Cleaning & Care", desc: "Professional wash, dry clean or iron" },
  { icon: "✅", title: "Quality Check", desc: "Every item is inspected before return" },
  { icon: "🚚", title: "Delivered Back", desc: "Freshly cleaned laundry at your door" },
]

const TESTIMONIALS = [
  { name: "Priya S.", text: "Excellent service! My clothes came back perfectly cleaned and folded.", rating: 5 },
  { name: "Rahul M.", text: "The subscription plan is a lifesaver. Regular pickup and delivery.", rating: 5 },
  { name: "Anita K.", text: "Dry cleaning quality is outstanding. Highly recommend!", rating: 4 },
]

interface StorefrontLaundryHomeProps {
  brandColor: string
  nav: WebNav
}

export function StorefrontLaundryHome({ brandColor, nav }: StorefrontLaundryHomeProps) {
  const {
    currentBusinessId, currentBusinessName, currentBusinessLogo,
    currentWorkspaceType, currentBusinessType,
  } = useAdminStore()

  const isLaundry = currentWorkspaceType === "LAUNDRY" || currentBusinessType === "LAUNDRY"

  const [categories, setCategories] = useState<Category[]>([])
  const [catLoading, setCatLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [prodsLoading, setProdsLoading] = useState(true)
  const [trackingNumber, setTrackingNumber] = useState("")
  const [contactInfo] = useState({ phone: "", address: "" })

  const initial = (currentBusinessName || "Q").charAt(0).toUpperCase()

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
    const params = new URLSearchParams({ businessId: currentBusinessId, limit: "50" })
    fetch(`/api/core/storefront/products?${params}`)
      .then((r) => r.json())
      .then((j) => { setProducts(Array.isArray(j.data) ? j.data : []) })
      .catch(() => {})
      .finally(() => setProdsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId])

  const featured = products.filter((p) => p.isFeatured)
  const displayProducts = featured.length > 0 ? featured : products.slice(0, 8)

  const handleTrackOrder = () => {
    if (trackingNumber.trim()) {
      nav.go("order-tracking", { orderId: trackingNumber.trim() })
    }
  }

  const handleSchedulePickup = () => {
    nav.go("checkout")
  }

  return (
    <div>
      {/* Hero Banner */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}bb 55%, #0f172a 100%)` }}
      >
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <div className="absolute -top-8 right-0 w-72 h-72 rounded-full blur-3xl bg-white" />
        </div>

        <div className={`relative max-w-7xl mx-auto ${PAGE_X} py-12 sm:py-16`}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-3 mb-4 justify-center sm:justify-start">
                {currentBusinessLogo ? (
                  <img
                    src={currentBusinessLogo}
                    alt={currentBusinessName || "Laundry"}
                    className="w-12 h-12 rounded-2xl object-contain border-2 border-white/20"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg border-2 border-white/20"
                    style={{ backgroundColor: `${brandColor}70` }}
                  >
                    {initial}
                  </div>
                )}
                <span className="text-white/60 text-sm font-medium">{currentBusinessName || "Laundry Service"}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-3">
                Professional Laundry
                <br />
                <span className="text-white/90">Delivered to Your Door</span>
              </h1>
              <p className="text-white/60 text-sm sm:text-base max-w-lg mb-6 mx-auto sm:mx-0">
                Schedule a pickup and get your clothes professionally washed, dried, and folded — delivered back within 24 hours.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
                <button
                  onClick={handleSchedulePickup}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm"
                  style={{ color: brandColor }}
                >
                  Schedule Pickup <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => nav.go("category")}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white border-2 border-white/30 hover:bg-white/10 transition-colors"
                >
                  View Services
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PWA Install */}
      <div className={`max-w-7xl mx-auto ${PAGE_X}`}>
        <PwaInstallBanner brandColor={brandColor} />
      </div>

      {/* Services Section */}
      <section className={`max-w-7xl mx-auto ${PAGE_X} py-12`}>
        <div className="text-center mb-8">
          <h2 className={TYPE.SECTION_TITLE}>Our Services</h2>
          <p className={TYPE.SECTION_SUB}>Professional care for all your clothing needs</p>
        </div>

        {catLoading || prodsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-full mb-3" />
                <div className="h-8 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 && displayProducts.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No services configured yet.</p>
        ) : (
          <>
            {categories.slice(0, 4).map((cat) => {
              const catProducts = products.filter((p) => p.categoryId === cat.id).slice(0, 4)
              if (catProducts.length === 0) return null
              return (
                <div key={cat.id} className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{cat.name}</h3>
                      <p className="text-xs text-gray-400">{catProducts.length} service{catProducts.length !== 1 ? "s" : ""}</p>
                    </div>
                    <button
                      onClick={() => nav.go("category", { categoryId: cat.id, categoryName: cat.name })}
                      className="flex items-center gap-0.5 text-[12px] font-semibold"
                      style={{ color: brandColor }}
                    >
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {catProducts.map((product) => (
                      <div
                        key={product.id}
                        className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                            style={{ backgroundColor: `${brandColor}12` }}
                          >
                            🧺
                          </div>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm mb-1">{product.name}</h4>
                        {product.description && (
                          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold" style={{ color: brandColor }}>
                            ₹{product.price}
                          </span>
                          <button
                            onClick={handleSchedulePickup}
                            className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                            style={{ backgroundColor: `${brandColor}12`, color: brandColor }}
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {displayProducts.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Popular Services</h3>
                    <p className="text-xs text-gray-400">Most requested laundry services</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {displayProducts.slice(0, 4).map((product) => (
                    <div
                      key={product.id}
                      className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-3"
                        style={{ backgroundColor: `${brandColor}12` }}
                      >
                        ✨
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm mb-1">{product.name}</h4>
                      {product.description && (
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold" style={{ color: brandColor }}>
                          ₹{product.price}
                        </span>
                        <button
                          className="text-xs font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: brandColor }}
                          onClick={() => nav.go("product", { productId: product.id })}
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Banner */}
      {currentBusinessId && (
        <section className={`max-w-7xl mx-auto ${PAGE_X} pb-8`}>
          <StorefrontBanner
            businessId={currentBusinessId}
            storeId={null}
            brandColor={brandColor}
            variant="carousel"
          />
        </section>
      )}

      {/* Pickup & Delivery Process */}
      <section className="bg-gray-50 py-12">
        <div className={`max-w-7xl mx-auto ${PAGE_X}`}>
          <div className="text-center mb-8">
            <h2 className={TYPE.SECTION_TITLE}>How It Works</h2>
            <p className={TYPE.SECTION_SUB}>Pickup. Clean. Deliver. In 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {PROCESS_STEPS.map((step, i) => (
              <div key={step.title} className="text-center relative">
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
                    style={{ backgroundColor: `${brandColor}12` }}
                  >
                    {step.icon}
                  </div>
                  {i < PROCESS_STEPS.length - 1 && (
                    <div className="hidden sm:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-gray-200" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-xs text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Order Tracking */}
      <section className={`max-w-7xl mx-auto ${PAGE_X} py-12`}>
        <div className="bg-gray-900 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Track Your Order</h2>
          <p className="text-sm text-gray-400 mb-6">Enter your order ID to track the status of your laundry</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Enter order ID..."
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrackOrder()}
              className="flex-1 h-12 px-4 rounded-xl text-sm bg-white/10 border border-white/20 text-white placeholder:text-gray-500 focus:outline-none focus:border-white/40"
            />
            <button
              onClick={handleTrackOrder}
              className="px-6 h-12 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              Track
            </button>
          </div>
        </div>
      </section>

      {/* Schedule Pickup CTA */}
      <section className={`max-w-7xl mx-auto ${PAGE_X} pb-12`}>
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)` }}
        >
          <h2 className="text-2xl font-bold text-white mb-2">Ready for Fresh Laundry?</h2>
          <p className="text-white/80 text-sm mb-6">Schedule a pickup now and we&apos;ll take care of the rest</p>
          <button
            onClick={handleSchedulePickup}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-white hover:bg-gray-50 transition-colors"
            style={{ color: brandColor }}
          >
            Schedule Pickup <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Testimonials Placeholder */}
      <section className="bg-gray-50 py-12">
        <div className={`max-w-7xl mx-auto ${PAGE_X}`}>
          <div className="text-center mb-8">
            <h2 className={TYPE.SECTION_TITLE}>What Our Customers Say</h2>
            <p className={TYPE.SECTION_SUB}>Trusted by hundreds of happy customers</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: brandColor }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className={`max-w-7xl mx-auto ${PAGE_X} py-12`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {currentBusinessLogo ? (
                <img
                  src={currentBusinessLogo}
                  alt={currentBusinessName}
                  className="w-8 h-8 rounded-xl object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                />
              ) : null}
              <span className="font-bold text-lg">{currentBusinessName || "Laundry Service"}</span>
            </div>
            <p className="text-sm text-gray-500">Professional laundry & dry cleaning services</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 text-gray-900">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><button onClick={() => nav.go("home")} className="hover:text-gray-900 transition-colors">Home</button></li>
              <li><button onClick={handleSchedulePickup} className="hover:text-gray-900 transition-colors">Schedule Pickup</button></li>
              <li><button onClick={() => nav.go("orders")} className="hover:text-gray-900 transition-colors">My Orders</button></li>
              <li><button onClick={() => nav.go("auth")} className="hover:text-gray-900 transition-colors">Login / Register</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 text-gray-900">Contact Us</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{contactInfo.phone || "+91 98765 43210"}</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{contactInfo.address || "Service available in your area"}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
