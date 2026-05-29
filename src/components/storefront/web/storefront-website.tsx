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
import { StorefrontProfile } from "./storefront-profile"
import { StorefrontAddresses } from "./storefront-addresses"
import { StorefrontPassword } from "./storefront-password"
import { StorefrontStorePicker, type PickedStore } from "./storefront-store-picker"

export type WebPage =
  | "home"
  | "category"
  | "product"
  | "auth"
  | "checkout"
  | "order-tracking"
  | "orders"
  | "profile"
  | "addresses"
  | "password"

type NavSnapshot = {
  page: WebPage
  categoryId: string | null
  categoryName: string
  productId: string | null
  orderId: string | null
}

export interface WebNav {
  go: (page: WebPage, opts?: {
    categoryId?: string
    categoryName?: string
    productId?: string
    orderId?: string
  }) => void
  goBack: (defaultPage?: WebPage) => void
  canGoBack: boolean
  current: WebPage
  categoryId: string | null
  categoryName: string
  productId: string | null
  orderId: string | null
  prevPage: WebPage | null
}

export function StorefrontWebsite() {
  const { currentBusinessId, currentBusinessPrimaryColor } = useAdminStore()
  const { switchStore, storeId: cartStoreId } = useCartStore()
  const brandColor = currentBusinessPrimaryColor || "#C62828"

  const [page, setPage] = useState<WebPage>("home")
  const [navStack, setNavStack] = useState<NavSnapshot[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [productId, setProductId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  // Ref keeps current nav state accessible inside stable callbacks without
  // listing every field as a useCallback dependency.
  const snapRef = useRef<NavSnapshot>({ page: "home", categoryId: null, categoryName: "", productId: null, orderId: null })
  snapRef.current = { page, categoryId, categoryName, productId, orderId }

  // Store picker state
  const [showStorePicker, setShowStorePicker] = useState(false)
  const [pickerMandatory, setPickerMandatory] = useState(false)
  const [currentStore, setCurrentStore] = useState<PickedStore | null>(null)

  // On mount: check localStorage for a saved store; if none, show mandatory picker
  useEffect(() => {
    if (!currentBusinessId) return
    const key = `quantix_store_${currentBusinessId}`
    const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null
    if (saved) {
      try {
        const parsed: PickedStore = JSON.parse(saved)
        setCurrentStore(parsed)
        switchStore(parsed.id, parsed.deliveryFee, [])
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
    // If switching away from an existing store, clear cart
    if (cartStoreId && cartStoreId !== store.id) {
      switchStore(store.id, store.deliveryFee, [])
    } else {
      switchStore(store.id, store.deliveryFee, [])
    }
    setCurrentStore(store)
    setShowStorePicker(false)
    setPickerMandatory(false)
  }, [currentBusinessId, cartStoreId, switchStore])

  const handleOpenStorePicker = useCallback(() => {
    setPickerMandatory(false)
    setShowStorePicker(true)
  }, [])

  const go = useCallback((
    p: WebPage,
    opts?: { categoryId?: string; categoryName?: string; productId?: string; orderId?: string },
  ) => {
    const curr = snapRef.current
    // Push current state onto the stack only when navigating to a different page.
    if (p !== curr.page) {
      setNavStack(prev => [...prev, { ...curr }])
    }
    setPage(p)
    if (opts?.categoryId !== undefined) setCategoryId(opts.categoryId ?? null)
    if (opts?.categoryName !== undefined) setCategoryName(opts.categoryName ?? "")
    if (opts?.productId !== undefined) setProductId(opts.productId ?? null)
    if (opts?.orderId !== undefined) setOrderId(opts.orderId ?? null)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }, []) // stable — reads state via ref

  const goBack = useCallback((defaultPage: WebPage = "home") => {
    setNavStack(prev => {
      if (prev.length === 0) {
        setPage(defaultPage)
        setCategoryId(null)
        setCategoryName("")
        setProductId(null)
        setOrderId(null)
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
        return prev
      }
      const last = prev[prev.length - 1]
      setPage(last.page)
      setCategoryId(last.categoryId)
      setCategoryName(last.categoryName)
      setProductId(last.productId)
      setOrderId(last.orderId)
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
      return prev.slice(0, -1)
    })
  }, []) // stable — no external deps

  const prevPage: WebPage | null = navStack.length > 0 ? navStack[navStack.length - 1].page : null
  const canGoBack = navStack.length > 0

  const nav: WebNav = { go, goBack, canGoBack, current: page, categoryId, categoryName, productId, orderId, prevPage }

  return (
    <>
      <StorefrontLayout brandColor={brandColor} nav={nav} currentStore={currentStore} onOpenStorePicker={handleOpenStorePicker}>
        {page === "home"           && <StorefrontHome          brandColor={brandColor} nav={nav} />}
        {page === "category"       && <StorefrontCategoryPage  brandColor={brandColor} nav={nav} />}
        {page === "product"        && <StorefrontProductPage   brandColor={brandColor} nav={nav} />}
        {page === "auth"           && <StorefrontAuth          brandColor={brandColor} nav={nav} />}
        {page === "checkout"       && <StorefrontCheckout      brandColor={brandColor} nav={nav} currentStore={currentStore} />}
        {page === "order-tracking" && <StorefrontOrderTracking brandColor={brandColor} nav={nav} />}
        {page === "orders"         && <StorefrontOrders        brandColor={brandColor} nav={nav} />}
        {page === "profile"        && <StorefrontProfile       brandColor={brandColor} nav={nav} />}
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
