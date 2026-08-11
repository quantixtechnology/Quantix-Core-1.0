"use client"

// THE garment selector for every operational Laundry OS screen.
//
// One source: the garment master behind Settings → Pricing, read through the
// existing GET /api/laundry/garments. No screen keeps its own list, so adding a
// garment in Pricing makes it selectable everywhere without a code change — and
// nothing can drift out of step with Pricing again.
//
// Search matches NAME or CODE, because staff at a counter know a garment by
// whichever is on the label in front of them.
//
// ACTIVE ONLY for new work: the endpoint filters isActive by default and this
// component never passes includeInactive. Historical orders are unaffected —
// they render their stored garment name, and are not built from this list.

import { useCallback, useEffect, useMemo, useState } from "react"
import { SearchableSelect } from "./views/pricing/searchable-select"

export interface GarmentOption {
  id: string
  name: string
  code?: string | null
  categoryId?: string | null
}

/** Shared loader, so every caller gets the same set and the same filtering. */
export function useGarmentMaster(businessId: string | null | undefined) {
  const [garments, setGarments] = useState<GarmentOption[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return }
    setLoading(true)
    // No includeInactive: a retired garment must not start new transactions.
    fetch(`/api/laundry/garments?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => setGarments(j.success ? (j.data || []) : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  return { garments, loading, reload: load }
}

/** Label as staff read it: name, with the code alongside when there is one. */
export function garmentLabel(g: GarmentOption): string {
  return g.code ? `${g.name} · ${g.code}` : g.name
}

export function LaundryGarmentSelect({
  value, onChange, garments, categoryId, placeholder = "Search garment name or code…", className,
}: {
  value: string
  onChange: (garmentId: string) => void
  garments: GarmentOption[]
  /** Optional narrowing, e.g. a service's compatible categories. */
  categoryId?: string | null
  placeholder?: string
  className?: string
}) {
  const options = useMemo(() => {
    const list = categoryId ? garments.filter((g) => g.categoryId === categoryId) : garments
    return list.map((g) => ({
      value: g.id,
      // The code is part of the LABEL rather than a separate field, so the
      // existing search — which matches on label — finds "G-SHRT2" as readily
      // as "shirt", with no second search implementation.
      label: garmentLabel(g),
    }))
  }, [garments, categoryId])

  return <SearchableSelect value={value} onChange={onChange} options={options} placeholder={placeholder} className={className} />
}
