"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { StorefrontLayout } from "./storefront-layout"
import { StorefrontHome } from "./storefront-home"
import { StorefrontCategoryPage } from "./storefront-category"
import { StorefrontProductPage } from "./storefront-product"
import { StorefrontAuth } from "./storefront-auth"
import { StorefrontCheckout } from "./storefront-checkout"
import { StorefrontOrderTracking } from "./storefront-order-tracking"
import { StorefrontOrders } from "./storefront-orders"
import { StorefrontLaundryOrders } from "./storefront-laundry-orders"
import { CustomerAccountCenter } from "./account/customer-account-center"
import { CustomerProfileEditor } from "./account/customer-profile-editor"
import { StorefrontAddresses } from "./storefront-addresses"
import { StorefrontPassword } from "./storefront-password"
import { StorefrontStorePicker, type PickedStore } from "./storefront-store-picker"
import { PwaMetaUpdater } from "@/components/storefront/pwa-meta-updater"
import { useLiveTemplate } from "@/components/storefront/commerce/use-live-template"
import { CommercePageRenderer } from "@/components/storefront/commerce/commerce-page-renderer"
import type { RenderContext } from "@/components/storefront/commerce/commerce-sections"

export type WebPage =
  | "home"
  | "template"      // template-driven custom page (Phase 3 multi-page)
  | "category"
  | "product"
  | "auth"
  | "checkout"
  | "order-tracking"
  | "orders"
  | "profile"
  | "my-profile"
  | "subscriptions"
  | "invoices"
  | "payments"
  | "addresses"
  | "password"

type NavSnapshot = {
  page: WebPage
  categoryId: string | null
  categoryName: string
  productId: string | null
  orderId: string | null
  templateSlug: string | null
}

export interface WebNav {
  go: (page: WebPage, opts?: {
    categoryId?: string
    categoryName?: string
    productId?: string
    orderId?: string
    templateSlug?: string
  }) => void
  goBack: (defaultPage?: WebPage) => void
  canGoBack: boolean
  current: WebPage
  categoryId: string | null
  categoryName: string
  productId: string | null
  orderId: string | null
  templateSlug: string | null
  prevPage: WebPage | null
}

// ── Store status check ──────────────────────────────────────────────────────
// Called periodically to re-check isOnline + current timings
async function fetchStoreStatus(businessId: string, storeId: string | null): Promise<{
  isOnline: boolean
  isOpen: boolean
  message: string
  opensAt: string | null
}> {
  try {
    const params = new URLSearchParams({ businessId })
    if (storeId) params.set("storeId", storeId)
    const res = await fetch(`/api/core/storefront/store-context?${params}`)
    const json = await res.json()
    if (!json.success) return { isOnline: false, isOpen: false, message: "Store unavailable", opensAt: null }

    const biz   = json.data?.business ?? {}
    const store = json.data?.store ?? {}

    const isOnline = biz.isOnline !== false

    // Client-side hours check (mirrors backend logic)
    let isOpen = isOnline
    let message = isOnline ? "" : "Store is currently offline"
    let opensAt: string | null = null

    if (isOnline && store.storeTimings && store.storeTimings.length > 0) {
      const istOffset = 5.5 * 60 * 60 * 1000
      const istNow    = new Date(Date.now() + istOffset)
      const todayDay  = istNow.getUTCDay()
      const nowMin    = istNow.getUTCHours() * 60 + istNow.getUTCMinutes()
      const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
      const todayRow  = store.storeTimings.find((t: { day: number }) => t.day === todayDay)

      if (todayRow?.isClosed) {
        isOpen  = false
        message = "Store is closed today"
        // Find next open day
        for (let i = 1; i <= 7; i++) {
          const d = (todayDay + i) % 7
          const row = store.storeTimings.find((t: { day: number }) => t.day === d)
          if (row && !row.isClosed) { opensAt = `${i === 1 ? "Tomorrow" : DAY_NAMES[d]} at ${row.openTime}`; break }
        }
      } else if (todayRow) {
        const [oh, om]  = todayRow.openTime.split(":").map(Number)
        const [ch, cm]  = todayRow.closeTime.split(":").map(Number)
        const openMin   = oh * 60 + om
        const closeMin  = ch * 60 + cm

        if (nowMin < openMin) {
          isOpen  = false
          message = `Store opens at ${todayRow.openTime}`
          opensAt = todayRow.openTime
        } else if (nowMin >= closeMin) {
          isOpen  = false
          for (let i = 1; i <= 7; i++) {
            const d = (todayDay + i) % 7
            const row = store.storeTimings.find((t: { day: number }) => t.day === d)
            if (row && !row.isClosed) { opensAt = `${i === 1 ? "Tomorrow" : DAY_NAMES[d]} at ${row.openTime}`; break }
          }
          message = `Store is closed. ${opensAt ? `Opens ${opensAt}` : ""}`
        }
      }
    }

    return { isOnline, isOpen, message, opensAt }
  } catch {
    return { isOnline: true, isOpen: true, message: "", opensAt: null }
  }
}

export function StorefrontWebsite() {
  const { currentBusinessId, currentBusinessName, currentBusinessType, currentBusinessPrimaryColor } = useAdminStore()
  const { switchStore, restoreStore, storeId: cartStoreId } = useCartStore()
  const brandColor = currentBusinessPrimaryColor || "#C62828"

  const [page, setPage] = useState<WebPage>("home")
  const [navStack, setNavStack] = useState<NavSnapshot[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [productId, setProductId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [templateSlug, setTemplateSlug] = useState<string | null>(null)

  // Ref keeps current nav state accessible inside stable callbacks without
  // listing every field as a useCallback dependency.
  const snapRef = useRef<NavSnapshot>({ page: "home", categoryId: null, categoryName: "", productId: null, orderId: null, templateSlug: null })
  snapRef.current = { page, categoryId, categoryName, productId, orderId, templateSlug }

  // Ref mirrors navStack so the popstate handler can read current length
  // synchronously without re-subscribing on every stack change.
  const navStackRef = useRef<NavSnapshot[]>([])

  // Store picker state
  const [showStorePicker, setShowStorePicker] = useState(false)
  const [pickerMandatory, setPickerMandatory] = useState(false)
  const [currentStore, setCurrentStore] = useState<PickedStore | null>(null)

  // Store status — polled every 60 seconds so the UI reacts to open/close windows
  const [storeStatus, setStoreStatus] = useState<{
    isOnline: boolean; isOpen: boolean; message: string; opensAt: string | null
  }>({ isOnline: true, isOpen: true, message: "", opensAt: null })

  // On mount: check localStorage for a saved store; if none, show mandatory picker
  useEffect(() => {
    if (!currentBusinessId) return
    const key = `quantix_store_${currentBusinessId}`
    const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null
    if (saved) {
      try {
        const parsed: PickedStore = JSON.parse(saved)
        setCurrentStore(parsed)
        // Preserve persisted cart items if same store; clear only on store change.
        if (cartStoreId === parsed.id) {
          restoreStore(parsed.id, parsed.deliveryFee)
        } else {
          switchStore(parsed.id, parsed.deliveryFee, [])
        }
      } catch {
        // corrupt data — show picker
        setPickerMandatory(true)
        setShowStorePicker(true)
      }
    } else {
      setPickerMandatory(true)
      setShowStorePicker(true)
    }
  }, [currentBusinessId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStoreSelected = useCallback((store: PickedStore) => {
    const key = `quantix_store_${currentBusinessId}`
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(store))
    }
    // User explicitly picked a store — always clear the cart.
    switchStore(store.id, store.deliveryFee, [])
    setCurrentStore(store)
    setShowStorePicker(false)
    setPickerMandatory(false)
  }, [currentBusinessId, switchStore])

  const handleOpenStorePicker = useCallback(() => {
    setPickerMandatory(false)
    setShowStorePicker(true)
  }, [])

  // Poll store status once on mount and whenever the store changes, then every 60s
  useEffect(() => {
    if (!currentBusinessId) return
    const storeId = currentStore?.id ?? null
    const check = () => fetchStoreStatus(currentBusinessId, storeId).then(setStoreStatus)
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [currentBusinessId, currentStore?.id])

  const go = useCallback((
    p: WebPage,
    opts?: { categoryId?: string; categoryName?: string; productId?: string; orderId?: string; templateSlug?: string },
  ) => {
    const curr = snapRef.current
    // Push current state onto the stack only when navigating to a different page
    // (or a different template page under the same "template" route).
    const changed = p !== curr.page || (p === "template" && (opts?.templateSlug ?? null) !== curr.templateSlug)
    if (changed) {
      setNavStack(prev => {
        const next = [...prev, { ...curr }]
        navStackRef.current = next
        return next
      })
      // Add a browser history entry so Android back button fires popstate.
      if (typeof window !== "undefined") window.history.pushState(null, "")
    }
    setPage(p)
    if (opts?.categoryId !== undefined) setCategoryId(opts.categoryId ?? null)
    if (opts?.categoryName !== undefined) setCategoryName(opts.categoryName ?? "")
    if (opts?.productId !== undefined) setProductId(opts.productId ?? null)
    if (opts?.orderId !== undefined) setOrderId(opts.orderId ?? null)
    if (opts?.templateSlug !== undefined) setTemplateSlug(opts.templateSlug ?? null)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }, []) // stable — reads state via ref

  const goBack = useCallback((defaultPage: WebPage = "home") => {
    setNavStack(prev => {
      if (prev.length === 0) {
        navStackRef.current = []
        setPage(defaultPage)
        setCategoryId(null)
        setCategoryName("")
        setProductId(null)
        setOrderId(null)
        setTemplateSlug(null)
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
        return prev
      }
      const last = prev[prev.length - 1]
      const next = prev.slice(0, -1)
      navStackRef.current = next
      setPage(last.page)
      setCategoryId(last.categoryId)
      setCategoryName(last.categoryName)
      setProductId(last.productId)
      setOrderId(last.orderId)
      setTemplateSlug(last.templateSlug)
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
      return next
    })
  }, []) // stable — no external deps

  // Intercept Android hardware back button in PWA by listening to popstate.
  // Each in-app navigation pushes a history entry; back consumes one entry
  // and calls goBack(). When the stack is empty, the PWA exits normally.
  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => {
      if (navStackRef.current.length > 0) {
        goBack()
      }
    }
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [goBack])

  const prevPage: WebPage | null = navStack.length > 0 ? navStack[navStack.length - 1].page : null
  const canGoBack = navStack.length > 0

  const nav: WebNav = { go, goBack, canGoBack, current: page, categoryId, categoryName, productId, orderId, templateSlug, prevPage }

  const storeClosed = !storeStatus.isOpen

  // Phase 3 — live template render directive for the current template-driven
  // page (home, or a custom template page). Resolver logic is entirely
  // server-side; this only consumes the decision. Legacy pages ignore it.
  const activeTemplateSlug = page === "template" ? (templateSlug || "home") : "home"
  const templateState = useLiveTemplate(currentBusinessId || null, currentStore?.id ?? null, activeTemplateSlug)
  const directive = templateState.status === "ready" ? templateState.directive : null
  const renderCtx: RenderContext = {
    businessId: currentBusinessId || "",
    storeId: currentStore?.id ?? null,
    businessName: currentBusinessName || "",
    businessType: currentBusinessType || "",
    brandColor,
    nav,
    storeClosed,
  }
  // Home renders via the template renderer only when the server says so AND a
  // published page with sections resolved; otherwise the legacy home renders.
  const homeIsTemplate = directive?.effective === "template" && !!directive.page && directive.page.sections.length > 0

  return (
    <>
      {/* Updates <meta name="theme-color">, apple-touch-icon, and title per business */}
      <PwaMetaUpdater />

      <StorefrontLayout brandColor={brandColor} nav={nav} currentStore={currentStore} onOpenStorePicker={handleOpenStorePicker}>
        {/* ── Store Offline / Closed Banner ──────────────────────── */}
        {storeClosed && (
          <div className="sticky top-0 z-40 w-full bg-gray-900 text-white text-center py-3 px-4">
            <p className="text-sm font-semibold">
              🔴 {storeStatus.message || "Store is currently closed"}
              {storeStatus.opensAt && (
                <span className="ml-2 font-normal text-gray-300">
                  · Opens {storeStatus.opensAt}
                </span>
              )}
            </p>
          </div>
        )}

        {page === "home" && (
          homeIsTemplate
            ? <CommercePageRenderer sections={directive!.page!.sections} ctx={renderCtx} />
            : <StorefrontHome brandColor={brandColor} nav={nav} storeClosed={storeClosed} />
        )}
        {page === "template" && (
          templateState.status === "loading"
            ? null
            : directive?.effective === "template" && directive.page && directive.page.sections.length > 0
              ? <CommercePageRenderer sections={directive.page.sections} ctx={renderCtx} />
              : (
                  <div className="max-w-2xl mx-auto px-4 py-24 text-center">
                    <div className="text-6xl font-black text-gray-100 select-none mb-4">404</div>
                    <h1 className="text-lg font-bold text-gray-900">Page not found</h1>
                    <button onClick={() => nav.go("home")} className="mt-4 text-sm font-semibold" style={{ color: brandColor }}>Back to home</button>
                  </div>
                )
        )}
        {page === "category"       && <StorefrontCategoryPage  brandColor={brandColor} nav={nav} storeClosed={storeClosed} />}
        {page === "product"        && <StorefrontProductPage   brandColor={brandColor} nav={nav} />}
        {page === "auth"           && <StorefrontAuth          brandColor={brandColor} nav={nav} />}
        {page === "checkout"       && <StorefrontCheckout      brandColor={brandColor} nav={nav} currentStore={currentStore} storeClosed={storeClosed} storeClosedMessage={storeStatus.message} />}
        {/* LAUNDRY reuses the laundry Order Engine end-to-end (orders + tracking +
            payments + invoice). Non-laundry keeps the ecommerce screens. */}
        {page === "order-tracking" && (currentBusinessType === "LAUNDRY"
          ? <StorefrontLaundryOrders brandColor={brandColor} nav={nav} />
          : <StorefrontOrderTracking brandColor={brandColor} nav={nav} />)}
        {page === "orders" && (currentBusinessType === "LAUNDRY"
          ? <StorefrontLaundryOrders brandColor={brandColor} nav={nav} />
          : <StorefrontOrders brandColor={brandColor} nav={nav} />)}
        {page === "profile"        && <CustomerAccountCenter   brandColor={brandColor} nav={nav} />}
        {page === "my-profile"     && <CustomerProfileEditor   brandColor={brandColor} nav={nav} />}
        {page === "addresses"      && <StorefrontAddresses     brandColor={brandColor} nav={nav} />}
        {page === "password"       && <StorefrontPassword      brandColor={brandColor} nav={nav} />}
      </StorefrontLayout>

      {showStorePicker && currentBusinessId && (
        <StorefrontStorePicker
          businessId={currentBusinessId}
          currentStoreId={currentStore?.id}
          brandColor={brandColor}
          mandatory={pickerMandatory}
          onSelect={handleStoreSelected}
          onClose={pickerMandatory ? undefined : () => setShowStorePicker(false)}
        />
      )}
    </>
  )
}
