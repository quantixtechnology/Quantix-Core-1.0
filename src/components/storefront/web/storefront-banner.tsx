"use client"

// ============================================================================
// StorefrontBanner — auto-sliding banner carousel for all storefront pages.
//
// Fetches banners from /api/v1/storefront/banners and renders them as a
// touch-friendly slider with dot indicators and prev/next controls.
// Businesses upload banners through the admin panel — no code changes needed.
//
// Variants:
//   "carousel" (default) — full-width sliding banners with auto-advance
//   "single"             — displays only the first active banner
//   "promo"              — compact strip banner with CTA button
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { ANIM } from "@/design-system"

// ── Banner shape (matches /api/v1/storefront/banners response) ────────────

interface Banner {
  id: string
  title: string | null
  imageUrl: string
  link: string | null
}

// ── Shared skeleton ───────────────────────────────────────────────────────

export function StorefrontBannerSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`w-full ${compact ? "h-20" : "h-48 sm:h-56 md:h-64"} rounded-2xl bg-gray-100 ${ANIM.SKELETON}`}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────

type BannerVariant = "carousel" | "single" | "promo"

interface StorefrontBannerProps {
  businessId: string
  storeId?: string | null
  brandColor: string
  variant?: BannerVariant
  /** Auto-advance interval in ms (default: 4000) */
  interval?: number
  /** Custom headline when no banners are loaded (carousel/single) */
  fallbackChildren?: React.ReactNode
}

export function StorefrontBanner({
  businessId,
  storeId,
  brandColor,
  variant = "carousel",
  interval = 4000,
  fallbackChildren,
}: StorefrontBannerProps) {
  const [banners, setBanners]   = useState<Banner[]>([])
  const [current, setCurrent]   = useState(0)
  const [loading, setLoading]   = useState(true)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    const params = new URLSearchParams({ businessId })
    if (storeId) params.set("storeId", storeId)
    fetch(`/api/v1/storefront/banners?${params}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setBanners(j.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId, storeId])

  // ── Auto-advance (carousel only) ───────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (banners.length > 1 && variant === "carousel") {
      timerRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % banners.length)
      }, interval)
    }
  }, [banners.length, variant, interval])

  useEffect(() => {
    startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [startTimer])

  const goTo = (idx: number) => {
    setCurrent(idx)
    startTimer() // reset timer on manual nav
  }

  const prev = () => goTo((current - 1 + banners.length) % banners.length)
  const next = () => goTo((current + 1) % banners.length)

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) return <StorefrontBannerSkeleton compact={variant === "promo"} />

  // ── No banners — render fallback if provided ────────────────────────────
  if (banners.length === 0) {
    return fallbackChildren ? <>{fallbackChildren}</> : null
  }

  // ── Promo strip ─────────────────────────────────────────────────────────
  if (variant === "promo") {
    const b = banners[0]
    return (
      <div
        className="w-full rounded-xl overflow-hidden flex items-center gap-4 px-5 py-3"
        style={{ backgroundColor: `${brandColor}15` }}
      >
        {b.imageUrl && (
          <img src={b.imageUrl} alt={b.title ?? "Promo"} className="w-14 h-14 object-cover rounded-lg shrink-0" />
        )}
        {b.title && (
          <p className="flex-1 text-sm font-semibold text-gray-800 line-clamp-2">{b.title}</p>
        )}
        {b.link && (
          <a
            href={b.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
            style={{ backgroundColor: brandColor }}
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    )
  }

  // ── Single banner ───────────────────────────────────────────────────────
  if (variant === "single") {
    const b = banners[0]
    const content = (
      <div className="relative w-full h-48 sm:h-56 md:h-64 rounded-2xl overflow-hidden">
        <img src={b.imageUrl} alt={b.title ?? "Banner"} className="w-full h-full object-cover" loading="lazy" />
        {b.title && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-5">
            <p className="text-white font-bold text-lg">{b.title}</p>
          </div>
        )}
      </div>
    )
    return b.link ? (
      <a href={b.link} target="_blank" rel="noopener noreferrer">{content}</a>
    ) : content
  }

  // ── Carousel (default) ──────────────────────────────────────────────────
  return (
    <div className="relative w-full rounded-2xl overflow-hidden select-none">
      {/* Slides */}
      <div className="relative h-48 sm:h-56 md:h-64">
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={`absolute inset-0 transition-opacity duration-500 ${i === current ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            {b.link ? (
              <a href={b.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                <img src={b.imageUrl} alt={b.title ?? "Banner"} className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
              </a>
            ) : (
              <img src={b.imageUrl} alt={b.title ?? "Banner"} className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
            )}
            {b.title && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none flex items-end p-5">
                <p className="text-white font-bold text-lg drop-shadow">{b.title}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prev / Next arrows (only when > 1 banner) */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
            aria-label="Next banner"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-200 ${
                i === current ? "w-5 h-2" : "w-2 h-2 bg-white/60"
              }`}
              style={i === current ? { backgroundColor: brandColor } : {}}
              aria-label={`Go to banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
