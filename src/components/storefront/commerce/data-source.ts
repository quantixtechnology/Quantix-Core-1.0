"use client"

// Phase 3 — client catalogue data-source resolver for template sections.
//
// Templates store PRESENTATION + DATA-SOURCE DESCRIPTORS only (never copied
// catalogue records). At render time these hooks load the REAL current tenant
// categories/products from the existing storefront APIs — tenant-scoped, and
// preserving the established filterByStore semantics (customer storefront passes
// filterByStore=true with a storeId). Deleted/inaccessible IDs are ignored.
import { useEffect, useState } from "react"
import type { StorefrontCategory } from "@/components/storefront/web/storefront-category-card"
import type { StorefrontProduct } from "@/components/storefront/web/storefront-product-card"

type CategoryMode = "ALL_ACTIVE_CATEGORIES" | "SELECTED_CATEGORIES"
type ProductMode = "ALL" | "CATEGORY" | "FEATURED" | "NEW_ARRIVALS" | "BEST_SELLERS" | "MANUAL"

export interface CategoryDataSourceConfig { mode?: string; selectedCategoryIds?: string[]; maxItems?: number }
export interface ProductDataSourceConfig { mode?: string; categoryId?: string; selectedProductIds?: string[]; maxItems?: number }

// ── Categories ──────────────────────────────────────────────────────────────
export function useCategoryData(businessId: string | null, cfg: CategoryDataSourceConfig) {
  const [items, setItems] = useState<StorefrontCategory[]>([])
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify(cfg || {})

  useEffect(() => {
    if (!businessId) { setItems([]); setLoading(false); return }
    let live = true
    setLoading(true)
    fetch(`/api/core/storefront/categories?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return
        let list: StorefrontCategory[] = Array.isArray(j?.data) ? j.data : []
        const mode = (cfg.mode as CategoryMode) || "ALL_ACTIVE_CATEGORIES"
        if (mode === "SELECTED_CATEGORIES" && Array.isArray(cfg.selectedCategoryIds) && cfg.selectedCategoryIds.length) {
          const wanted = new Set(cfg.selectedCategoryIds)
          // Preserve the configured order; silently drop deleted/inaccessible ids.
          const byId = new Map(list.map((c) => [c.id, c]))
          list = cfg.selectedCategoryIds.map((id) => byId.get(id)).filter((c): c is StorefrontCategory => !!c && wanted.has(c.id))
        }
        if (typeof cfg.maxItems === "number" && cfg.maxItems > 0) list = list.slice(0, cfg.maxItems)
        setItems(list)
      })
      .catch(() => { if (live) setItems([]) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, key])

  return { items, loading }
}

// ── Products ──────────────────────────────────────────────────────────────
export function useProductData(businessId: string | null, storeId: string | null, cfg: ProductDataSourceConfig) {
  const [items, setItems] = useState<StorefrontProduct[]>([])
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify({ cfg: cfg || {}, storeId })

  useEffect(() => {
    if (!businessId) { setItems([]); setLoading(false); return }
    let live = true
    setLoading(true)
    const mode = (cfg.mode as ProductMode) || "ALL"
    const max = typeof cfg.maxItems === "number" && cfg.maxItems > 0 ? cfg.maxItems : 12

    const params = new URLSearchParams({ businessId, limit: String(Math.max(max, 24)) })
    // Preserve existing customer-storefront store scoping.
    if (storeId) { params.set("storeId", storeId); params.set("filterByStore", "true") }
    if (mode === "CATEGORY" && cfg.categoryId) params.set("categoryId", cfg.categoryId)

    fetch(`/api/core/storefront/products?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return
        let list: StorefrontProduct[] = Array.isArray(j?.data) ? j.data : []
        switch (mode) {
          case "FEATURED": {
            const feat = list.filter((p) => p.isFeatured)
            list = feat.length ? feat : list // graceful: sparse catalogue still renders
            break
          }
          case "NEW_ARRIVALS":
            // API already orders featured desc then recent; take head as "new".
            break
          case "BEST_SELLERS":
            // No sales-analytics field exists on Product — fall back to isPopular
            // where present, else the default ordering. (Reported as a data note;
            // baseline templates avoid relying on true best-seller analytics.)
            {
              const pop = list.filter((p) => p.isPopular)
              list = pop.length ? pop : list
            }
            break
          case "MANUAL": {
            if (Array.isArray(cfg.selectedProductIds) && cfg.selectedProductIds.length) {
              const byId = new Map(list.map((p) => [p.id, p]))
              list = cfg.selectedProductIds.map((id) => byId.get(id)).filter((p): p is StorefrontProduct => !!p)
            }
            break
          }
          default:
            break
        }
        setItems(list.slice(0, max))
      })
      .catch(() => { if (live) setItems([]) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, key])

  return { items, loading }
}
