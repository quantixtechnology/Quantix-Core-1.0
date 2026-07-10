"use client"

// Phase 3 — client hook that fetches the authoritative live-storefront render
// directive from the server (/api/core/storefront/template). All resolver logic
// (priority, renderer mode, page selection, fallback) stays server-side — this
// hook only consumes the decision. Never fetches draft content.
import { useEffect, useState } from "react"

export interface LiveTemplateSection {
  id: string
  type: string
  sectionKey: string | null
  sortOrder: number
  layoutConfig: Record<string, unknown>
  styleConfig: Record<string, unknown>
  visibilityConfig: Record<string, unknown>
  dataSourceConfig: Record<string, unknown>
  contentConfig: Record<string, unknown>
}
export interface LiveTemplatePage {
  slug: string; name: string; route: string; isHomePage: boolean; sections: LiveTemplateSection[]
}
export interface LiveTemplateDirective {
  rendererMode: "LEGACY" | "TEMPLATE" | "AUTO"
  effective: "template" | "legacy"
  source: string
  configSource: string
  template: { id: string | null; code: string; name: string; publishedVersion: number | null }
  page: LiveTemplatePage | null
  availablePages: { slug: string; name: string; route: string; isHomePage: boolean }[]
  fallbackReason: string | null
}

export type LiveTemplateState =
  | { status: "loading"; directive: null }
  | { status: "ready"; directive: LiveTemplateDirective }
  | { status: "not-found"; directive: null }
  | { status: "error"; directive: null }

export function useLiveTemplate(businessId: string | null, storeId: string | null, pageSlug: string): LiveTemplateState {
  const [state, setState] = useState<LiveTemplateState>({ status: "loading", directive: null })

  useEffect(() => {
    if (!businessId) { setState({ status: "error", directive: null }); return }
    let live = true
    setState({ status: "loading", directive: null })
    const params = new URLSearchParams({ businessId })
    if (storeId) params.set("storeId", storeId)
    if (pageSlug) params.set("page", pageSlug)
    fetch(`/api/core/storefront/template?${params}`)
      .then(async (r) => ({ ok: r.ok, status: r.status, json: await r.json().catch(() => null) }))
      .then(({ status, json }) => {
        if (!live) return
        if (status === 404) { setState({ status: "not-found", directive: null }); return }
        if (json?.success && json.data) { setState({ status: "ready", directive: json.data as LiveTemplateDirective }); return }
        setState({ status: "error", directive: null })
      })
      .catch(() => { if (live) setState({ status: "error", directive: null }) })
    return () => { live = false }
  }, [businessId, storeId, pageSlug])

  return state
}
