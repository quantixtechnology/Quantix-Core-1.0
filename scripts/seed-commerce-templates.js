// Idempotent Quantix Core baseline Commerce templates.
//
// Phase 2: creates 3 platform master templates with structurally valid pages/
// sections (data-source config only — NEVER copies catalogue data), publishes
// them, sets category defaults. Safe to re-run: skips a template that already
// exists by code and never overwrites a customised one.
//
// Phase 3: content keys match the live section renderer, and the three baselines
// are VISIBLY differentiated (distinct hero copy + section ordering/composition).
// A one-time content refresh upgrades pristine Phase-2 baselines (publishedVersion
// <= 1, createdBy "seed") to the Phase-3 content; customised templates
// (publishedVersion >= 2) are never touched.
//
// Usage: node scripts/seed-commerce-templates.js
const { PrismaClient } = require("@prisma/client")
const db = new PrismaClient()

const j = (v) => (v == null ? null : JSON.stringify(v))
const vis = { desktop: true, tablet: true, mobile: true }

// Baseline templates. Sections use Phase 1 registry types; catalogue sections
// carry data-source descriptors only. Content keys (heading/subheading/ctaText/
// ctaHref/title) match src/components/storefront/commerce/commerce-sections.tsx.
const TEMPLATES = [
  {
    code: "commerce-neutral-base", name: "Neutral Commerce Base", primary: "ECOMMERCE",
    categories: ["ECOMMERCE", "COSMETICS", "FURNITURE"],
    description: "Clean, category-agnostic online-store baseline.",
    home: [
      { type: "HEADER", content: { showSearch: true, showCategoryMenu: true, showCart: true, showAccount: true, sticky: true } },
      { type: "HERO", content: { eyebrow: "Welcome", heading: "Everything you need, in one place", subheading: "Browse the collection and check out in seconds.", ctaText: "Start shopping", ctaHref: "/products", contentAlignment: "left" } },
      { type: "CATEGORY_GRID", content: { title: "Shop by category" }, dataSource: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 12 } },
      { type: "PRODUCT_GRID", content: { title: "Featured products", subtitle: "Handpicked for you" }, dataSource: { mode: "FEATURED", maxItems: 8 } },
      { type: "CTA", content: { heading: "New here?", subheading: "Discover what's in store today.", ctaText: "Browse all products", ctaHref: "/products" } },
      { type: "FOOTER", content: { showSocial: true } },
    ],
  },
  {
    code: "grocery-base", name: "Grocery Base", primary: "GROCERY", categories: ["GROCERY"],
    description: "Category-forward grocery storefront with daily deals and best sellers.",
    home: [
      { type: "HEADER", content: { showSearch: true, showCategoryMenu: true, showCart: true, showAccount: true, sticky: true } },
      { type: "HERO", content: { eyebrow: "Daily fresh", heading: "Fresh groceries,\ndelivered daily", subheading: "Fruits, vegetables, dairy and daily essentials at your door.", ctaText: "Shop groceries", ctaHref: "/products", contentAlignment: "left" } },
      { type: "CATEGORY_GRID", content: { title: "Shop by category", subtitle: "Everything for your kitchen" }, dataSource: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 16 } },
      { type: "PRODUCT_GRID", content: { title: "Popular this week", subtitle: "Fresh stock, updated daily" }, dataSource: { mode: "FEATURED", maxItems: 8 } },
      { type: "OFFER_BANNER", content: { heading: "Today's deals", subheading: "Save more on your daily basket.", ctaText: "View offers", ctaHref: "/products" } },
      { type: "PRODUCT_GRID", content: { title: "Best sellers", subtitle: "Customer favourites" }, dataSource: { mode: "BEST_SELLERS", maxItems: 8 } },
      { type: "FOOTER", content: { showSocial: true } },
    ],
  },
  {
    code: "meat-delivery-base", name: "Meat Delivery Base", primary: "MEAT_DELIVERY", categories: ["MEAT_DELIVERY"],
    description: "Products-forward fresh-meat storefront with trust and delivery CTA.",
    home: [
      { type: "HEADER", content: { showSearch: true, showCategoryMenu: true, showCart: true, showAccount: true, sticky: true } },
      { type: "HERO", content: { eyebrow: "Fresh & hygienic", heading: "Fresh cuts,\ndelivered fast", subheading: "Premium meat, poultry and seafood — hygienically processed and delivered cold.", ctaText: "Order fresh", ctaHref: "/products", contentAlignment: "left" } },
      { type: "PRODUCT_GRID", content: { title: "Today's fresh cuts", subtitle: "Cut and packed on order" }, dataSource: { mode: "FEATURED", maxItems: 8 } },
      { type: "CATEGORY_GRID", content: { title: "Browse selection" }, dataSource: { mode: "ALL_ACTIVE_CATEGORIES", maxItems: 8 } },
      { type: "IMAGE_BANNER", content: { heading: "Sourced fresh, delivered cold", subheading: "Temperature-controlled from our facility to your door.", ctaText: "How it works", ctaHref: "/products" } },
      { type: "CTA", content: { heading: "Get it delivered today", subheading: "Order now for same-day fresh delivery.", ctaText: "Order now", ctaHref: "/products" } },
      { type: "FOOTER", content: { showSocial: true } },
    ],
  },
]

function sectionCreate(home) {
  return home.map((s, i) => ({
    sectionType: s.type, sortOrder: i,
    visibilityConfig: j(vis),
    dataSourceConfig: j(s.dataSource || null),
    contentConfig: j(s.content || null),
  }))
}

async function ensureTemplate(t) {
  const existing = await db.commerceTemplate.findUnique({ where: { code: t.code }, select: { id: true } })
  if (existing) return { id: existing.id, created: false }

  const created = await db.commerceTemplate.create({
    data: {
      code: t.code, name: t.name, description: t.description,
      workspaceType: "COMMERCE", businessCategory: t.primary, templateType: "STOREFRONT",
      status: "ACTIVE", version: 1, publishedVersion: 0, createdBy: "seed",
      categories: { create: [...new Set([t.primary, ...t.categories])].map((c) => ({ businessCategory: c })) },
      pages: {
        create: [{
          name: "Home", slug: "home", pageType: "HOME", route: "/", sortOrder: 0, isHomePage: true, status: "ACTIVE",
          sections: { create: sectionCreate(t.home) },
        }],
      },
    },
    select: { id: true },
  })
  console.log(`  + ${t.code} created (${t.home.length} sections)`)
  return { id: created.id, created: true }
}

// Phase 3 one-time content refresh: only pristine seeded baselines are upgraded.
async function refreshBaselineContent(t, id) {
  const tpl = await db.commerceTemplate.findUnique({ where: { id }, select: { publishedVersion: true, createdBy: true } })
  if (!tpl) return false
  if (tpl.createdBy !== "seed" || (tpl.publishedVersion || 0) >= 2) {
    console.log(`  = ${t.code} customised (v${tpl.publishedVersion}) — content left untouched`)
    return false
  }
  const home = await db.commerceTemplatePage.findFirst({ where: { templateId: id, isHomePage: true }, select: { id: true, sections: { select: { contentConfig: true, sectionType: true, sortOrder: true }, orderBy: { sortOrder: "asc" } } } })
  if (!home) return false
  // Signature check — already Phase-3 content? (hero heading matches)
  const heroDef = t.home.find((s) => s.type === "HERO")
  const currentHero = home.sections.find((s) => s.sectionType === "HERO")
  const currentHeading = (() => { try { return JSON.parse(currentHero?.contentConfig || "{}").heading } catch { return null } })()
  if (currentHeading && heroDef && currentHeading === heroDef.content.heading) return false // already current

  await db.commerceTemplateSection.deleteMany({ where: { pageId: home.id } })
  await db.commerceTemplateSection.createMany({ data: sectionCreate(t.home).map((s) => ({ ...s, pageId: home.id })) })
  console.log(`  ↻ ${t.code} content refreshed to Phase 3 (${t.home.length} sections)`)
  return true
}

async function publish(templateId, bumpTo) {
  const pages = await db.commerceTemplatePage.findMany({ where: { templateId }, include: { sections: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } })
  const snap = JSON.stringify({
    publishedAt: new Date().toISOString(),
    pages: pages.map((p) => ({
      slug: p.slug, name: p.name, route: p.route, isHomePage: p.isHomePage,
      sections: p.sections.map((s) => ({
        id: s.id, sectionType: s.sectionType, sectionKey: s.sectionKey, sortOrder: s.sortOrder,
        layoutConfig: s.layoutConfig, styleConfig: s.styleConfig, visibilityConfig: s.visibilityConfig,
        dataSourceConfig: s.dataSourceConfig, contentConfig: s.contentConfig,
      })),
    })),
  })
  await db.commerceTemplate.update({ where: { id: templateId }, data: { publishedVersion: bumpTo, publishedAt: new Date(), publishedConfig: snap } })
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
    const { id, created } = await ensureTemplate(t)
    ids[t.primary] = id
    if (created) {
      await publish(id, 1)
    } else {
      const refreshed = await refreshBaselineContent(t, id)
      if (refreshed) {
        const cur = await db.commerceTemplate.findUnique({ where: { id }, select: { publishedVersion: true } })
        await publish(id, (cur?.publishedVersion || 1) + 1)
      } else {
        // Ensure any Phase-2 baseline still has a full published snapshot.
        const cur = await db.commerceTemplate.findUnique({ where: { id }, select: { publishedVersion: true, publishedConfig: true } })
        if (!cur?.publishedConfig) await publish(id, (cur?.publishedVersion || 0) + 1)
      }
    }
  }
  await setDefault("ECOMMERCE", ids.ECOMMERCE)
  await setDefault("GROCERY", ids.GROCERY)
  await setDefault("MEAT_DELIVERY", ids.MEAT_DELIVERY)
  console.log("Category defaults ensured: ECOMMERCE, GROCERY, MEAT_DELIVERY")
  console.log("Done.")
  await db.$disconnect()
})().catch((e) => { console.error(e); process.exit(1) })
