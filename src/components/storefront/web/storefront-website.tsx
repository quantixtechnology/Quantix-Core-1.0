"use client"

import { useState, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
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
  const { currentBusinessPrimaryColor } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#C62828"

  const [page, setPage] = useState<WebPage>("home")
  const [prevPage, setPrevPage] = useState<WebPage | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [productId, setProductId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

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

  // Pages that don't need the full layout chrome (header/footer/cart drawer)
  const barePages: WebPage[] = []

  return (
    <StorefrontLayout brandColor={brandColor} nav={nav}>
      {page === "home"           && <StorefrontHome          brandColor={brandColor} nav={nav} />}
      {page === "category"       && <StorefrontCategoryPage  brandColor={brandColor} nav={nav} />}
      {page === "product"        && <StorefrontProductPage   brandColor={brandColor} nav={nav} />}
      {page === "auth"           && <StorefrontAuth          brandColor={brandColor} nav={nav} />}
      {page === "checkout"       && <StorefrontCheckout      brandColor={brandColor} nav={nav} />}
      {page === "order-tracking" && <StorefrontOrderTracking brandColor={brandColor} nav={nav} />}
      {page === "orders"         && <StorefrontOrders        brandColor={brandColor} nav={nav} />}
      {page === "profile"        && <StorefrontProfile       brandColor={brandColor} nav={nav} />}
      {page === "addresses"      && <StorefrontAddresses     brandColor={brandColor} nav={nav} />}
    </StorefrontLayout>
  )
}
