// Idempotent Quantix Core baseline Commerce templates (Phase 2 verification).
// Creates 3 platform master templates with structurally valid pages/sections
// (data-source config only — NEVER copies catalogue data), publishes them, and
// sets category defaults. Safe to re-run: skips a template that already exists
// by code and never overwrites a customised one.
//
// Usage: node scripts/seed-commerce-templates.js
const { PrismaClient } = require("@prisma/client")
const db = new PrismaClient()

const j = (v) => (v == null ? null : JSON.stringify(v))
const vis = { desktop: true, tablet: true, mobile: true }

// Baseline templates. Sections use the Phase 1 registry types; catalogue
// sections carry data-source descriptors only.
const TEMPLATES = [
  {
    code: "commerce-neutral-base", name: "Neutral Commerce Base", primary: "ECOMMERCE",
    categories: ["ECOMMERCE", "COSMETICS", "FURNITURE"],
    description: "Clean, category-agnostic online-store baseline.",
    home: [
      { type: "HEADER", content: { showSearch: true, showCategoryMenu: true, showCart: true, showAccount: true, sticky: true } },
      { type: "HERO", content: { heading: "Quality products, delivered", subheading: "Shop the collection", ctaText: "Shop Now", ctaHref: "/products" } },
      { type: "CATEGORY_GRID", dataSource: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 12 } },
      { type: "PRODUCT_GRID", dataSource: { mode: "FEATURED", maxItems: 8 } },
      { type: "FOOTER", content: { showSocial: true } },
    ],
  },
  {
    code: "grocery-base", name: "Grocery Base", primary: "GROCERY", categories: ["GROCERY"],
    description: "Search-forward grocery storefront with offers and best sellers.",
    home: [
      { type: "HEADER", content: { showSearch: true, showCategoryMenu: true, showCart: true, showAccount: true, sticky: true } },
      { type: "HERO", content: { heading: "Fresh groceries, delivered daily", subheading: "In minutes to your door", ctaText: "Shop Now", ctaHref: "/products" } },
      { type: "CATEGORY_GRID", dataSource: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 16 } },
      { type: "PRODUCT_GRID", dataSource: { mode: "FEATURED", maxItems: 8 } },
      { type: "OFFER_BANNER", content: { heading: "Today's Deals", ctaText: "Grab Now", ctaHref: "/offers" } },
      { type: "PRODUCT_GRID", dataSource: { mode: "BEST_SELLERS", maxItems: 8 } },
      { type: "FOOTER", content: { showSocial: true } },
    ],
  },
  {
    code: "meat-delivery-base", name: "Meat Delivery Base", primary: "MEAT_DELIVERY", categories: ["MEAT_DELIVERY"],
    description: "Premium meat & seafood storefront with trust and delivery CTA.",
    home: [
      { type: "HEADER", content: { showSearch: true, showCategoryMenu: true, showCart: true, showAccount: true, sticky: true } },
      { type: "HERO", content: { heading: "Fresh. Premium. Delivered.", subheading: "Hygienically processed meat & seafood", ctaText: "Order Now", ctaHref: "/products" } },
      { type: "CATEGORY_GRID", dataSource: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 8 } },
      { type: "PRODUCT_GRID", dataSource: { mode: "FEATURED", maxItems: 8 } },
      { type: "IMAGE_BANNER", content: { href: "/about" } },
      { type: "CTA", content: { text: "Get it delivered today", href: "/products", variant: "primary" } },
      { type: "FOOTER", content: { showSocial: true } },
    ],
  },
]

async function ensureTemplate(t) {
  const existing = await db.commerceTemplate.findUnique({ where: { code: t.code }, select: { id: true, status: true } })
  if (existing) { console.log(`  = ${t.code} exists (skip, not overwritten)`); return existing.id }

  const created = await db.commerceTemplate.create({
    data: {
      code: t.code, name: t.name, description: t.description,
      workspaceType: "COMMERCE", businessCategory: t.primary, templateType: "STOREFRONT",
      status: "ACTIVE", version: 1, publishedVersion: 0, createdBy: "seed",
      categories: { create: [...new Set([t.primary, ...t.categories])].map((c) => ({ businessCategory: c })) },
      pages: {
        create: [{
          name: "Home", slug: "home", pageType: "HOME", route: "/", sortOrder: 0, isHomePage: true, status: "ACTIVE",
          sections: {
            create: t.home.map((s, i) => ({
              sectionType: s.type, sortOrder: i,
              visibilityConfig: j(vis),
              dataSourceConfig: j(s.dataSource || null),
              contentConfig: j(s.content || null),
            })),
          },
        }],
      },
    },
    select: { id: true },
  })
  console.log(`  + ${t.code} created (${t.home.length} sections)`)
  return created.id
}

async function publish(templateId) {
  const pages = await db.commerceTemplatePage.findMany({ where: { templateId }, include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } })
  const snap = JSON.stringify({ version: 1, publishedAt: new Date().toISOString(), pages: pages.map((p) => ({ slug: p.slug, isHomePage: p.isHomePage, sections: p.sections.map((s) => ({ sectionType: s.sectionType, sortOrder: s.sortOrder })) })) })
  await db.commerceTemplate.update({ where: { id: templateId }, data: { publishedVersion: 1, publishedAt: new Date(), publishedConfig: snap } })
}

async function setDefault(businessCategory, templateId) {
  await db.commerceCategoryDefault.upsert({
    where: { workspaceType_businessCategory: { workspaceType: "COMMERCE", businessCategory } },
    update: {}, // don't override an existing (possibly customised) default
    create: { workspaceType: "COMMERCE", businessCategory, templateId, updatedBy: "seed" },
  })
}

;(async () => {
  console.log("Seeding Commerce baseline templates…")
  const ids = {}
  for (const t of TEMPLATES) {
    const id = await ensureTemplate(t)
    ids[t.primary] = id
    const tpl = await db.commerceTemplate.findUnique({ where: { id }, select: { publishedVersion: true } })
    if (tpl && tpl.publishedVersion === 0) await publish(id)
  }
  // Category defaults (idempotent; never override existing).
  await setDefault("ECOMMERCE", ids.ECOMMERCE)
  await setDefault("GROCERY", ids.GROCERY)
  await setDefault("MEAT_DELIVERY", ids.MEAT_DELIVERY)
  console.log("Category defaults set: ECOMMERCE, GROCERY, MEAT_DELIVERY")
  console.log("Done.")
  await db.$disconnect()
})().catch((e) => { console.error(e); process.exit(1) })
