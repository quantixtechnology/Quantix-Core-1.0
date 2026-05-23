"use client"

import { useState, useCallback, useEffect } from "react"
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

export interface WebNav {
  go: (page: WebPage, opts?: {
    categoryId?: string
    categoryName?: string
    productId?: string
    orderId?: string
    prevPage?: WebPage
  }) => void
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
  const [prevPage, setPrevPage] = useState<WebPage | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [productId, setProductId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

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
    opts?: { categoryId?: string; categoryName?: string; productId?: string; orderId?: string; prevPage?: WebPage },
  ) => {
    setPrevPage(opts?.prevPage !== undefined ? opts.prevPage : page)
    setPage(p)
    if (opts?.categoryId !== undefined) setCategoryId(opts.categoryId ?? null)
    if (opts?.categoryName !== undefined) setCategoryName(opts.categoryName ?? "")
    if (opts?.productId !== undefined) setProductId(opts.productId ?? null)
    if (opts?.orderId !== undefined) setOrderId(opts.orderId ?? null)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }, [page])

  const nav: WebNav = { go, current: page, categoryId, categoryName, productId, orderId, prevPage }

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
