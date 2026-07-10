// Phase 3 — authoritative LIVE storefront resolution.
//
// This is the single server-side entry point the live Commerce storefront (and
// the platform diagnostic) call. It composes the Phase 1/2 primitives — it does
// NOT reimplement resolver priority (that stays in template-resolver.ts):
//
//   resolveCommerceStorefront()  → template (STORE_OVERRIDE→BUSINESS_ASSIGNMENT→
//                                   CATEGORY_DEFAULT→NEUTRAL_FALLBACK) + published
//                                   config (TENANT_PUBLISHED → MASTER_PUBLISHED)
//   getCommerceRendererMode()    → LEGACY | TEMPLATE | AUTO
//
// It resolves the requested PAGE from the published pages, sanitises sections to
// presentation + data-source descriptors (never catalogue data, never drafts),
// and decides the EFFECTIVE renderer ("template" vs "legacy") with a diagnostic
// fallbackReason. Published content only — drafts are never selected because
// resolveCommerceStorefront filters ACTIVE pages / reads publishedConfig.
import { db } from "@/lib/db"
import { resolveCommerceStorefront } from "@/lib/commerce/template-resolver"
import { getCommerceRendererMode, type CommerceRendererMode } from "@/lib/commerce/renderer-mode"

export interface LiveSection {
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

export interface LivePage {
  slug: string
  name: string
  route: string
  isHomePage: boolean
  sections: LiveSection[]
}

export interface LiveStorefrontResult {
  businessId: string
  productCode: string | null
  businessType: string
  rendererMode: CommerceRendererMode
  effective: "template" | "legacy"
  source: string // STORE_OVERRIDE | BUSINESS_ASSIGNMENT | CATEGORY_DEFAULT | NEUTRAL_FALLBACK
  configSource: "TENANT_PUBLISHED" | "MASTER_PUBLISHED" | "NONE"
  template: { id: string | null; code: string; name: string; publishedVersion: number | null }
  page: LivePage | null
  availablePages: { slug: string; name: string; route: string; isHomePage: boolean }[]
  fallbackReason: string | null
}

function obj(v: unknown): Record<string, unknown> {
  if (v == null) return {}
  if (typeof v === "string") { try { return JSON.parse(v) as Record<string, unknown> } catch { return {} } }
  if (typeof v === "object") return v as Record<string, unknown>
  return {}
}

// Normalise a raw published page (master ACTIVE page row OR tenant publishedConfig
// entry) into a LivePage. Section JSON strings are parsed to objects here so the
// client never parses config and never receives catalogue data.
function toLivePage(raw: unknown): LivePage | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  const rawSections = Array.isArray(p.sections) ? p.sections : []
  const sections: LiveSection[] = rawSections
    .map((s, i) => {
      const sec = s as Record<string, unknown>
      const type = String(sec.sectionType || sec.type || "")
      if (!type) return null
      return {
        id: String(sec.id || `${type}-${i}`),
        type,
        sectionKey: (sec.sectionKey as string) || null,
        sortOrder: typeof sec.sortOrder === "number" ? sec.sortOrder : i,
        layoutConfig: obj(sec.layoutConfig),
        styleConfig: obj(sec.styleConfig),
        visibilityConfig: obj(sec.visibilityConfig),
        dataSourceConfig: obj(sec.dataSourceConfig),
        contentConfig: obj(sec.contentConfig),
      } as LiveSection
    })
    .filter((s): s is LiveSection => s !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const slug = String(p.slug || (p.isHomePage ? "home" : "page"))
  return {
    slug,
    name: String(p.name || slug),
    route: String(p.route || (p.isHomePage ? "/" : `/${slug}`)),
    isHomePage: !!p.isHomePage,
    sections,
  }
}

function pickPages(config: unknown): LivePage[] {
  if (!Array.isArray(config)) return []
  return config.map(toLivePage).filter((p): p is LivePage => p !== null)
}

export interface LiveInput {
  businessId: string
  storeId?: string | null
  pageSlug?: string | null // requested page; default = home page
}

export async function resolveLiveStorefront(input: LiveInput): Promise<LiveStorefrontResult> {
  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, productCode: true, businessType: true },
  })
  const productCode = business?.productCode ?? null
  const businessType = business?.businessType ?? ""

  const rendererMode = business ? await getCommerceRendererMode(input.businessId) : "LEGACY"

  const base: LiveStorefrontResult = {
    businessId: input.businessId,
    productCode,
    businessType,
    rendererMode,
    effective: "legacy",
    source: "NEUTRAL_FALLBACK",
    configSource: "NONE",
    template: { id: null, code: "commerce-neutral", name: "Commerce (Neutral)", publishedVersion: null },
    page: null,
    availablePages: [],
    fallbackReason: null,
  }

  // Non-Commerce workspaces never use the Commerce template renderer.
  if (!business) return { ...base, fallbackReason: "business-not-found" }
  if ((productCode || "").toUpperCase() !== "COMMERCE") {
    return { ...base, fallbackReason: "not-commerce-workspace" }
  }
  // LEGACY businesses short-circuit — do not even resolve a template.
  if (rendererMode === "LEGACY") {
    return { ...base, fallbackReason: "renderer-mode-legacy" }
  }

  const resolved = await resolveCommerceStorefront({
    businessId: input.businessId,
    storeId: input.storeId ?? null,
    businessCategory: businessType,
    workspaceType: productCode || "COMMERCE",
  })

  let publishedVersion: number | null = null
  if (resolved.template.templateId) {
    const t = await db.commerceTemplate
      .findUnique({ where: { id: resolved.template.templateId }, select: { publishedVersion: true } })
      .catch(() => null)
    publishedVersion = t?.publishedVersion ?? null
  }

  const template = {
    id: resolved.template.templateId,
    code: resolved.template.code,
    name: resolved.template.name,
    publishedVersion,
  }

  const pages = pickPages(resolved.config)
  const availablePages = pages.map((p) => ({ slug: p.slug, name: p.name, route: p.route, isHomePage: p.isHomePage }))

  // No published content resolved → fail safe. TEMPLATE mode still renders the
  // (empty) template chrome rather than an invalid template; AUTO falls back to
  // legacy. Never render draft/invalid content.
  if (pages.length === 0) {
    const reason = resolved.template.templateId ? "no-published-pages" : "no-template-assigned"
    return {
      ...base,
      source: resolved.template.source,
      configSource: resolved.configSource,
      template,
      availablePages,
      effective: rendererMode === "TEMPLATE" ? "legacy" : "legacy",
      fallbackReason: reason,
    }
  }

  // Select the requested page. A specific slug that does not exist is a 404 —
  // it must NOT silently fall back to home. Only the default (no slug, or the
  // "home" alias) falls back to the home/first page.
  const wanted = input.pageSlug ? input.pageSlug.toLowerCase() : null
  const isDefaultRequest = !wanted || wanted === "home"
  let page: LivePage | null = null
  if (wanted) page = pages.find((p) => p.slug.toLowerCase() === wanted) || null

  if (wanted && !page && !isDefaultRequest) {
    // Requested a specific non-existent custom page → signal 404 to the caller.
    return {
      ...base,
      source: resolved.template.source,
      configSource: resolved.configSource,
      template,
      availablePages,
      effective: "legacy",
      fallbackReason: "page-not-found",
    }
  }
  if (!page) page = pages.find((p) => p.isHomePage) || pages[0]

  return {
    businessId: input.businessId,
    productCode,
    businessType,
    rendererMode,
    effective: "template",
    source: resolved.template.source,
    configSource: resolved.configSource,
    template,
    page,
    availablePages,
    fallbackReason: null,
  }
}
