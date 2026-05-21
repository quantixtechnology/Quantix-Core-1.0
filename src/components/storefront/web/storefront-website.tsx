"use client"

import { useState, useCallback } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { StorefrontLayout } from "./storefront-layout"
import { StorefrontHome } from "./storefront-home"
import { StorefrontCategoryPage } from "./storefront-category"
import { StorefrontProductPage } from "./storefront-product"

export type WebPage = "home" | "category" | "product" | "auth" | "orders"

export interface WebNav {
  go: (page: WebPage, opts?: { categoryId?: string; categoryName?: string; productId?: string }) => void
  current: WebPage
  categoryId: string | null
  categoryName: string
  productId: string | null
}

export function StorefrontWebsite() {
  const { currentBusinessPrimaryColor } = useAdminStore()
  const brandColor = currentBusinessPrimaryColor || "#C62828"

  const [page, setPage] = useState<WebPage>("home")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [productId, setProductId] = useState<string | null>(null)

  const go = useCallback((
    p: WebPage,
    opts?: { categoryId?: string; categoryName?: string; productId?: string },
  ) => {
    setPage(p)
    if (opts?.categoryId !== undefined) setCategoryId(opts.categoryId ?? null)
    if (opts?.categoryName !== undefined) setCategoryName(opts.categoryName ?? "")
    if (opts?.productId !== undefined) setProductId(opts.productId ?? null)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const nav: WebNav = { go, current: page, categoryId, categoryName, productId }

  return (
    <StorefrontLayout brandColor={brandColor} nav={nav}>
      {page === "home"     && <StorefrontHome         brandColor={brandColor} nav={nav} />}
      {page === "category" && <StorefrontCategoryPage brandColor={brandColor} nav={nav} />}
      {page === "product"  && <StorefrontProductPage  brandColor={brandColor} nav={nav} />}
    </StorefrontLayout>
  )
}
