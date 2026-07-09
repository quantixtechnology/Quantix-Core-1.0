// Authoritative Commerce storefront TEMPLATE RESOLVER.
//
// ONE place that decides which storefront template a Commerce business/store
// renders — so business-category checks never scatter across React components
// (the exact anti-pattern that produced the Grocery coupling).
//
// Resolution priority (documented + tested):
//   1. Store-specific active assignment      (CommerceTemplateAssignment.storeId)
//   2. Business active template assignment    (CommerceTemplateAssignment, storeId null)
//   3. Business category default template     (CommerceTemplate.isDefault for businessType)
//   4. Neutral Commerce fallback              (NEVER Grocery)
//
// Then it resolves the CONFIG to render:
//   • tenant publishedConfig (CommerceTenantTemplate) if the tenant has published
//   • otherwise the master template's published pages/sections
//
// Phase 1: resolver + priority + neutral fallback are implemented and unit-safe.
// It is NOT yet wired into the live storefront render path (Phase 3) — importing
// it has no effect on current storefront behaviour.

import { db } from "@/lib/db"

export const NEUTRAL_COMMERCE_FALLBACK = {
  templateId: null as string | null,
  code: "commerce-neutral",
  name: "Commerce (Neutral)",
  source: "FALLBACK" as const,
}

export type TemplateSource =
  | "STORE_ASSIGNMENT"
  | "BUSINESS_ASSIGNMENT"
  | "CATEGORY_DEFAULT"
  | "FALLBACK"

export interface ResolveInput {
  businessId: string
  storeId?: string | null
  // Business.businessType — the Commerce category (GROCERY | ECOMMERCE | …).
  businessCategory: string
  workspaceType?: string // PlatformProduct.code, default COMMERCE
}

export interface ResolvedTemplate {
  templateId: string | null
  code: string
  name: string
  source: TemplateSource
  businessCategory: string
}

// Resolve WHICH master template applies (priority chain). Returns the neutral
// fallback (never Grocery) when nothing is assigned/configured.
export async function resolveTemplateForBusiness(input: ResolveInput): Promise<ResolvedTemplate> {
  const { businessId, storeId, businessCategory } = input
  const workspaceType = input.workspaceType || "COMMERCE"

  // 1 + 2: assignments (store override first, then business-level).
  const assignments = await db.commerceTemplateAssignment.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { template: { select: { id: true, code: true, name: true, status: true, businessCategory: true } } },
  }).catch(() => [])

  const usable = assignments.filter((a) => a.template && a.template.status === "ACTIVE")
  if (storeId) {
    const storeHit = usable.find((a) => a.storeId === storeId)
    if (storeHit?.template) return tpl(storeHit.template, "STORE_ASSIGNMENT")
  }
  const bizHit = usable.find((a) => a.storeId === null)
  if (bizHit?.template) return tpl(bizHit.template, "BUSINESS_ASSIGNMENT")

  // 3: category default template.
  const def = await db.commerceTemplate.findFirst({
    where: { workspaceType, businessCategory, isDefault: true, status: "ACTIVE" },
    select: { id: true, code: true, name: true, businessCategory: true },
    orderBy: { updatedAt: "desc" },
  }).catch(() => null)
  if (def) return { templateId: def.id, code: def.code, name: def.name, source: "CATEGORY_DEFAULT", businessCategory: def.businessCategory }

  // 4: neutral Commerce fallback — never Grocery.
  return { templateId: null, code: NEUTRAL_COMMERCE_FALLBACK.code, name: NEUTRAL_COMMERCE_FALLBACK.name, source: "FALLBACK", businessCategory }
}

function tpl(t: { id: string; code: string; name: string; businessCategory: string }, source: TemplateSource): ResolvedTemplate {
  return { templateId: t.id, code: t.code, name: t.name, source, businessCategory: t.businessCategory }
}

export interface ResolvedStorefront {
  template: ResolvedTemplate
  // JSON page/section tree the renderer consumes. null → renderer uses the
  // neutral config-driven storefront (current behaviour) until templates exist.
  config: unknown | null
  configSource: "TENANT_PUBLISHED" | "MASTER_PUBLISHED" | "NONE"
}

// Full resolution: which template + which published config the LIVE storefront
// should render. Tenant published config wins; else the master's published
// pages; else none (neutral storefront).
export async function resolveCommerceStorefront(input: ResolveInput): Promise<ResolvedStorefront> {
  const template = await resolveTemplateForBusiness(input)

  // Tenant published instance (isolated per business/store) takes precedence.
  const tenant = await db.commerceTenantTemplate.findFirst({
    where: { businessId: input.businessId, storeId: input.storeId ?? null, status: "PUBLISHED" },
    select: { publishedConfig: true },
  }).catch(() => null)
  if (tenant?.publishedConfig) {
    return { template, config: safeParse(tenant.publishedConfig), configSource: "TENANT_PUBLISHED" }
  }

  // Master template published pages/sections (data-source config only — no
  // copied catalogue data).
  if (template.templateId) {
    const pages = await db.commerceTemplatePage.findMany({
      where: { templateId: template.templateId, status: "ACTIVE" },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }).catch(() => [])
    if (pages.length) return { template, config: pages, configSource: "MASTER_PUBLISHED" }
  }

  return { template, config: null, configSource: "NONE" }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}
